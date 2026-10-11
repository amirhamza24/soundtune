import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BUILT_IN_PRESETS, DEFAULT_PRESET_ID, cloneProfile, customPresetKey, flatBands, matchPreset, presetLabel, profileOf, profilesEqual } from '../shared/presets';
import { defaultSettings } from '../shared/settings';
import { loadSettings, saveSettings } from '../shared/storage';
import type { CustomPreset, EffectSettings, Settings, SoundProfile, VisualizerSettings } from '../shared/types';
import { GAIN_MAX, GAIN_MIN, TONE_MAX, TONE_MIN } from '../shared/types';

export interface Toast {
  id: number;
  message: string;
  undo?: () => void;
}

export interface Store {
  settings: Settings;
  toast: Toast | null;
  dismissToast: () => void;
  setEnabled: (v: boolean) => void;
  setEqEnabled: (v: boolean) => void;
  setBand: (index: number, db: number) => void;
  resetBands: () => void;
  setBass: (db: number) => void;
  setTreble: (db: number) => void;
  patchEffects: (patch: { [K in keyof EffectSettings]?: Partial<EffectSettings[K]> }) => void;
  applyPreset: (id: string) => void;
  /** Returns an error message, or null on success. */
  validateName: (name: string, ignoreId?: string) => string | null;
  saveCustomPreset: (name: string) => string | null;
  renameCustomPreset: (id: string, name: string) => string | null;
  deleteCustomPreset: (id: string) => void;
  setVisualizer: (patch: Partial<VisualizerSettings>) => void;
  resetAll: () => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const NAME_MAX = 24;

/** Applies a profile change and re-derives which preset (if any) the sound now equals. */
function withProfile(s: Settings, patch: Partial<SoundProfile>): Settings {
  const next = { ...s, ...patch };
  return { ...next, presetId: matchPreset(next, next.customPresets) };
}

export function StoreProvider({ children }: { children: ReactNode }): ReactNode {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const latest = useRef<Settings | null>(null);
  const dirty = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const toastId = useRef(0);

  useEffect(() => {
    let alive = true;
    void loadSettings().then((s) => {
      if (alive) {
        latest.current = s;
        setSettings(s);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // Debounced write-through. The content script listens to storage and re-applies to the audio graph.
  const flush = useCallback((): void => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (dirty.current && latest.current) {
      dirty.current = false;
      void saveSettings(latest.current);
    }
  }, []);

  useEffect(() => {
    if (!settings) return;
    if (latest.current === settings && !dirty.current) return; // initial load, nothing to write
    latest.current = settings;
    dirty.current = true;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flush, 50);
  }, [settings, flush]);

  useEffect(() => {
    const onHide = (): void => flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      flush();
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, [flush]);

  const update = useCallback((fn: (s: Settings) => Settings): void => {
    setSettings((s) => {
      if (!s) return s;
      const next = fn(s);
      latest.current = next;
      dirty.current = true;
      return next;
    });
  }, []);

  const showToast = useCallback((message: string, undo?: () => void): void => {
    toastId.current += 1;
    setToast({ id: toastId.current, message, undo });
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  const store = useMemo<Store | null>(() => {
    if (!settings) return null;
    const neutral = BUILT_IN_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)!.profile;

    /** Offers "Undo" when a change would throw away unsaved manual settings. */
    const guardedChange = (message: string, change: (s: Settings) => Settings): void => {
      const before = settings;
      const unsaved = before.presetId === 'custom' && !profilesEqual(profileOf(before), neutral);
      update(change);
      if (unsaved) {
        showToast(message, () => update((s) => withProfile(s, cloneProfile(profileOf(before)))));
      }
    };

    const validateName = (raw: string, ignoreId?: string): string | null => {
      const name = raw.trim();
      if (!name) return 'Enter a name';
      if (name.length > NAME_MAX) return `Max ${NAME_MAX} characters`;
      const lower = name.toLowerCase();
      if (BUILT_IN_PRESETS.some((p) => p.name.toLowerCase() === lower)) return 'Name used by a built-in preset';
      if (settings.customPresets.some((p) => p.id !== ignoreId && p.name.toLowerCase() === lower)) return 'Name already exists';
      return null;
    };

    return {
      settings,
      toast,
      dismissToast: () => setToast(null),
      setEnabled: (enabled) => update((s) => ({ ...s, enabled })),
      setEqEnabled: (eqEnabled) => update((s) => ({ ...s, eqEnabled })),
      setBand: (i, db) =>
        update((s) => {
          const bands = [...s.bands];
          bands[i] = clamp(db, GAIN_MIN, GAIN_MAX);
          // Editing a band implies the user wants to hear it: switch the EQ on.
          return withProfile({ ...s, eqEnabled: true }, { bands });
        }),
      resetBands: () => guardedChange('Equalizer reset', (s) => withProfile(s, { bands: flatBands() })),
      setBass: (db) => update((s) => withProfile(s, { bass: clamp(db, TONE_MIN, TONE_MAX) })),
      setTreble: (db) => update((s) => withProfile(s, { treble: clamp(db, TONE_MIN, TONE_MAX) })),
      patchEffects: (patch) =>
        update((s) =>
          withProfile(s, {
            effects: {
              reverb: { ...s.effects.reverb, ...patch.reverb },
              stereo: { ...s.effects.stereo, ...patch.stereo },
              compressor: { ...s.effects.compressor, ...patch.compressor },
            },
          }),
        ),
      applyPreset: (id) => {
        const built = BUILT_IN_PRESETS.find((p) => p.id === id);
        const mine = settings.customPresets.find((p) => customPresetKey(p.id) === id);
        const profile = built?.profile ?? mine;
        if (!profile) return;
        const label = presetLabel(id, settings.customPresets);
        guardedChange(`Switched to ${label}`, (s) => ({ ...withProfile(s, cloneProfile(profile)), eqEnabled: true }));
      },
      validateName,
      saveCustomPreset: (raw) => {
        const err = validateName(raw);
        if (err) return err;
        const current = profileOf(settings);
        const existing = matchPreset(current, settings.customPresets);
        if (existing !== 'custom') return `Already matches “${presetLabel(existing, settings.customPresets)}”`;
        const preset: CustomPreset = { id: crypto.randomUUID().slice(0, 8), name: raw.trim(), ...current };
        update((s) => withProfile({ ...s, customPresets: [...s.customPresets, preset] }, {}));
        showToast(`Saved “${preset.name}”`);
        return null;
      },
      renameCustomPreset: (id, raw) => {
        const err = validateName(raw, id);
        if (err) return err;
        update((s) => ({ ...s, customPresets: s.customPresets.map((p) => (p.id === id ? { ...p, name: raw.trim() } : p)) }));
        return null;
      },
      deleteCustomPreset: (id) => {
        update((s) => withProfile({ ...s, customPresets: s.customPresets.filter((p) => p.id !== id) }, {}));
        showToast('Preset deleted');
      },
      setVisualizer: (patch) => update((s) => ({ ...s, visualizer: { ...s.visualizer, ...patch } })),
      resetAll: () => {
        const d = defaultSettings();
        guardedChange('Reset to defaults', (s) => ({
          ...withProfile(s, cloneProfile(d)),
          eqEnabled: true,
          enabled: true,
        }));
        // guardedChange only toasts when there was unsaved work; always confirm the reset.
        if (settings.presetId !== 'custom') showToast('Reset to defaults');
      },
    };
  }, [settings, toast, update, showToast]);

  if (!store) return null;
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
