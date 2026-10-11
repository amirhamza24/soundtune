import type { Settings } from '../shared/types';

/**
 * Pure mapping from user settings to concrete DSP values.
 * Kept free of Web Audio types so it can be unit-tested in Node.
 *
 * Signal-processing design (to avoid stacking boosts):
 *  - Bass / Treble are broad low/high shelves at 120 Hz / 6 kHz ("tone" stage).
 *  - The 10 bands are narrower (octave) filters; the 32 Hz and 16 kHz bands are shelves.
 *  - Overlap between the two stages is accounted for in a single automatic preamp cut
 *    (`preampDb`), so any boost is paid for with headroom instead of clipping.
 *  - A brick-wall style limiter at the end of the chain is the last safety net.
 */
export interface DspParams {
  preampDb: number;
  bandGainsDb: number[];
  bassDb: number;
  trebleDb: number;
  /** M/S side gain, 1 = unchanged */
  stereoWidth: number;
  reverbMix: number; // 0..1 (0 when disabled)
  reverbDecay: number;
  compThreshold: number;
  compRatio: number;
  compKnee: number;
}

const maxOf = (xs: number[]): number => xs.reduce((m, v) => Math.max(m, v), -Infinity);

/** Estimated worst-case boost (dB) of the tone + band stages combined. */
export function estimatePeakBoostDb(bands: number[], bass: number, treble: number): number {
  const low = maxOf(bands.slice(0, 4)) + bass; // 32..250 Hz overlaps the bass shelf
  const high = maxOf(bands.slice(6)) + treble; // 2k..16k overlaps the treble shelf
  return Math.max(0, maxOf(bands), low, high);
}

export function computeParams(s: Settings): DspParams {
  const bandGainsDb = s.eqEnabled ? [...s.bands] : s.bands.map(() => 0);
  const peak = estimatePeakBoostDb(bandGainsDb, s.bass, s.treble);
  // 0.75: real music rarely peaks at full scale in a single band; the limiter covers the rest.
  const preampDb = -Math.min(15, peak * 0.75);
  const c = s.effects.compressor;
  return {
    preampDb,
    bandGainsDb,
    bassDb: s.bass,
    trebleDb: s.treble,
    stereoWidth: s.effects.stereo.enabled ? s.effects.stereo.width : 1,
    reverbMix: s.effects.reverb.enabled ? s.effects.reverb.mix : 0,
    reverbDecay: s.effects.reverb.decay,
    // Disabled compressor: threshold 0 dB with ratio 1 is a transparent pass-through.
    compThreshold: c.enabled ? -14 - 22 * c.amount : 0,
    compRatio: c.enabled ? 2 + 4 * c.amount : 1,
    compKnee: c.enabled ? 18 : 0,
  };
}
