import { Check, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, SectionTitle, Toggle } from '../components/ui';
import { useLive } from '../live';
import { useStore } from '../store';
import type { CustomPreset } from '../../shared/types';

function PresetRow({ preset }: { preset: CustomPreset }): ReactNode {
  const { renameCustomPreset, deleteCustomPreset } = useStore();
  const [mode, setMode] = useState<'view' | 'rename' | 'confirm'>('view');
  const [name, setName] = useState(preset.name);
  const [error, setError] = useState<string | null>(null);

  const commit = (): void => {
    const err = renameCustomPreset(preset.id, name);
    if (err) setError(err);
    else setMode('view');
  };

  return (
    <li className="anim-fade-up rounded-xl border border-line bg-elevated px-3 py-2">
      {mode === 'rename' ? (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
        >
          <input
            autoFocus
            value={name}
            maxLength={24}
            aria-label="New preset name"
            aria-invalid={!!error}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Escape' && setMode('view')}
            className={`min-w-0 flex-1 rounded-lg border bg-surface px-2 py-1 text-xs outline-none focus:border-bright ${error ? 'border-err/60' : 'border-line'}`}
          />
          <Button type="submit" variant="primary" aria-label="Confirm rename"><Check size={13} /></Button>
          <Button variant="ghost" onClick={() => { setMode('view'); setName(preset.name); setError(null); }} aria-label="Cancel rename"><X size={14} /></Button>
        </form>
      ) : mode === 'confirm' ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 truncate text-xs">Delete “{preset.name}”?</span>
          <Button variant="ghost" onClick={() => setMode('view')}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteCustomPreset(preset.id)}><Trash2 size={13} /> Delete</Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="flex-1 truncate text-xs font-medium">{preset.name}</span>
          <Button variant="ghost" onClick={() => setMode('rename')} aria-label={`Rename ${preset.name}`}><Pencil size={13} /></Button>
          <Button variant="ghost" onClick={() => setMode('confirm')} aria-label={`Delete ${preset.name}`}><Trash2 size={13} /></Button>
        </div>
      )}
      {error ? <p role="alert" className="mt-1 text-[11px] text-err">{error}</p> : null}
    </li>
  );
}

export function SettingsView(): ReactNode {
  const { settings, setVisualizer, resetAll } = useStore();
  const { link } = useLive();
  const [confirmReset, setConfirmReset] = useState(false);
  const engine = link.kind === 'connected' ? link.status?.engine : null;

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Visualizer">
        <SectionTitle>Visualizer</SectionTitle>
        <div className="surface-card flex flex-col gap-3 rounded-2xl px-3.5 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Show live spectrum</span>
            <Toggle size="sm" checked={settings.visualizer.enabled} onChange={(enabled) => setVisualizer({ enabled })} label="Show live spectrum" />
          </div>
          <p className="text-[11px] text-muted">Pick styles and themes inside the full screen visualizer.</p>
        </div>
      </section>

      <section aria-label="My presets">
        <SectionTitle>My presets</SectionTitle>
        {settings.customPresets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-3 text-xs text-muted">
            No saved presets yet. Shape the sound, then use “Save current” on the Sound or Equalizer tab.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {settings.customPresets.map((p) => <PresetRow key={p.id} preset={p} />)}
          </ul>
        )}
      </section>

      <section aria-label="Reset">
        <SectionTitle>Reset</SectionTitle>
        <div className="surface-card rounded-2xl px-3.5 py-3">
          {confirmReset ? (
            <div className="anim-fade-up flex items-center gap-2">
              <span className="flex-1 text-xs">Restore the neutral sound? Saved presets are kept.</span>
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => { resetAll(); setConfirmReset(false); }}>Reset</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-xs text-muted">Flat equalizer, bass, treble and effects off.</span>
              <Button onClick={() => setConfirmReset(true)}><RotateCcw size={13} /> Reset to default</Button>
            </div>
          )}
        </div>
      </section>

      <section aria-label="About" className="pb-2">
        <SectionTitle>About</SectionTitle>
        <div className="rounded-2xl border border-line px-3.5 py-3 text-[11px] leading-relaxed text-muted">
          <p>
            Violet Audio v1.0 processes the audio of YouTube and YouTube Music tabs on your device with the Web Audio API. Nothing is uploaded; settings live in Chrome local storage.
          </p>
          <p className="mt-1.5">
            Engine: <span className="text-soft">{engine ?? 'not connected'}</span>. Protected (DRM) videos may play unprocessed.
          </p>
        </div>
      </section>
    </div>
  );
}
