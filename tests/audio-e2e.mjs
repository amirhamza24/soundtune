// End-to-end audio test in real Chrome: noise -> <audio> -> AudioEngine -> analyser.
// Run: npm run build:harness && node tests/audio-e2e.mjs
import http from 'node:http';
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const harness = readFileSync('tests/harness/out/harness.js', 'utf8');
const html = `<!doctype html><body><audio id="a" loop></audio><script src="/harness.js"></script></body>`;
const server = http.createServer((req, res) => {
  if (req.url === '/harness.js') { res.setHeader('content-type', 'text/javascript'); res.end(harness); }
  else { res.setHeader('content-type', 'text/html'); res.end(html); }
}).listen(0);
const port = server.address().port;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(m.text()));
page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
await page.goto(`http://localhost:${port}/`);

const result = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const { AudioEngine, defaultSettings } = window.Violet;
  const SR = 44100;

  /** 2 s stereo WAV. kind: number = sine Hz (same in L/R) | 'noise' = independent L/R noise. */
  const wav = (kind) => {
    const n = SR * 2, buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf);
    const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 4, true);
    v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) {
      const l = kind === 'noise' ? Math.random() * 2 - 1 : Math.sin((2 * Math.PI * kind * i) / SR);
      const r = kind === 'noise' ? Math.random() * 2 - 1 : l;
      v.setInt16(44 + i * 4, l * 0.1 * 32767, true);
      v.setInt16(46 + i * 4, r * 0.1 * 32767, true);
    }
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  };

  const audio = document.getElementById('a');
  const play = async (kind) => { audio.src = wav(kind); await audio.play(); await sleep(250); };
  await play(1000);

  const engine = new AudioEngine();
  const base = defaultSettings();
  engine.apply(base);
  await engine.attach(audio);
  const out = { status: engine.status, ctxState: engine.ctx?.state };
  const ctx = engine.ctx, g = engine.graph;

  const an = ctx.createAnalyser(); an.fftSize = 4096; g.master.connect(an);
  const rmsDb = () => {
    const t = new Float32Array(4096); an.getFloatTimeDomainData(t);
    let s = 0; for (const x of t) s += x * x;
    return 10 * Math.log10(s / t.length + 1e-20);
  };
  const level = async (settings, wait = 500) => { engine.apply(settings); await sleep(wait); let m = 0; for (let i = 0; i < 5; i++) { m += rmsDb(); await sleep(40); } return m / 5; };

  // --- tone accuracy: gain relative to the neutral dry path ---------------------------------
  const gain = async (hz, patch) => {
    await play(hz);
    const ref = await level({ ...base, enabled: false });
    const val = await level({ ...base, ...patch });
    return +(val - ref).toFixed(2);
  };
  const band = (i, db) => { const b = new Array(10).fill(0); b[i] = db; return b; };
  out.flat_1k = await gain(1000, {});
  out.band1k_p12 = await gain(1000, { bands: band(5, 12) });
  out.band1k_m12 = await gain(1000, { bands: band(5, -12) });
  out.band1k_p12_eqOff = await gain(1000, { bands: band(5, 12), eqEnabled: false });
  out.band64_p12_at64 = await gain(64, { bands: band(1, 12) });
  out.band8k_p12_at8k = await gain(8000, { bands: band(8, 12) });
  out.bass10_at64 = await gain(64, { bass: 10 });
  out.bass10_at1k = await gain(1000, { bass: 10 });
  out.treble10_at8k = await gain(8000, { treble: 10 });
  out.treble10_at1k = await gain(1000, { treble: 10 });
  out.disabled_band_boost = await gain(1000, { bands: band(5, 12), enabled: false });

  // --- stereo width (independent L/R noise) --------------------------------------------------
  await play('noise');
  const sp = ctx.createChannelSplitter(2), aL = ctx.createAnalyser(), aR = ctx.createAnalyser();
  aL.fftSize = aR.fftSize = 2048;
  g.master.connect(sp); sp.connect(aL, 0); sp.connect(aR, 1);
  const diffRatio = () => {
    const l = new Float32Array(2048), r = new Float32Array(2048);
    aL.getFloatTimeDomainData(l); aR.getFloatTimeDomainData(r);
    let d = 0, s = 0; for (let i = 0; i < 2048; i++) { d += (l[i] - r[i]) ** 2; s += (l[i] + r[i]) ** 2; }
    return { side: d, mid: s };
  };
  const stereo = async (width) => {
    engine.apply({ ...base, effects: { ...base.effects, stereo: { enabled: true, width } } });
    await sleep(400); return diffRatio();
  };
  const w1 = await stereo(1), w0 = await stereo(0), w2 = await stereo(2);
  out.side_over_mid = { w0: w0.side / w0.mid, w1: w1.side / w1.mid, w2: w2.side / w2.mid };
  out.mid_kept_w2_vs_w1_db = +(10 * Math.log10(w2.mid / w1.mid)).toFixed(2); // mono sum must not change

  // --- reverb tail after the source stops ----------------------------------------------------
  await play(1000);
  const tail = async (reverb) => {
    engine.apply({ ...base, effects: { ...base.effects, reverb } });
    await sleep(900);
    audio.pause(); await sleep(900);
    const r = rmsDb();
    await audio.play(); await sleep(300);
    return +r.toFixed(1);
  };
  out.tail_off_db = await tail({ enabled: false, mix: 0.5, decay: 3 });
  out.tail_on_db = await tail({ enabled: true, mix: 0.5, decay: 3 });

  // --- headroom: every control maxed, full-scale-ish tone ------------------------------------
  await play(1000);
  engine.apply({ ...base, bands: new Array(10).fill(12), bass: 10, treble: 10 });
  await sleep(700);
  let peak = 0;
  for (let i = 0; i < 20; i++) { const t = new Float32Array(4096); an.getFloatTimeDomainData(t); for (const x of t) peak = Math.max(peak, Math.abs(x)); await sleep(30); }
  out.peak_all_max = +peak.toFixed(3);

  engine.dispose();
  return out;
});

