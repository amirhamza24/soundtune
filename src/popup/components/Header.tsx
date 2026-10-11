import { Settings as SettingsIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLive } from '../live';
import { useStore } from '../store';
import { IconButton, Toggle, Tooltip } from './ui';

export function Logo({ size = 30 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="vg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#vg)" />
      {[
        [7, 12, 8],
        [11.5, 8, 16],
        [16, 5, 22],
        [20.5, 9, 14],
        [25, 12.5, 7],
      ].map(([x, y, h]) => (
        <rect key={x} x={(x ?? 0) - 1.2} y={y} width="2.4" height={h} rx="1.2" fill="#f5f3ff" opacity={0.95} />
      ))}
    </svg>
  );
}

export function Header({ onSettings, settingsActive }: { onSettings: () => void; settingsActive: boolean }): ReactNode {
  const { settings, setEnabled } = useStore();
  const { link } = useLive();
  const st = link.kind === 'connected' ? link.status : null;
  const live = st?.engine === 'active' && st.playing;
  const dot = live ? 'bg-ok' : st?.engine === 'blocked' || st?.engine === 'error' ? 'bg-[#fcd34d]' : 'bg-muted/60';
  const label = live ? 'Processing live audio' : st?.engine === 'active' ? 'Ready · paused' : link.kind === 'connected' ? 'Connected' : 'No active playback';

  return (
    <header className="flex h-[76px] shrink-0 items-center gap-3">
      <Logo size={36} />
      <div className="min-w-0 flex-1 leading-tight">
        <h1 className="text-lg font-semibold tracking-tight">Violet Audio</h1>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <span className={`relative size-1.5 rounded-full transition-colors duration-300 ${dot} ${live ? 'animate-[pulse-ring_1.6s_ease-out_infinite]' : ''}`} />
          {label}
        </p>
      </div>
      <Tooltip text={settings.enabled ? 'Audio processing on' : 'Audio processing off'}>
        <Toggle checked={settings.enabled} onChange={setEnabled} label="Enable audio processing" />
      </Tooltip>
      <IconButton label="Settings" onClick={onSettings} active={settingsActive}>
        <SettingsIcon size={17} />
      </IconButton>
    </header>
  );
}
