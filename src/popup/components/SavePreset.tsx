import { Check, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../store';
import { Button } from './ui';

/** Inline "save current settings as a preset" control. */
export function SavePreset(): ReactNode {
  const { saveCustomPreset, validateName, settings } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const close = (): void => {
    setOpen(false);
    setName('');
    setError(null);
  };

  const submit = (): void => {
    const err = saveCustomPreset(name);
    if (err) {
      setError(err);
      return;
    }
    close();
    setSaved(true);
    timer.current = window.setTimeout(() => setSaved(false), 1400);
  };

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)} className="!rounded-full border-dashed !border-line-strong !px-3">
        {saved ? <Check size={13} className="anim-pop text-ok" /> : <Plus size={13} />}
        {saved ? 'Saved' : 'Save current'}
      </Button>
    );
  }

  const preview = name.trim() ? validateName(name) : null;
  const shown = error ?? preview;

  return (
    <form
      className="anim-fade-up flex w-full flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-1.5">
        <input
          ref={input}
          value={name}
          maxLength={24}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Escape' && close()}
          placeholder="Preset name"
          aria-label="Preset name"
          aria-invalid={!!shown}
          className={`min-w-0 flex-1 rounded-lg border bg-surface px-2.5 py-1.5 text-xs text-fg outline-none transition-colors duration-200 placeholder:text-muted/70 focus:border-bright ${shown ? 'border-err/60' : 'border-line'}`}
        />
        <Button type="submit" variant="primary" disabled={!name.trim() || !!preview} aria-label="Save preset">
          <Check size={13} /> Save
        </Button>
        <Button variant="ghost" onClick={close} aria-label="Cancel">
          <X size={14} />
        </Button>
      </div>
      <p className={`h-3.5 text-[11px] ${shown ? 'text-err' : 'text-muted'}`} role={shown ? 'alert' : undefined}>
        {shown ?? `Saves bands, bass, treble and effects (${settings.customPresets.length} saved)`}
      </p>
    </form>
  );
}
