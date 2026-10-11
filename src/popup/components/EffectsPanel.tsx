import { AudioWaveform, Gauge, MoveHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { useStore } from '../store';
import { Slider } from './Slider';
import { ControlRow, SectionTitle, Toggle } from './ui';

function EffectCard({ icon, title, blurb, enabled, onToggle, children }: { icon: ReactNode; title: string; blurb: string; enabled: boolean; onToggle: (v: boolean) => void; children: ReactNode }): ReactNode {
  return (
    <div className={`surface-card rounded-2xl px-3.5 py-3 transition-[border-color,box-shadow] duration-300 ${enabled ? '!border-bright/40 shadow-[0_10px_30px_-18px_rgb(139_92_246/0.8)]' : ''}`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid size-8 place-items-center rounded-lg transition-colors duration-200 ${enabled ? 'bg-accent text-white' : 'bg-interactive text-bright'}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold">{title}</h3>
          <p className="text-[11px] leading-snug text-muted">{blurb}</p>
        </div>
        <Toggle size="sm" checked={enabled} onChange={onToggle} label={`Enable ${title}`} />
      </div>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-[260ms] ease-[var(--ease)] ${enabled ? 'mt-1.5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
        aria-hidden={!enabled}
      >
        <div className="overflow-hidden">
          <div className="pt-1" inert={!enabled}>{children}</div>
        </div>
      </div>
    </div>
  );
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;

export function EffectsPanel(): ReactNode {
  const { settings, patchEffects } = useStore();
  const { reverb, stereo, compressor } = settings.effects;
  return (
    <section aria-label="Audio effects" className="flex flex-col gap-3">
      <SectionTitle>Effects</SectionTitle>

      <EffectCard
        icon={<AudioWaveform size={16} />}
        title="Reverb"
        blurb="Adds a synthetic room around the sound."
        enabled={reverb.enabled}
        onToggle={(enabled) => patchEffects({ reverb: { enabled } })}
      >
        <ControlRow label="Mix" readout={pct(reverb.mix)}>
          <Slider orientation="horizontal" label="Reverb mix" min={0} max={1} step={0.05} origin={0} defaultValue={0.25} value={reverb.mix} valueText={pct} onChange={(mix) => patchEffects({ reverb: { mix } })} />
        </ControlRow>
        <ControlRow label="Decay" readout={`${reverb.decay.toFixed(1)} s`}>
          <Slider orientation="horizontal" label="Reverb decay" min={0.5} max={4} step={0.1} origin={0.5} defaultValue={2} value={reverb.decay} valueText={(v) => `${v.toFixed(1)} seconds`} onChange={(decay) => patchEffects({ reverb: { decay } })} />
        </ControlRow>
      </EffectCard>

      <EffectCard
        icon={<MoveHorizontal size={16} />}
        title="Stereo Width"
        blurb="Scales the left/right difference. Not surround sound."
        enabled={stereo.enabled}
        onToggle={(enabled) => patchEffects({ stereo: { enabled } })}
      >
        <ControlRow label="Width" readout={pct(stereo.width)} hint="100% = original · 0% = mono · the mono mix is never altered">
          <Slider orientation="horizontal" label="Stereo width" min={0} max={2} step={0.05} origin={1} defaultValue={1} value={stereo.width} valueText={pct} onChange={(width) => patchEffects({ stereo: { width } })} />
        </ControlRow>
      </EffectCard>

      <EffectCard
        icon={<Gauge size={16} />}
        title="Compressor"
        blurb="Evens out loud and quiet parts."
        enabled={compressor.enabled}
        onToggle={(enabled) => patchEffects({ compressor: { enabled } })}
      >
        <ControlRow label="Amount" readout={pct(compressor.amount)}>
          <Slider orientation="horizontal" label="Compressor amount" min={0} max={1} step={0.05} origin={0} defaultValue={0.5} value={compressor.amount} valueText={pct} onChange={(amount) => patchEffects({ compressor: { amount } })} />
        </ControlRow>
      </EffectCard>

      <p className="px-1 text-[11px] leading-snug text-muted">A safety limiter always protects the output from clipping.</p>
    </section>
  );
}