console.log(JSON.stringify(result, null, 2));
console.log('console:', logs.filter((l) => !l.includes('favicon')).join('\n') || '(none)');
await browser.close();
server.close();

const r = result;
const near = (v, t, tol) => Math.abs(v - t) <= tol;
const checks = [
  ['engine active', r.status === 'active' && r.ctxState === 'running'],
  ['flat preset is transparent (±0.3 dB)', near(r.flat_1k, 0, 0.3)],
  ['1k band +12 dB -> +3 dB net after headroom', near(r.band1k_p12, 3, 0.8)],
  ['1k band -12 dB -> -12 dB', near(r.band1k_m12, -12, 0.8)],
  ['EQ off ignores bands', near(r.band1k_p12_eqOff, 0, 0.3)],
  ['64 Hz band +12 -> ~+3 dB', near(r.band64_p12_at64, 3, 1.2)],
  ['8 kHz band +12 -> ~+3 dB', near(r.band8k_p12_at8k, 3, 1.2)],
  ['bass +10 lifts 64 Hz ≥7 dB above 1 kHz', r.bass10_at64 - r.bass10_at1k >= 7],
  ['bass +10 leaves 1 kHz cut by headroom only', r.bass10_at1k < 0 && r.bass10_at1k > -9],
  ['treble +10 lifts 8 kHz ≥7 dB above 1 kHz', r.treble10_at8k - r.treble10_at1k >= 7],
  ['master off = neutral (0 dB)', near(r.disabled_band_boost, 0, 0.3)],
  ['width 0 -> mono', r.side_over_mid.w0 < 0.001],
  ['width 1 -> real stereo', r.side_over_mid.w1 > 0.2],
  ['width 2 -> wider', r.side_over_mid.w2 > r.side_over_mid.w1 * 2],
  ['width keeps mono sum', near(r.mid_kept_w2_vs_w1_db, 0, 0.5)],
  ['reverb tail audible, off is silent', r.tail_on_db > r.tail_off_db + 15],
  ['no clipping with every control maxed', r.peak_all_max < 1],
];
let bad = 0;
for (const [name, ok] of checks) { console.log(ok ? 'PASS' : 'FAIL', name); if (!ok) bad++; }
process.exit(bad ? 1 : 0);
