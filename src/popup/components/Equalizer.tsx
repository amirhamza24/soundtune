import { RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { presetLabel } from '../../shared/presets';
import { EQ_FREQUENCIES, GAIN_MAX, GAIN_MIN } from '../../shared/types';
import { useStore } from '../store';
import { SavePreset } from './SavePreset';
import { Slider } from './Slider';
import { Button, SectionTitle, Toggle } from './ui';

const freqLabel = (f: number): string => (f >= 1000 ? `${f / 1000}k` : String(f));
const dbText = (v: number): string => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)} dB`;

export function Equalizer(): ReactNode {
  const { settings, setBand, setEqEnabled, resetBands } = useStore();
  const on = settings.eqEnabled;
  const flat = settings.bands.every((b) => b === 0);

  return (
    <section aria-label="10 band equalizer">
      <SectionTitle
        right={
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted">{on ? 'On' : 'Off'}</span>
            <Toggle size="sm" checked={on} onChange={setEqEnabled} label="Enable equalizer" />
          </div>
        }
      >
        Equalizer
      </SectionTitle>

      <div className="surface-card rounded-2xl px-2 pb-2.5 pt-3">
        <div className="mb-2 flex items-center justify-between px-1.5">
          <span className="truncate text-xs text-muted">
            Preset: <span className="font-medium text-soft">{presetLabel(settings.presetId, settings.customPresets)}</span>
          </span>
          <Button variant="ghost" onClick={resetBands} disabled={flat} aria-label="Reset equalizer to flat">
            <RotateCcw size={13} /> Reset
          </Button>
        </div>

        <div className={`relative flex justify-between transition-opacity duration-300 ${on ? 'opacity-100' : 'opacity-45'}`}>
          {/* dB scale */}
          <div className="pointer-events-none absolute inset-x-1 top-0 h-full" aria-hidden="true">
            {[28, 130, 232].map((top) => (
              <div key={top} className={`absolute inset-x-0 h-px ${top === 130 ? 'bg-line-strong' : 'bg-line/60'}`} style={{ top }} />
            ))}
          </div>
          {EQ_FREQUENCIES.map((f, i) => {
            const v = settings.bands[i] ?? 0;
            return (
              <div key={f} className="relative flex w-10 flex-col items-center">
                <span
                  className={`mb-1 h-4 font-mono text-[11px] tabular-nums transition-colors duration-200 ${v > 0 ? 'text-bright' : v < 0 ? 'text-cool' : 'text-muted'}`}
                >
                  {v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(v % 1 === 0 ? 0 : 1)}`}
                </span>
                <Slider
                  orientation="vertical"
                  length={240}
                  label={`${freqLabel(f)} Hz`}
                  min={GAIN_MIN}
                  max={GAIN_MAX}
                  step={0.5}
                  origin={0}
                  value={v}
                  valueText={dbText}
                  onChange={(nv) => setBand(i, nv)}
                />
                <span className="mt-1 text-[11px] font-medium text-muted">{freqLabel(f)}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-1.5 text-center text-[11px] text-muted">
          Hz · −12 to +12 dB · double-click a band to reset · arrow keys fine-tune
        </p>
      </div>

      <div className="mt-3">
        <SavePreset />
      </div>
    </section>
  );
}
