import { sanitizeSettings } from './settings';
import type { Settings } from './types';

const KEY = 'violetAudioSettings';

export async function loadSettings(): Promise<Settings> {
  try {
    const res = await chrome.storage.local.get(KEY);
    return sanitizeSettings(res[KEY]);
  } catch {
    return sanitizeSettings(undefined);
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await chrome.storage.local.set({ [KEY]: settings });
  } catch (err) {
    console.warn('[Violet Audio] could not save settings', err);
  }
}

/** Subscribes to changes written by another context; returns an unsubscribe function. */
export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    const change = changes[KEY];
    if (area !== 'local' || !change) return;
    cb(sanitizeSettings(change.newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
