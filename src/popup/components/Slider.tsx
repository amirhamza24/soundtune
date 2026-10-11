import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  /** Value where the filled part of the track starts (0 for bipolar sliders). */
  origin?: number;
  /** Value restored by double click / Backspace. */
  defaultValue?: number;
  orientation: 'horizontal' | 'vertical';
  label: string;
  valueText: (v: number) => string;
  onChange: (v: number) => void;
  /** Length of the track in px (height when vertical). */
  length?: number;
  disabled?: boolean;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Custom range slider (native vertical range inputs are inconsistent in Chromium).
 * Pointer capture keeps dragging smooth outside the track; full keyboard support follows the
 * WAI-ARIA slider pattern (arrows, PageUp/PageDown, Home/End).
 */
export function Slider({
  value, min, max, step, origin = min, defaultValue = origin, orientation, label, valueText, onChange, length, disabled,
}: SliderProps): ReactNode {
  const track = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const vertical = orientation === 'vertical';

  const pct = (v: number): number => ((clamp(v, min, max) - min) / (max - min)) * 100;
  const from = Math.min(pct(origin), pct(value));
  const to = Math.max(pct(origin), pct(value));
  const positive = value >= origin;

  const fromPointer = (e: PointerEvent): void => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = vertical ? 1 - (e.clientY - rect.top) / rect.height : (e.clientX - rect.left) / rect.width;
    const raw = min + clamp(ratio, 0, 1) * (max - min);
    const snapped = Math.round(raw / step) * step;
    const next = clamp(Number(snapped.toFixed(4)), min, max);
    if (next !== value) onChange(next);
  };

  const onKey = (e: KeyboardEvent): void => {
    const big = step * 4;
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowUp': case 'ArrowRight': next = value + step; break;
      case 'ArrowDown': case 'ArrowLeft': next = value - step; break;
      case 'PageUp': next = value + big; break;
      case 'PageDown': next = value - big; break;
      case 'Home': next = min; break;
      case 'End': next = max; break;
      case 'Backspace': case 'Delete': next = defaultValue; break;
      default: return;
    }
    e.preventDefault();
    onChange(clamp(Number(next.toFixed(4)), min, max));
  };

  const thick = 'bg-interactive';
  const fillStyle = vertical
    ? { bottom: `${from}%`, height: `${to - from}%` }
    : { left: `${from}%`, width: `${to - from}%` };
  const thumbStyle = vertical ? { bottom: `${pct(value)}%` } : { left: `${pct(value)}%` };
  const originStyle = vertical ? { bottom: `${pct(origin)}%` } : { left: `${pct(origin)}%` };

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText(value)}
      aria-disabled={disabled}
      onKeyDown={disabled ? undefined : onKey}
      onDoubleClick={disabled ? undefined : () => onChange(defaultValue)}
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
        fromPointer(e);
      }}
      onPointerMove={(e) => dragging && fromPointer(e)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      className={`group relative touch-none select-none outline-none ${vertical ? 'w-9' : 'h-7 w-full'} ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
      style={vertical ? { height: length ?? 150 } : undefined}
    >
      <div
        ref={track}
        className={`absolute rounded-full ${thick} ${vertical ? 'left-1/2 top-2 bottom-2 w-1.5 -translate-x-1/2' : 'top-1/2 left-2 right-2 h-1.5 -translate-y-1/2'}`}
      >
        {/* neutral mark */}
        <div
          className={`absolute bg-soft/60 ${vertical ? '-left-1.5 h-px w-[calc(100%+12px)]' : '-top-1.5 h-[calc(100%+12px)] w-px'}`}
          style={originStyle}
        />
        <div
          className={`absolute rounded-full ${vertical ? 'inset-x-0' : 'inset-y-0'} ${positive ? 'bg-gradient-to-t from-accent to-bright' : 'bg-gradient-to-b from-cool/80 to-[#6d78d6]'}`}
          style={{ ...fillStyle, transition: dragging ? 'none' : 'all 120ms var(--ease)' }}
        />
        <div
          className={`absolute size-4 rounded-full border border-soft/70 bg-fg ${vertical ? 'left-1/2 translate-y-1/2 -translate-x-1/2' : 'top-1/2 -translate-y-1/2 -translate-x-1/2'} ${dragging ? 'scale-110 knob-glow' : 'group-hover:knob-glow'} group-focus-visible:ring-2 group-focus-visible:ring-bright group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg`}
          style={{ ...thumbStyle, transition: dragging ? 'transform 120ms var(--ease)' : 'all 120ms var(--ease)' }}
        />
      </div>
    </div>
  );
}
