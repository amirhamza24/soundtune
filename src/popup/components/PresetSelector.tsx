import { Check, Gem, Mic, Orbit, SlidersHorizontal, Waves, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { BUILT_IN_PRESETS, customPresetKey } from '../../shared/presets';
import type { BuiltInPreset, PresetIconName } from '../../shared/presets';
import { useStore } from '../store';
import { SavePreset } from './SavePreset';
import { SectionTitle } from './ui';

const ICONS: Record<PresetIconName, LucideIcon> = {
  waves: Waves,
  gem: Gem,
  mic: Mic,
  zap: Zap,
  orbit: Orbit,
  sliders: SlidersHorizontal,
};

function PresetCard({ preset, selected, hero, onSelect }: { preset: BuiltInPreset; selected: boolean; hero?: boolean; onSelect: () => void }): ReactNode {
  const Icon = ICONS[preset.icon];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={preset.description}
      className={`group relative flex h-full w-full cursor-pointer overflow-hidden rounded-xl border text-left transition-[transform,border-color,background,box-shadow] duration-[220ms] ease-[var(--ease)] hover:-translate-y-px active:translate-y-0 active:scale-[0.985] ${
        hero ? 'items-center gap-3 px-3 py-2.5' : 'flex-col justify-between px-2.5 py-2'
      } ${
        selected
          ? 'border-bright/70 bg-gradient-to-br from-accent/35 to-interactive shadow-[0_0_0_1px_rgb(167_139_250/0.25),0_8px_24px_-8px_rgb(139_92_246/0.6)]'
          : hero
            ? 'border-line-strong bg-gradient-to-br from-[#2b1f55] to-elevated hover:border-bright/50 hover:shadow-[0_8px_22px_-10px_rgb(139_92_246/0.6)]'
            : 'border-line bg-elevated hover:border-bright/40 hover:bg-interactive hover:shadow-[0_8px_20px_-12px_rgb(139_92_246/0.5)]'
      }`}
    >
      {hero ? <div className="pointer-events-none absolute -left-6 -top-8 size-24 rounded-full bg-accent/30 blur-2xl" /> : null}
      <span
        className={`relative grid shrink-0 place-items-center rounded-lg transition-colors duration-200 ${hero ? 'size-9' : 'size-7'} ${
          selected ? 'bg-accent text-white' : 'bg-interactive text-bright group-hover:text-soft'
        }`}
      >
        <Icon size={hero ? 19 : 15} strokeWidth={2} />
      </span>
      <span className={`relative min-w-0 ${hero ? 'flex-1' : 'mt-1.5'}`}>
        <span className={`block truncate font-semibold ${hero ? 'text-[13px]' : 'text-xs'}`}>{preset.name}</span>
        {hero ? <span className="block truncate text-[11px] text-muted">{preset.description}</span> : null}
      </span>
      {selected ? (
        <span className="anim-pop absolute right-2 top-2 grid size-4 place-items-center rounded-full bg-bright text-bg">
          <Check size={11} strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}

export function PresetSelector(): ReactNode {
  const { settings, applyPreset } = useStore();
  const hero = BUILT_IN_PRESETS[0]!;
  const rest = BUILT_IN_PRESETS.slice(1);
  const isCustom = settings.presetId === 'custom';

  return (
    <section aria-label="Sound presets">
      <SectionTitle
        right={
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors duration-200 ${
              isCustom ? 'border-bright/50 bg-accent/20 text-soft' : 'border-transparent text-transparent'
            }`}
            aria-live="polite"
          >
            {isCustom ? 'Custom' : '.'}
          </span>
        }
      >
        Presets
      </SectionTitle>
      <div className="grid grid-cols-6 gap-2">
        <div className="col-span-6">
          <PresetCard preset={hero} hero selected={settings.presetId === hero.id} onSelect={() => applyPreset(hero.id)} />
        </div>
        {rest.map((p, i) => (
          <div key={p.id} className={i < 3 ? 'col-span-2' : 'col-span-3'}>
            <PresetCard preset={p} selected={settings.presetId === p.id} onSelect={() => applyPreset(p.id)} />
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {settings.customPresets.map((p) => {
          const key = customPresetKey(p.id);
          const on = settings.presetId === key;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => applyPreset(key)}
              className={`anim-fade-up max-w-[150px] cursor-pointer truncate rounded-full border px-3 py-1 text-xs font-medium transition-[background,border-color,color,transform] duration-200 ease-[var(--ease)] active:scale-95 ${
                on ? 'border-bright/70 bg-accent/30 text-fg' : 'border-line bg-elevated text-muted hover:border-bright/40 hover:text-fg'
              }`}
            >
              {p.name}
            </button>
          );
        })}
        <SavePreset />
      </div>
    </section>
  );
}
