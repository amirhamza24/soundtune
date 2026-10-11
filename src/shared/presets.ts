import type { Bands, CustomPreset, EffectSettings, Settings, SoundProfile } from './types';
import { BAND_COUNT, CUSTOM_ID } from './types';

export const defaultEffects = (): EffectSettings => ({
  reverb: { enabled: false, mix: 0.25, decay: 2 },
  stereo: { enabled: false, width: 1 },
  compressor: { enabled: false, amount: 0.5 },
});

export const flatBands = (): Bands => new Array<number>(BAND_COUNT).fill(0);

export type PresetIconName = 'waves' | 'gem' | 'mic' | 'zap' | 'orbit' | 'sliders';

export interface BuiltInPreset {
  id: string;
  name: string;
  description: string;
  icon: PresetIconName;
  profile: SoundProfile;
}

type EffectPatch = { [K in keyof EffectSettings]?: Partial<EffectSettings[K]> };

const fx = (patch: EffectPatch): EffectSettings => {
  const base = defaultEffects();
  return {
    reverb: { ...base.reverb, ...patch.reverb },
    stereo: { ...base.stereo, ...patch.stereo },
    compressor: { ...base.compressor, ...patch.compressor },
  };
};

/**
 * Preset values live here only. Bands: 32, 64, 125, 250, 500, 1k, 2k, 4k, 8k, 16k (dB).
 * Values are deliberately moderate; the engine adds automatic headroom for any boost.
 */
export const BUILT_IN_PRESETS: readonly BuiltInPreset[] = [
  {
    id: 'deep-bass',
    name: 'Deep Bass',
    description: 'Weighty low end with a tight, controlled top.',
    icon: 'waves',
    profile: {
      bands: [6, 5.5, 4, 1.5, 0, -0.5, 0, 0.5, 1, 1],
      bass: 3,
      treble: 0,
      effects: fx({ compressor: { enabled: true, amount: 0.35 } }),
    },
  },
  {
    id: 'crystal-clear',
    name: 'Crystal Clear',
    description: 'Open, detailed highs with a cleaner low-mid.',
    icon: 'gem',
    profile: {
      bands: [-2, -1.5, -1, -0.5, 0, 0.5, 1.5, 3, 3.5, 3.5],
      bass: -1,
      treble: 1.5,
      effects: fx({}),
    },
  },
  {
    id: 'vocal-boost',
    name: 'Vocal Boost',
    description: 'Pushes the voice range forward, trims rumble.',
    icon: 'mic',
    profile: {
      bands: [-3, -2.5, -1.5, 0, 1.5, 3, 3.5, 2.5, 0.5, 0],
      bass: 0,
      treble: 0,
      effects: fx({}),
    },
  },
  {
    id: 'edm-party',
    name: 'EDM / Party',
    description: 'Punchy kick, bright top, wider stereo, firm dynamics.',
    icon: 'zap',
    profile: {
      bands: [5, 4.5, 2.5, 0, -1, -1, 0.5, 2.5, 3.5, 4],
      bass: 2,
      treble: 1.5,
      effects: fx({ stereo: { enabled: true, width: 1.25 }, compressor: { enabled: true, amount: 0.5 } }),
    },
  },
  {
    id: 'spatial-ambient',
    name: 'Spatial / Ambient',
    description: 'Airy highs, wider stereo field and a soft reverb tail.',
    icon: 'orbit',
    profile: {
      bands: [1, 1, 0.5, 0, -0.5, 0, 1, 1.5, 2, 2.5],
      bass: 0,
      treble: 0,
      effects: fx({ reverb: { enabled: true, mix: 0.3, decay: 2.4 }, stereo: { enabled: true, width: 1.5 } }),
    },
  },
  {
    id: 'studio-balanced',
    name: 'Studio / Balanced',
    description: 'Neutral reference response. The default.',
    icon: 'sliders',
    profile: { bands: flatBands(), bass: 0, treble: 0, effects: fx({}) },
  },
];

export const DEFAULT_PRESET_ID = 'studio-balanced';

export const customPresetKey = (id: string): string => `custom:${id}`;

const EPS = 0.05;
const near = (a: number, b: number): boolean => Math.abs(a - b) < EPS;

/** Compares two sound profiles; parameters of disabled effects are ignored. */
export function profilesEqual(a: SoundProfile, b: SoundProfile): boolean {
  if (!near(a.bass, b.bass) || !near(a.treble, b.treble)) return false;
  if (a.bands.some((v, i) => !near(v, b.bands[i] ?? 0))) return false;
  const ea = a.effects;
  const eb = b.effects;
  if (ea.reverb.enabled !== eb.reverb.enabled) return false;
  if (ea.reverb.enabled && (!near(ea.reverb.mix * 10, eb.reverb.mix * 10) || !near(ea.reverb.decay, eb.reverb.decay))) return false;
  if (ea.stereo.enabled !== eb.stereo.enabled) return false;
  if (ea.stereo.enabled && !near(ea.stereo.width * 10, eb.stereo.width * 10)) return false;
  if (ea.compressor.enabled !== eb.compressor.enabled) return false;
  if (ea.compressor.enabled && !near(ea.compressor.amount * 10, eb.compressor.amount * 10)) return false;
  return true;
}

/** Which known preset (built-in first, then saved) the profile equals, else `custom`. */
export function matchPreset(profile: SoundProfile, saved: readonly CustomPreset[]): string {
  const built = BUILT_IN_PRESETS.find((p) => profilesEqual(profile, p.profile));
  if (built) return built.id;
  const mine = saved.find((p) => profilesEqual(profile, p));
  return mine ? customPresetKey(mine.id) : CUSTOM_ID;
}

export const cloneProfile = (p: SoundProfile): SoundProfile => ({
  bands: [...p.bands],
  bass: p.bass,
  treble: p.treble,
  effects: {
    reverb: { ...p.effects.reverb },
    stereo: { ...p.effects.stereo },
    compressor: { ...p.effects.compressor },
  },
});

export const profileOf = (s: Settings): SoundProfile => cloneProfile(s);

export function presetLabel(presetId: string, saved: readonly CustomPreset[]): string {
  const built = BUILT_IN_PRESETS.find((p) => p.id === presetId);
  if (built) return built.name;
  const mine = saved.find((p) => customPresetKey(p.id) === presetId);
  return mine ? mine.name : 'Custom';
}
