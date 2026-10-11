/** Port name used between popup and content script. */
export const PORT_NAME = 'violet-audio-live';

export type EngineState =
  | 'no-video' // no <video> found yet
  | 'off' // processing disabled, nothing attached
  | 'bypassed' // attached, processing disabled (neutral path)
  | 'blocked' // AudioContext cannot start yet (needs a click on the page)
  | 'active' // processing the audio
  | 'error';

export interface PlaybackStatus {
  title: string | null;
  playing: boolean;
  engine: EngineState;
  detail?: string;
}

export type ContentToPopup =
  | { type: 'status'; status: PlaybackStatus }
  | { type: 'spectrum'; bars: number[] };

export type PopupToContent = { type: 'resume' };

export const SPECTRUM_BARS = 64;
