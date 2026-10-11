import { Pause, Power, Radio } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLive } from '../live';


export type PlayMode = 'live' | 'paused' | 'blocked' | 'off' | 'none';

export interface PlayInfo {
  mode: PlayMode;
  /** true when real spectrum frames are flowing and the visuals should move */
  animated: boolean;
  label: string;
  hint: string;
  Icon: LucideIcon;
}

/** One place that decides what the user should be told about the music/animation state. */
export function usePlayInfo(): PlayInfo {
  const { link } = useLive();
  const st = link.kind === 'connected' ? link.status : null;
  if (!st || st.engine === 'no-video') {
    return { mode: 'none', animated: false, label: 'Nothing playing', hint: 'Open a YouTube video and press play.', Icon: Radio };
  }
  if (st.engine === 'off') {
    return { mode: 'off', animated: false, label: 'Processing is off', hint: 'Turn the power switch on (top right) to see the live spectrum.', Icon: Power };
  }
  if (st.engine === 'blocked' || st.engine === 'error') {
    return { mode: 'blocked', animated: false, label: 'Waiting for audio access', hint: 'Click once on the YouTube page, then the animation starts.', Icon: Radio };
  }
  if (!st.playing) {
    return { mode: 'paused', animated: false, label: 'Paused', hint: 'Press play on YouTube and the visualizer comes alive.', Icon: Pause };
  }
  return { mode: 'live', animated: true, label: 'LIVE · Playing', hint: '', Icon: Radio };
}

const TONE: Record<PlayMode, string> = {
  live: 'border-ok/40 bg-ok/10 text-ok',
  paused: 'border-line-strong bg-black/40 text-soft',
  blocked: 'border-[#fcd34d]/40 bg-[#fcd34d]/10 text-[#fde68a]',
  off: 'border-line-strong bg-black/40 text-muted',
  none: 'border-line bg-black/40 text-muted',
};

/** Small status chip; the bars dance only while real audio is playing. */
export function PlayBadge({ className = '' }: { className?: string }): ReactNode {
  const info = usePlayInfo();
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide backdrop-blur transition-colors duration-300 ${TONE[info.mode]} ${className}`}
    >
      {info.mode === 'live' ? (
        <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="eq-bar w-[3px] rounded-full bg-ok" style={{ height: '100%', animationDelay: `${i * 120}ms` }} />
          ))}
        </span>
      ) : (
        <info.Icon size={12} aria-hidden="true" />
      )}
      {info.label}
    </span>
  );
}
