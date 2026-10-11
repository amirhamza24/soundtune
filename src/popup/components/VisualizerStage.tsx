import { Expand, Minimize, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { VizState } from '../viz/renderers';
import { VIZ_STYLES, VIZ_THEMES } from '../../shared/types';
import type { VisualizerStyle } from '../../shared/types';
import { useLive } from '../live';
import { useStore } from '../store';
import { THEMES, rgba } from '../viz/renderers';
import { STYLE_LABELS } from '../viz/registry';
import { AudioVisualizer } from './AudioVisualizer';
import { PlayBadge, usePlayInfo } from './PlayBadge';
import { Slider } from './Slider';

/** Full-screen visualizer overlay: 9 styles, 5 colour themes, sensitivity. Esc closes. */
export function VisualizerStage({ onClose }: { onClose: () => void }): ReactNode {
  const { settings, setVisualizer } = useStore();
  const { link } = useLive();
  const st = link.kind === 'connected' ? link.status : null;
  const info = usePlayInfo();
  const active = info.animated;
  const glow = useRef<HTMLDivElement>(null);
  const onFrame = useCallback((s: VizState, fresh: boolean): void => {
    if (glow.current) glow.current.style.opacity = String(fresh ? 0.55 + Math.min(0.45, s.beat * 0.5 + s.energy * 0.5) : 0.35);
  }, []);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [fs, setFs] = useState(!!document.fullscreenElement);
  const idle = useRef<number | null>(null);
  const wasFs = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const viz = settings.visualizer;

  const poke = useCallback((): void => {
    setChromeVisible(true);
    if (idle.current !== null) window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => setChromeVisible(false), 3200);
  }, []);

  const cycle = useCallback(
    (d: number): void => {
      const i = VIZ_STYLES.indexOf(viz.style);
      setVisualizer({ style: VIZ_STYLES[(i + d + VIZ_STYLES.length) % VIZ_STYLES.length] as VisualizerStyle });
    },
    [viz.style, setVisualizer],
  );

  const toggleFs = useCallback((): void => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen().catch(() => undefined);
  }, []);

  useEffect(() => {
    poke();
    // Entering from a click, so the browser allows real fullscreen.
    void root.current?.requestFullscreen().catch(() => undefined);
    const onFs = (): void => {
      const now = !!document.fullscreenElement;
      setFs(now);
      if (now) wasFs.current = true;
      else if (wasFs.current) onClose(); // Esc in fullscreen leaves the overlay too
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      if (idle.current !== null) window.clearTimeout(idle.current);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      poke();
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') cycle(1);
      else if (e.key === 'ArrowLeft') cycle(-1);
      else if (e.key === 'f' || e.key === 'F') toggleFs();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [poke, cycle, onClose, toggleFs]);

  const th = THEMES[viz.theme];

  return (
    <motion.div
      ref={root}
      role="dialog"
      aria-label="Full screen visualizer"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-hidden bg-[#06050c]"
      style={{ cursor: chromeVisible ? 'default' : 'none' }}
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      onPointerMove={poke}
    >
      <div className="absolute inset-0" style={{ background: `radial-gradient(70% 60% at 50% 55%, ${rgba(th.c0, 0.35)}, transparent 70%)` }} />
      <div className="absolute inset-0">
        <AudioVisualizer style={viz.style} theme={viz.theme} sensitivity={viz.sensitivity} active={active} onFrame={onFrame} />
      </div>

      <AnimatePresence>
        {!active ? (
          <motion.div
            key={info.mode}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-x-0 top-[38%] mx-auto flex w-[min(90vw,420px)] flex-col items-center gap-3 rounded-3xl border border-line-strong bg-black/45 px-8 py-7 text-center backdrop-blur-md"
          >
            <motion.span animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} className="grid size-14 place-items-center rounded-full bg-accent/25 text-bright">
              <info.Icon size={26} />
            </motion.span>
            <p className="text-lg font-semibold">{info.label}</p>
            <p className="text-sm text-muted">{info.hint}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        className="absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/60 to-transparent px-6 py-4"
        animate={{ opacity: chromeVisible ? 1 : 0, y: chromeVisible ? 0 : -12 }}
        transition={{ duration: 0.3 }}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{st?.title ?? 'Violet Audio'}</p>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted"><PlayBadge /> <span>{STYLE_LABELS[viz.style]}</span></p>
        </div>
        <button type="button" onClick={toggleFs} aria-label={fs ? 'Exit full screen' : 'Enter full screen'} className="grid size-10 cursor-pointer place-items-center rounded-xl border border-line bg-black/30 text-fg backdrop-blur transition-colors hover:bg-interactive">
          {fs ? <Minimize size={18} /> : <Expand size={18} />}
        </button>
        <button type="button" onClick={onClose} aria-label="Close visualizer" className="grid size-10 cursor-pointer place-items-center rounded-xl border border-line bg-black/30 text-fg backdrop-blur transition-colors hover:bg-interactive">
          <X size={18} />
        </button>
      </motion.div>

      <motion.div
        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-6 pb-6 pt-14"
        animate={{ opacity: chromeVisible ? 1 : 0, y: chromeVisible ? 0 : 16 }}
        transition={{ duration: 0.3 }}
        style={{ pointerEvents: chromeVisible ? 'auto' : 'none' }}
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4">
          <div role="radiogroup" aria-label="Visualizer style" className="flex max-w-full flex-wrap justify-center gap-2">
            {VIZ_STYLES.map((s) => {
              const on = s === viz.style;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setVisualizer({ style: s })}
                  className={`relative cursor-pointer rounded-full border px-4 py-1.5 text-xs font-medium transition-colors duration-200 ${on ? 'border-transparent text-white' : 'border-line bg-black/30 text-muted backdrop-blur hover:text-fg'}`}
                >
                  {on ? <motion.span layoutId="viz-style-pill" className="absolute inset-0 rounded-full bg-gradient-to-r from-accent to-[#7c3aed] shadow-[0_0_18px_rgb(139_92_246/0.6)]" transition={{ type: 'spring', stiffness: 420, damping: 34 }} /> : null}
                  <span className="relative">{STYLE_LABELS[s]}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div role="radiogroup" aria-label="Colour theme" className="flex items-center gap-2">
              <span className="text-xs text-muted">Theme</span>
              {VIZ_THEMES.map((t) => (
                <motion.button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={t === viz.theme}
                  aria-label={t}
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setVisualizer({ theme: t })}
                  className={`size-6 cursor-pointer rounded-full border-2 ${t === viz.theme ? 'border-white' : 'border-transparent'}`}
                  style={{ background: `linear-gradient(135deg, ${rgba(THEMES[t].c1)}, ${rgba(THEMES[t].c2)})` }}
                />
              ))}
            </div>
            <div className="flex w-52 items-center gap-3">
              <span className="text-xs text-muted">Sensitivity</span>
              <Slider orientation="horizontal" label="Visualizer sensitivity" min={0.5} max={2} step={0.1} origin={0.5} defaultValue={1} value={viz.sensitivity} valueText={(v) => `${Math.round(v * 100)}%`} onChange={(sensitivity) => setVisualizer({ sensitivity })} />
            </div>
            <span className="hidden text-[11px] text-muted md:inline">← → change style · F fullscreen · Esc close</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
