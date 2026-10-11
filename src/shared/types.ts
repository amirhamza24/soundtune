/** Center frequencies of the 10-band equalizer (Hz). */
export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export const BAND_COUNT = EQ_FREQUENCIES.length;

export const GAIN_MIN = -12;
export const GAIN_MAX = 12;
export const TONE_MIN = -10;
export const TONE_MAX = 10;

export type Bands = number[]; // length === BAND_COUNT, dB

export interface ReverbSettings {
  enabled: boolean;
  /** Wet/dry balance, 0..1 */
  mix: number;
  /** Tail length in seconds */
  decay: number;
}

export interface StereoSettings {
  enabled: boolean;
  /** 1 = unchanged, 0 = mono, 2 = twice the side signal */
  width: number;
}

export interface CompressorSettings {
  enabled: boolean;
  /** 0 (gentle) .. 1 (firm) */
  amount: number;
}

export interface EffectSettings {
  reverb: ReverbSettings;
  stereo: StereoSettings;
  compressor: CompressorSettings;
}

/** The part of the state that a preset defines. */
export interface SoundProfile {
  bands: Bands;
  bass: number;
  treble: number;
  effects: EffectSettings;
}

export interface CustomPreset extends SoundProfile {
  id: string;
  name: string;
}

export const VIZ_STYLES = ['bars', 'mirror', 'curve', 'radial', 'rings', 'particles', 'dots', 'aurora', 'ridge', 'classic', 'lollipop', 'galaxy', 'tunnel', 'rain', 'ripple', 'dotwall'] as const;
export type VisualizerStyle = (typeof VIZ_STYLES)[number];
export const VIZ_THEMES = ['violet', 'red', 'aurora', 'sunset', 'ocean', 'mono'] as const;
export type VisualizerTheme = (typeof VIZ_THEMES)[number];

export interface VisualizerSettings {
  enabled: boolean;
  style: VisualizerStyle;
  theme: VisualizerTheme;
  /** 0.5 .. 2, scales how strongly bars react */
  sensitivity: number;
}

export interface Settings extends SoundProfile {
  /** Master switch for all processing. */
  enabled: boolean;
  /** Switch for the 10 band equalizer only (bass/treble stay active). */
  eqEnabled: boolean;
  /** Selected preset id: a built-in id, `custom:<id>` or `custom`. Derived from the profile. */
  presetId: string;
  customPresets: CustomPreset[];
  visualizer: VisualizerSettings;
}

export const CUSTOM_ID = 'custom';
