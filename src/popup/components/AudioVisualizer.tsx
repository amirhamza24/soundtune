import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { SPECTRUM_BARS } from '../../shared/messages';
import type { VisualizerStyle, VisualizerTheme } from '../../shared/types';
import { useLive } from '../live';
import { THEMES, VizState, rgba } from '../viz/renderers';
import type { Theme } from '../viz/renderers';
import { RENDERERS } from '../viz/registry';

/** Calm "waiting for music" cue: a thin line with a soft light sweeping along it. Not audio data. */
function drawStandby(g: CanvasRenderingContext2D, s: VizState, th: Theme, now: number, reduce: boolean): void {
  const y = s.h - 3;
  g.fillStyle = rgba(th.c1, 0.18);
  g.fillRect(0, y, s.w, 1.5);
  if (reduce) return;
  const x = (((now / 2600) % 1.3) - 0.15) * s.w;
  const gr = g.createLinearGradient(x - 120, 0, x + 120, 0);
  gr.addColorStop(0, rgba(th.c2, 0));
  gr.addColorStop(0.5, rgba(th.c2, 0.85));
  gr.addColorStop(1, rgba(th.c2, 0));
  g.fillStyle = gr;
  g.fillRect(x - 120, y - 0.5, 240, 2.5);
}

interface Props {
  style: VisualizerStyle;
  theme: VisualizerTheme;
  sensitivity: number;
  /** True while audio is really flowing through the engine. */
  active: boolean;
  className?: string;
  /** Called every frame with the animation state (beat/energy) for outer glow effects. */
  onFrame?: (s: VizState, fresh: boolean) => void;
}

/**
 * Canvas fills its parent. Frames are the real spectrum of the processed output; when frames
 * stop (paused / not processing) all levels decay to zero and the renderers show their idle look.
 */
export function AudioVisualizer({ style, theme, sensitivity, active, className = '', onFrame }: Props): ReactNode {
  const { spectrum, lastFrameAt } = useLive();
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ style, theme, sensitivity, active, onFrame });
  live.current = { style, theme, sensitivity, active, onFrame };

  useEffect(() => {
    const el = canvas.current;
    const g = el?.getContext('2d');
    if (!el || !g) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const state = new VizState(SPECTRUM_BARS);
    let dpr = 1;

    const resize = (): void => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === 0 || h === 0) return;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      state.w = w;
      state.h = h;
      state.stars = null;
      state.dotGrid = null;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (state.w === 0) return;
      const cfg = live.current;
      const fresh = cfg.active && now - lastFrameAt.current < 250;
      state.update(spectrum.current, dt, cfg.sensitivity, fresh, reduce);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, state.w, state.h);
      RENDERERS[cfg.style](g, state, THEMES[cfg.theme]);
      if (!fresh) drawStandby(g, state, THEMES[cfg.theme], now, reduce);
      cfg.onFrame?.(state, fresh);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [spectrum, lastFrameAt]);

  return <canvas ref={canvas} aria-hidden="true" className={`block h-full w-full ${className}`} />;
}
