import { DEFAULT_PRESET_ID, cloneProfile, defaultEffects, flatBands, matchPreset } from './presets';
import type { CustomPreset, EffectSettings, Settings, SoundProfile } from './types';
import { BAND_COUNT, GAIN_MAX, GAIN_MIN, TONE_MAX, TONE_MIN, VIZ_STYLES, VIZ_THEMES } from './types';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

const NEUTRAL: SoundProfile = { bands: flatBands(), bass: 0, treble: 0, effects: defaultEffects() };

function sanitizeEffects(raw: unknown): EffectSettings {
  const d = defaultEffects();
  const r = isObj(raw) ? raw : {};
  const rv = isObj(r.reverb) ? r.reverb : {};
  const st = isObj(r.stereo) ? r.stereo : {};
  const cp = isObj(r.compressor) ? r.compressor : {};
  return {
    reverb: {
      enabled: bool(rv.enabled, d.reverb.enabled),
      mix: num(rv.mix, 0, 1, d.reverb.mix),
      decay: num(rv.decay, 0.5, 4, d.reverb.decay),
    },
    stereo: { enabled: bool(st.enabled, d.stereo.enabled), width: num(st.width, 0, 2, d.stereo.width) },
    compressor: { enabled: bool(cp.enabled, d.compressor.enabled), amount: num(cp.amount, 0, 1, d.compressor.amount) },
  };
}

function sanitizeProfile(raw: unknown): SoundProfile {
  const r = isObj(raw) ? raw : {};
  const bands = Array.isArray(r.bands) && r.bands.length === BAND_COUNT
    ? (r.bands as unknown[]).map((v) => num(v, GAIN_MIN, GAIN_MAX, 0))
    : [...NEUTRAL.bands];
  return {
    bands,
    bass: num(r.bass, TONE_MIN, TONE_MAX, 0),
    treble: num(r.treble, TONE_MIN, TONE_MAX, 0),
    effects: sanitizeEffects(r.effects),
  };
}

function sanitizeCustomPresets(raw: unknown): CustomPreset[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomPreset[] = [];
  const ids = new Set<string>();
  for (const item of raw as unknown[]) {
    if (!isObj(item) || typeof item.id !== 'string' || typeof item.name !== 'string') continue;
    const name = item.name.trim().slice(0, 24);
    if (!name || ids.has(item.id)) continue;
    ids.add(item.id);
    out.push({ id: item.id, name, ...sanitizeProfile(item) });
  }
  return out.slice(0, 30);
}

export function defaultSettings(): Settings {
  return {
    ...cloneProfile(NEUTRAL),
    enabled: true,
    eqEnabled: true,
    presetId: DEFAULT_PRESET_ID,
    customPresets: [],
    visualizer: { enabled: true, style: 'bars', theme: 'violet', sensitivity: 1 },
  };
}

/** Validates unknown stored data; anything invalid falls back to the neutral default. */
export function sanitizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  if (!isObj(raw)) return d;
  const profile = sanitizeProfile(raw);
  const customPresets = sanitizeCustomPresets(raw.customPresets);
  const vz = isObj(raw.visualizer) ? raw.visualizer : {};
  return {
    ...profile,
    enabled: bool(raw.enabled, d.enabled),
    eqEnabled: bool(raw.eqEnabled, d.eqEnabled),
    presetId: matchPreset(profile, customPresets),
    customPresets,
    visualizer: {
      enabled: bool(vz.enabled, true),
      style: VIZ_STYLES.find((v) => v === vz.style) ?? 'bars',
      theme: VIZ_THEMES.find((v) => v === vz.theme) ?? 'violet',
      sensitivity: num(vz.sensitivity, 0.5, 2, 1),
    },
  };
}
