import { ExternalLink, Maximize2, RefreshCw } from 'lucide-react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import type { VizState } from '../viz/renderers';
import type { EngineState, PlaybackStatus } from '../../shared/messages';
import { useLive } from '../live';
import { useStore } from '../store';
import { AudioVisualizer } from './AudioVisualizer';
import { PlayBadge } from './PlayBadge';
import { Button } from './ui';


function MiniBars({ playing }: { playing: boolean }): ReactNode {
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full bg-bright ${playing ? 'eq-bar' : ''}`}
          style={{ height: '100%', animationDelay: `${i * 130}ms`, transform: playing ? undefined : 'scaleY(0.3)', transformOrigin: 'bottom' }}
        />
      ))}
    </span>
  );
}

const ENGINE_TEXT: Record<EngineState, { text: string; tone: 'ok' | 'muted' | 'warn' | 'err' }> = {
  active: { text: 'Processing audio', tone: 'ok' },
  bypassed: { text: 'Processing off · original sound', tone: 'muted' },
  off: { text: 'Processing off', tone: 'muted' },
  blocked: { text: 'Waiting for audio access', tone: 'warn' },
  'no-video': { text: 'No video on this page', tone: 'muted' },
  error: { text: 'Audio engine error', tone: 'err' },
};

const TONE_CLASS = { ok: 'text-ok', muted: 'text-muted', warn: 'text-[#fcd34d]', err: 'text-err' } as const;

function Shell({ children, viz }: { children: ReactNode; viz?: ReactNode }): ReactNode {
  return (
    <section aria-label="Current playback" className="surface-card relative overflow-hidden rounded-2xl">
      <div className="pointer-events-none absolute -right-10 -top-14 size-36 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative px-3.5 pt-3">{children}</div>
      {viz}
    </section>
  );
}

export function NowPlaying({ onOpenViz }: { onOpenViz: () => void }): ReactNode {
  const { link, resume, reloadTab, openYouTube } = useLive();
  const { settings } = useStore();
  const box = useRef<HTMLDivElement>(null);
  /** Beat-synced glow around the preview so it is obvious the music is driving it. */
  const onFrame = (s: VizState, fresh: boolean): void => {
    const el = box.current;
    if (!el) return;
    const k = fresh ? Math.min(1, s.beat * 0.8 + s.energy * 0.6) : 0;
    el.style.boxShadow = `0 0 ${10 + k * 36}px rgba(139,92,246,${0.1 + k * 0.5})`;
    el.style.borderColor = `rgba(167,139,250,${0.14 + k * 0.5})`;
  };

  if (link.kind === 'searching') {
    return (
      <Shell>
        <div className="skeleton mb-2 h-4 w-3/4 rounded" />
        <div className="skeleton mb-3 h-3 w-1/2 rounded" />
        <div className="h-44" />
      </Shell>
    );
  }

  if (link.kind === 'no-tab') {
    return (
      <Shell>
        <div className="flex items-center gap-3 pb-3.5">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-interactive text-bright">
            <MiniBars playing={false} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">No YouTube tab found</p>
            <p className="text-xs text-muted">Open a YouTube video and this equalizer will shape its sound.</p>
          </div>
          <Button variant="primary" onClick={openYouTube}>
            <ExternalLink size={13} /> Open
          </Button>
        </div>
      </Shell>
    );
  }

  if (link.kind === 'stale') {
    return (
      <Shell>
        <div className="flex items-center gap-3 pb-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Reload the YouTube tab</p>
            <p className="text-xs text-muted">The tab was opened before Violet Audio was installed or updated.</p>
          </div>
          <Button variant="primary" onClick={reloadTab}>
            <RefreshCw size={13} /> Reload
          </Button>
        </div>
      </Shell>
    );
  }

  const st: PlaybackStatus | null = link.status;
  if (!st) {
    return (
      <Shell>
        <div className="skeleton mb-2 h-4 w-3/4 rounded" />
        <div className="skeleton mb-3 h-3 w-1/2 rounded" />
        <div className="h-44" />
      </Shell>
    );
  }

  const eng = ENGINE_TEXT[st.engine];
  const hasVideo = st.engine !== 'no-video';
  const stateLabel = !hasVideo ? 'Idle' : st.playing ? 'Playing' : 'Paused';

  return (
    <Shell
      viz={
        settings.visualizer.enabled ? (
          <div ref={box} className="relative mx-3.5 mb-3.5 mt-3 h-44 overflow-hidden rounded-xl border border-line bg-black/30 transition-[border-color] duration-300">
            <AudioVisualizer style={settings.visualizer.style} theme={settings.visualizer.theme} sensitivity={settings.visualizer.sensitivity} active={(st.engine === 'active' || st.engine === 'bypassed') && st.playing} onFrame={onFrame} />
            <PlayBadge className="absolute left-2 top-2" />
            <button
              type="button"
              onClick={onOpenViz}
              className="absolute right-2 top-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-black/45 px-2.5 py-1.5 text-xs font-medium text-fg backdrop-blur transition-[background,transform] duration-200 hover:bg-accent/40 active:scale-95"
            >
              <Maximize2 size={13} /> Full screen visualizer
            </button>
          </div>
        ) : (
          <div className="px-3.5 pb-3.5 pt-2">
            <Button onClick={onOpenViz}><Maximize2 size={13} /> Open full screen visualizer</Button>
          </div>
        )
      }
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-interactive">
          <MiniBars playing={st.playing && hasVideo} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={st.title ?? undefined}>
            {st.title ?? (hasVideo ? 'Nothing loaded yet' : 'Open a video to begin')}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs">
            <span className="text-muted">{stateLabel}</span>
            <span className="text-muted/50">•</span>
            <span className={TONE_CLASS[eng.tone]}>{eng.text}</span>
          </p>
        </div>
        {st.engine === 'blocked' ? (
          <Button onClick={resume} className="shrink-0">Retry</Button>
        ) : null}
      </div>
      {st.engine === 'blocked' ? (
        <p className="anim-fade-up mt-2 rounded-lg bg-[#fcd34d]/10 px-2.5 py-1.5 text-[11px] leading-snug text-[#fde68a]">
          Chrome needs a click on the YouTube page before audio can be processed. Click the page (or press play), then it starts automatically.
        </p>
      ) : null}
      {st.engine === 'error' ? (
        <div className="anim-fade-up mt-2 flex items-center gap-3 rounded-lg bg-err/10 px-3 py-2 text-xs leading-snug text-err">
          <p className="flex-1">
            {/already connected/i.test(st.detail ?? '')
              ? 'This YouTube tab still holds the audio of an older copy of the extension (the extension was reloaded or updated). Reload the tab once to fix it.'
              : (st.detail ?? 'Could not connect to the video audio.')}
          </p>
          <Button variant="primary" onClick={reloadTab} className="shrink-0"><RefreshCw size={13} /> Reload tab</Button>
        </div>
      ) : null}
    </Shell>
  );
}
