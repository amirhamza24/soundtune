import { EQ_FREQUENCIES } from '../shared/types';
import type { Settings } from '../shared/types';
import { computeParams } from './params';
import type { DspParams } from './params';

/** Smoothing constant for parameter automation (seconds). ~3 time constants ≈ 90 ms. */
const TC = 0.03;
const BAND_Q = 1.41; // one-octave peaking filters
const BASS_HZ = 120;
const TREBLE_HZ = 6000;

export type EngineStatus = 'idle' | 'blocked' | 'active' | 'error';

interface Graph {
  input: GainNode;
  dry: GainNode;
  wet: GainNode;
  master: GainNode;
  preamp: GainNode;
  bass: BiquadFilterNode;
  bands: BiquadFilterNode[];
  treble: BiquadFilterNode;
  sideGain: GainNode;
  reverbSend: GainNode;
  reverbDry: GainNode;
  reverbWet: GainNode;
  convolver: ConvolverNode;
  compressor: DynamicsCompressorNode;
  limiter: DynamicsCompressorNode;
  analyser: AnalyserNode;
}

/** An element can only ever be captured once per context; remember what we created. */
const sources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

/**
 * Signal flow:
 *
 *  media element → MediaElementSource → input ─┬─ dry ──────────────────────────────┐
 *                                              └─ preamp → bass shelf → 10 bands →  │
 *                                                 treble shelf → stereo M/S width → │
 *                                                 reverb (parallel) → compressor →  │
 *                                                 limiter → wet ────────────────────┤
 *                                                                          master ◄─┘ → analyser (tap)
 *                                                                                   → destination
 *
 * `dry`/`wet` are cross-faded, so disabling processing returns to a bit-neutral path
 * without reconnecting nodes (no clicks, playback never interrupted).
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private graph: Graph | null = null;
  private settings: Settings | null = null;
  private pending: HTMLMediaElement | null = null;
  private attached = new Set<MediaElementAudioSourceNode>();
  private spectrumBuf: Uint8Array<ArrayBuffer> | null = null;
  private reverbDecay = 0;
  private reverbTimer: number | null = null;
  private gestureArmed = false;
  private disposed = false;
  private error: string | null = null;

  constructor(private readonly onChange: () => void = () => undefined) {}

  get status(): EngineStatus {
    if (this.error) return 'error';
    if (this.attached.size > 0 && this.ctx?.state === 'running') return 'active';
    if (this.pending || (this.attached.size > 0 && this.ctx?.state !== 'running')) return 'blocked';
    return 'idle';
  }

  get detail(): string | undefined {
    return this.error ?? undefined;
  }

  get hasAttached(): boolean {
    return this.attached.size > 0;
  }

  /** Applies settings to the live graph (or stores them for when it exists). */
  apply(settings: Settings): void {
    this.settings = settings;
    if (this.graph && this.ctx) this.pushParams(this.graph, this.ctx, settings);
  }

  /**
   * Routes a media element through the graph. Safe to call repeatedly: an element is
   * captured at most once and the graph is built at most once.
   *
   * The element is only captured when the AudioContext is actually running; capturing it
   * while the context is suspended (autoplay policy) would silence the video.
   */
  async attach(video: HTMLMediaElement): Promise<void> {
    if (this.disposed) return;
    if (sources.has(video)) {
      const known = sources.get(video);
      if (known && !this.attached.has(known) && this.graph) {
        known.connect(this.graph.input);
        this.attached.add(known);
        this.onChange();
      }
      return;
    }
    try {
      const ctx = this.ensureContext();
      if (ctx.state !== 'running') {
        void ctx.resume().catch(() => undefined);
        await new Promise((r) => setTimeout(r, 120));
      }
      if (this.disposed) return;
      if (ctx.state !== 'running') {
        this.pending = video;
        this.armGesture();
        this.onChange();
        return;
      }
      this.pending = null;
      const source = ctx.createMediaElementSource(video);
      sources.set(video, source);
      source.connect(this.requireGraph().input);
      this.attached.add(source);
      this.error = null;
      if (this.settings) this.pushParams(this.requireGraph(), ctx, this.settings);
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      console.warn('[Violet Audio] could not attach to media element', err);
    }
    this.onChange();
  }

  /** Try to (re)start a suspended context; returns whether it is running. */
  async resume(): Promise<boolean> {
    if (!this.ctx) return false;
    if (this.ctx.state !== 'running') {
      void this.ctx.resume().catch(() => undefined);
      await new Promise((r) => setTimeout(r, 120));
    }
    if (this.ctx.state === 'running' && this.pending) await this.attach(this.pending);
    return this.ctx.state === 'running';
  }

  /**
   * Log-spaced spectrum of the *processed* output, 0..255 per bar.
   * Reads the analyser that taps the master output.
   */
  getSpectrum(bars: number): number[] {
    const out = new Array<number>(bars).fill(0);
    const g = this.graph;
    const ctx = this.ctx;
    if (!g || !ctx || ctx.state !== 'running' || this.attached.size === 0) return out;
    const n = g.analyser.frequencyBinCount;
    if (!this.spectrumBuf || this.spectrumBuf.length !== n) this.spectrumBuf = new Uint8Array(n);
    g.analyser.getByteFrequencyData(this.spectrumBuf);
    const hzPerBin = ctx.sampleRate / g.analyser.fftSize;
    const lo = 40;
    const hi = 16000;
    for (let i = 0; i < bars; i++) {
      const f0 = lo * Math.pow(hi / lo, i / bars);
      const f1 = lo * Math.pow(hi / lo, (i + 1) / bars);
      const b0 = Math.min(n - 1, Math.floor(f0 / hzPerBin));
      const b1 = Math.min(n - 1, Math.max(b0, Math.ceil(f1 / hzPerBin) - 1));
      let peak = 0;
      for (let b = b0; b <= b1; b++) peak = Math.max(peak, this.spectrumBuf[b] ?? 0);
      out[i] = peak;
    }
    return out;
  }

  /** Detaches processing and sends audio straight to the speakers again. */
  dispose(): void {
    this.disposed = true;
    if (this.reverbTimer !== null) window.clearTimeout(this.reverbTimer);
    this.removeGesture();
    const ctx = this.ctx;
    if (ctx && this.graph) {
      for (const s of this.attached) {
        try {
          s.disconnect();
          s.connect(ctx.destination);
        } catch {
          /* node already gone */
        }
      }
      this.graph.master.disconnect();
      this.graph.analyser.disconnect();
    }
    this.attached.clear();
    this.graph = null;
  }

  // ---------------------------------------------------------------- internals

  private ensureContext(): AudioContext {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext({ latencyHint: 'playback' });
    ctx.addEventListener('statechange', () => {
      if (ctx.state !== 'running' && this.attached.size > 0) void ctx.resume().catch(() => undefined);
      if (ctx.state === 'running' && this.pending) void this.attach(this.pending);
      this.onChange();
    });
    this.ctx = ctx;
    this.graph = this.buildGraph(ctx);
    return ctx;
  }

  private requireGraph(): Graph {
    if (!this.graph) throw new Error('audio graph missing');
    return this.graph;
  }

  private armGesture(): void {
    if (this.gestureArmed) return;
    this.gestureArmed = true;
    for (const t of ['pointerdown', 'keydown', 'touchend'] as const) {
      window.addEventListener(t, this.onGesture, { capture: true, passive: true });
    }
  }

  private removeGesture(): void {
    if (!this.gestureArmed) return;
    this.gestureArmed = false;
    for (const t of ['pointerdown', 'keydown', 'touchend'] as const) {
      window.removeEventListener(t, this.onGesture, { capture: true });
    }
  }

  private onGesture = (): void => {
    void this.resume().then((running) => {
      if (running) this.removeGesture();
    });
  };

  private buildGraph(ctx: AudioContext): Graph {
    const gain = (v = 1): GainNode => new GainNode(ctx, { gain: v });
    const input = gain();
    const dry = gain(1);
    const wet = gain(0);
    const master = gain();
    const preamp = gain();

    const bass = new BiquadFilterNode(ctx, { type: 'lowshelf', frequency: BASS_HZ, gain: 0 });
    const treble = new BiquadFilterNode(ctx, { type: 'highshelf', frequency: TREBLE_HZ, gain: 0 });
    // 32 Hz = low shelf, 16 kHz = high shelf, everything between is a peaking filter.
    const bands = EQ_FREQUENCIES.map((f, i) => {
      const type: BiquadFilterType = i === 0 ? 'lowshelf' : i === EQ_FREQUENCIES.length - 1 ? 'highshelf' : 'peaking';
      return new BiquadFilterNode(ctx, { type, frequency: f, Q: BAND_Q, gain: 0 });
    });

    // Stereo width via Mid/Side. mid = (L+R)/2 is never changed, so the mono sum is preserved
    // for every width value; only the side signal (L-R)/2 is scaled.
    const split = new ChannelSplitterNode(ctx, { numberOfOutputs: 2 });
    const merge = new ChannelMergerNode(ctx, { numberOfInputs: 2 });
    const mid = gain(1);
    const side = gain(1);
    const sideGain = gain(1);
    const sideInv = gain(-1);
    const half = (n: number): GainNode => gain(n);
    const lHalf = half(0.5);
    const rHalf = half(0.5);
    const lSide = half(0.5);
    const rSide = half(-0.5);
    split.connect(lHalf, 0);
    split.connect(rHalf, 1);
    split.connect(lSide, 0);
    split.connect(rSide, 1);
    lHalf.connect(mid);
    rHalf.connect(mid);
    lSide.connect(side);
    rSide.connect(side);
    side.connect(sideGain);
    sideGain.connect(sideInv);
    mid.connect(merge, 0, 0); // L = mid + side
    sideGain.connect(merge, 0, 0);
    mid.connect(merge, 0, 1); // R = mid - side
    sideInv.connect(merge, 0, 1);

    // Reverb as a parallel send so the dry signal keeps full fidelity.
    const reverbSend = gain(1);
    const reverbDry = gain(1);
    const reverbWet = gain(0);
    const preDelay = new DelayNode(ctx, { delayTime: 0.018, maxDelayTime: 0.1 });
    const convolver = new ConvolverNode(ctx);
    const hp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 180 });
    const lp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 7000 });
    const reverbOut = gain(1);

    const compressor = new DynamicsCompressorNode(ctx, {
      threshold: 0, knee: 0, ratio: 1, attack: 0.01, release: 0.25,
    });
    // Safety limiter: only engages near full scale.
    const limiter = new DynamicsCompressorNode(ctx, {
      threshold: -1.5, knee: 0, ratio: 20, attack: 0.002, release: 0.1,
    });
    // Chrome applies automatic make-up gain to every DynamicsCompressorNode, which would make the
    // limiter alone add ~0.85 dB. Trim it so a flat setting is level-matched with the dry path.
    const limiterTrim = gain(1 / limiterMakeupGain(-1.5, 20));
    const analyser = new AnalyserNode(ctx, { fftSize: 2048, smoothingTimeConstant: 0.78, minDecibels: -88, maxDecibels: -18 });

    input.connect(dry).connect(master);
    input.connect(preamp);
    let node: AudioNode = preamp.connect(bass);
    for (const b of bands) node = node.connect(b);
    node.connect(treble).connect(split);
    merge.connect(reverbSend);
    reverbSend.connect(reverbDry).connect(reverbOut);
    reverbSend.connect(preDelay).connect(convolver).connect(hp).connect(lp).connect(reverbWet).connect(reverbOut);
    reverbOut.connect(compressor).connect(limiter).connect(limiterTrim).connect(wet).connect(master);
    master.connect(ctx.destination);
    master.connect(analyser);

    return {
      input, dry, wet, master, preamp, bass, bands, treble, sideGain,
      reverbSend, reverbDry, reverbWet, convolver, compressor, limiter, analyser,
    };
  }

  private pushParams(g: Graph, ctx: AudioContext, s: Settings): void {
    const p: DspParams = computeParams(s);
    const t = ctx.currentTime;
    const set = (param: AudioParam, v: number, tc = TC): void => {
      param.cancelScheduledValues(t);
      param.setTargetAtTime(v, t, tc);
    };
    // Master switch: cross-fade between neutral dry path and processed path.
    set(g.wet.gain, s.enabled ? 1 : 0, 0.02);
    set(g.dry.gain, s.enabled ? 0 : 1, 0.02);
    set(g.preamp.gain, Math.pow(10, p.preampDb / 20));
    set(g.bass.gain, p.bassDb);
    set(g.treble.gain, p.trebleDb);
    g.bands.forEach((b, i) => set(b.gain, p.bandGainsDb[i] ?? 0));
    set(g.sideGain.gain, p.stereoWidth);
    // Equal-power wet/dry law keeps loudness steady while moving the mix.
    set(g.reverbDry.gain, Math.cos((p.reverbMix * Math.PI) / 2));
    set(g.reverbWet.gain, Math.sin((p.reverbMix * Math.PI) / 2) * 0.9);
    if (p.reverbMix > 0) this.scheduleReverb(g, ctx, p.reverbDecay);
    set(g.compressor.threshold, p.compThreshold);
    set(g.compressor.ratio, p.compRatio);
    set(g.compressor.knee, p.compKnee);
  }

  /** Re-builds the impulse response when the decay changes (debounced, with a short fade). */
  private scheduleReverb(g: Graph, ctx: AudioContext, decay: number): void {
    if (Math.abs(decay - this.reverbDecay) < 0.01 && g.convolver.buffer) return;
    if (!g.convolver.buffer) {
      this.reverbDecay = decay;
      g.convolver.buffer = makeImpulse(ctx, decay);
      return;
    }
    if (this.reverbTimer !== null) window.clearTimeout(this.reverbTimer);
    this.reverbTimer = window.setTimeout(() => {
      this.reverbTimer = null;
      const graph = this.graph;
      const context = this.ctx;
      if (!graph || !context) return;
      graph.reverbWet.gain.cancelScheduledValues(context.currentTime);
      graph.reverbWet.gain.setTargetAtTime(0, context.currentTime, 0.01);
      window.setTimeout(() => {
        if (!this.graph || !this.ctx || !this.settings) return;
        this.reverbDecay = decay;
        this.graph.convolver.buffer = makeImpulse(this.ctx, decay);
        this.pushParams(this.graph, this.ctx, this.settings); // fades the wet level back in
      }, 60);
    }, 160);
  }
}

/** Chrome's automatic make-up gain for a hard-knee compressor (full-scale input maps to this output). */
function limiterMakeupGain(thresholdDb: number, ratio: number): number {
  const outDb = thresholdDb + (0 - thresholdDb) / ratio;
  return Math.pow(1 / Math.pow(10, outDb / 20), 0.6);
}

/** Synthetic room: stereo-decorrelated noise with an exponential (-60 dB at `decay`) tail. */
function makeImpulse(ctx: BaseAudioContext, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * decay));
  const buf = ctx.createBuffer(2, len, rate);
  const k = Math.log(1000) / len; // 60 dB over the full length
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const attack = Math.min(1, i / (rate * 0.005));
      data[i] = (Math.random() * 2 - 1) * Math.exp(-k * i) * attack;
    }
  }
  return buf;
}
