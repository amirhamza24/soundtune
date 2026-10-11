import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import { PORT_NAME, SPECTRUM_BARS } from '../shared/messages';
import type { ContentToPopup, PlaybackStatus, PopupToContent } from '../shared/messages';

const YT_PATTERNS = ['https://www.youtube.com/*', 'https://music.youtube.com/*'];

export type Link =
  | { kind: 'searching' }
  | { kind: 'no-tab' }
  | { kind: 'stale'; tabId: number } // tab open, but its content script is gone/never loaded: reload needed
  | { kind: 'connected'; tabId: number; status: PlaybackStatus | null };

export interface Live {
  link: Link;
  /** Latest processed-audio spectrum (0..255 per bar). Updated outside React for 30 fps drawing. */
  spectrum: MutableRefObject<number[]>;
  /** performance.now() of the last spectrum frame. */
  lastFrameAt: MutableRefObject<number>;
  resume: () => void;
  reloadTab: () => void;
  openYouTube: () => void;
}

const Ctx = createContext<Live | null>(null);

export function useLive(): Live {
  const v = useContext(Ctx);
  if (!v) throw new Error('LiveProvider missing');
  return v;
}

/** Prefers an audible YouTube tab, then the active one, then any. */
async function pickTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ url: YT_PATTERNS });
  if (tabs.length === 0) return null;
  return tabs.find((t) => t.audible) ?? tabs.find((t) => t.active) ?? tabs[0] ?? null;
}

export function LiveProvider({ children }: { children: ReactNode }): ReactNode {
  const [link, setLink] = useState<Link>({ kind: 'searching' });
  const spectrum = useRef<number[]>(new Array<number>(SPECTRUM_BARS).fill(0));
  const lastFrameAt = useRef(0);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const attempt = useRef(0);

  useEffect(() => {
    let alive = true;
    let retry: number | null = null;

    const connect = async (): Promise<void> => {
      const tab = await pickTab().catch(() => null);
      if (!alive) return;
      if (!tab || tab.id === undefined) {
        setLink({ kind: 'no-tab' });
        retry = window.setTimeout(() => void connect(), 2000);
        return;
      }
      const tabId = tab.id;
      let gotMessage = false;
      let port: chrome.runtime.Port;
      try {
        port = chrome.tabs.connect(tabId, { name: PORT_NAME });
      } catch {
        setLink({ kind: 'stale', tabId });
        return;
      }
      portRef.current = port;
      attempt.current += 1;
      setLink({ kind: 'connected', tabId, status: null });
      port.onMessage.addListener((msg: ContentToPopup) => {
        gotMessage = true;
        if (msg.type === 'status') setLink({ kind: 'connected', tabId, status: msg.status });
        else {
          spectrum.current = msg.bars;
          lastFrameAt.current = performance.now();
        }
      });
      port.onDisconnect.addListener(() => {
        void chrome.runtime.lastError; // read to silence "no receiving end"
        if (portRef.current === port) portRef.current = null;
        if (!alive) return;
        if (!gotMessage) setLink({ kind: 'stale', tabId });
        else retry = window.setTimeout(() => void connect(), 800); // tab navigated/closed: look again
      });
    };

    void connect();
    return () => {
      alive = false;
      if (retry !== null) window.clearTimeout(retry);
      portRef.current?.disconnect();
      portRef.current = null;
    };
  }, []);

  const resume = useCallback((): void => {
    const msg: PopupToContent = { type: 'resume' };
    try {
      portRef.current?.postMessage(msg);
    } catch {
      /* port closed */
    }
  }, []);

  const value = useMemo<Live>(
    () => ({
      link,
      spectrum,
      lastFrameAt,
      resume,
      reloadTab: () => {
        if (link.kind === 'stale' || link.kind === 'connected') void chrome.tabs.reload(link.tabId);
      },
      openYouTube: () => {
        void chrome.tabs.create({ url: 'https://www.youtube.com/' });
      },
    }),
    [link, resume],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
