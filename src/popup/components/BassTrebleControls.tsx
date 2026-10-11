import type { ReactNode } from 'react';
import { TONE_MAX, TONE_MIN } from '../../shared/types';
import { useStore } from '../store';
import { Slider } from './Slider';
import { ControlRow, SectionTitle } from './ui';

const fmt = (v: number): string => (v === 0 ? '0 dB' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} dB`);

export function BassTrebleControls(): ReactNode {
  const { settings, setBass, setTreble } = useStore();
  return (
    <section aria-label="Bass and treble">
      <SectionTitle right={<span className="text-[11px] text-muted">Double-click to center</span>}>Tone</SectionTitle>
      <div className="surface-card rounded-2xl px-3.5 py-2.5">
        <ControlRow label="Bass" readout={fmt(settings.bass)}>
          <Slider orientation="horizontal" label="Bass" min={TONE_MIN} max={TONE_MAX} step={0.5} origin={0} value={settings.bass} valueText={fmt} onChange={setBass} />
        </ControlRow>
        <ControlRow label="Treble" readout={fmt(settings.treble)}>
          <Slider orientation="horizontal" label="Treble" min={TONE_MIN} max={TONE_MAX} step={0.5} origin={0} value={settings.treble} valueText={fmt} onChange={setTreble} />
        </ControlRow>
        <p className="mt-0.5 text-[11px] leading-snug text-muted">
          Shelving filters at 120 Hz and 6 kHz. Boosts are balanced automatically so the volume stays safe.
        </p>
      </div>
    </section>
  );
}
