import { AudioEngine } from '../../src/audio/audio-engine';
import { defaultSettings } from '../../src/shared/settings';
(window as unknown as Record<string, unknown>).Violet = { AudioEngine, defaultSettings };
