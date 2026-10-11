/** YouTube-specific DOM knowledge. Everything site-specific lives here so other sites can be added later. */

const VIDEO_SELECTORS = [
  '#movie_player video.html5-main-video',
  'video.html5-main-video',
  '#movie_player video',
  'ytmusic-player video',
  'video',
];

/** The main player element (never the hover preview players). */
export function findVideo(): HTMLVideoElement | null {
  for (const sel of VIDEO_SELECTORS) {
    const el = document.querySelector<HTMLVideoElement>(sel);
    if (el && !el.closest('ytd-video-preview')) return el;
  }
  return null;
}

const cleanTitle = (t: string): string =>
  t.replace(/^\(\d+\)\s*/, '').replace(/\s*[-–]\s*YouTube( Music)?$/, '').trim();

/** Title of what is playing, or null if nothing real is loaded. Never invented. */
export function currentTitle(video: HTMLVideoElement | null): string | null {
  if (!video || !video.currentSrc || !(video.duration > 0)) return null;
  const media = navigator.mediaSession?.metadata?.title;
  if (media) return media;
  const t = cleanTitle(document.title);
  const lower = t.toLowerCase();
  return t && lower !== 'youtube' && lower !== 'youtube music' ? t : null;
}

export function isPlaying(video: HTMLVideoElement | null): boolean {
  return !!video && !video.paused && !video.ended && video.readyState > 2;
}

/** Fires `cb` on YouTube's single-page navigation events. Returns a cleanup function. */
export function onNavigate(cb: () => void): () => void {
  const events = ['yt-navigate-finish', 'yt-page-data-updated', 'popstate'];
  for (const e of events) document.addEventListener(e, cb);
  return () => {
    for (const e of events) document.removeEventListener(e, cb);
  };
}
