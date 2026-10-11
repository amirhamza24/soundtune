import { useId } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Tooltip({ text, children, side = 'bottom' }: { text: string; children: ReactNode; side?: 'bottom' | 'top' }): ReactNode {
  return (
    <span className="has-tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`tt absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md border border-line-strong bg-elevated px-2 py-1 text-[11px] text-fg shadow-lg ${side === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'}`}
      >
        {text}
      </span>
    </span>
  );
}

export function Toggle({ checked, onChange, label, size = 'md' }: { checked: boolean; onChange: (v: boolean) => void; label: string; size?: 'sm' | 'md' }): ReactNode {
  const w = size === 'md' ? 'h-6 w-11' : 'h-5 w-9';
  const k = size === 'md' ? 'size-[18px]' : 'size-[14px]';
  const travel = size === 'md' ? 'translate-x-5' : 'translate-x-4';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 cursor-pointer rounded-full border transition-[background,border-color,box-shadow] duration-200 ease-[var(--ease)] ${w} ${
        checked ? 'border-bright/50 bg-gradient-to-r from-accent to-[#7c3aed] shadow-[0_0_14px_rgb(139_92_246/0.45)]' : 'border-line bg-interactive'
      }`}
    >
      <span
        className={`absolute left-[2px] top-1/2 -translate-y-1/2 rounded-full bg-fg shadow transition-transform duration-200 ease-[var(--ease)] ${k} ${checked ? travel : 'translate-x-0 bg-muted'}`}
      />
    </button>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'subtle' };

export function Button({ variant = 'subtle', className = '', ...rest }: BtnProps): ReactNode {
  const styles = {
    primary: 'bg-gradient-to-b from-accent to-[#7c3aed] text-white border-bright/40 hover:brightness-110 shadow-[0_4px_16px_rgb(139_92_246/0.3)]',
    subtle: 'bg-interactive text-fg border-line hover:border-line-strong hover:bg-[#2a2146]',
    ghost: 'bg-transparent text-muted border-transparent hover:text-fg hover:bg-interactive/70',
    danger: 'bg-err/10 text-err border-err/30 hover:bg-err/20',
  }[variant];
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-[background,border-color,color,filter,transform] duration-200 ease-[var(--ease)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    />
  );
}

export function IconButton({ label, children, onClick, active, tooltipSide }: { label: string; children: ReactNode; onClick: () => void; active?: boolean; tooltipSide?: 'bottom' | 'top' }): ReactNode {
  return (
    <Tooltip text={label} side={tooltipSide}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={`grid size-8 cursor-pointer place-items-center rounded-lg border transition-[background,border-color,color,transform] duration-200 ease-[var(--ease)] active:scale-95 ${
          active ? 'border-line-strong bg-interactive text-soft' : 'border-transparent text-muted hover:bg-interactive hover:text-fg'
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; label: string }): ReactNode {
  const index = options.findIndex((o) => o.value === value);
  return (
    <div role="radiogroup" aria-label={label} className="relative grid rounded-lg border border-line bg-surface p-0.5" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      <div
        className="absolute inset-y-0.5 rounded-md bg-interactive shadow-[inset_0_0_0_1px_rgb(167_139_250/0.3)] transition-transform duration-[220ms] ease-[var(--ease)]"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)`, left: 2 }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`relative z-10 cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors duration-200 ${o.value === value ? 'text-fg' : 'text-muted hover:text-fg'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }): ReactNode {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{children}</h2>
      {right}
    </div>
  );
}

/** Labeled row used by effect sliders: label + readout above a horizontal control. */
export function ControlRow({ label, readout, children, hint }: { label: string; readout: string; children: ReactNode; hint?: string }): ReactNode {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span id={id} className="text-xs font-medium text-fg">{label}</span>
        <span className="font-mono text-xs tabular-nums text-soft">{readout}</span>
      </div>
      {children}
      {hint ? <p className="-mt-0.5 text-[11px] leading-snug text-muted">{hint}</p> : null}
    </div>
  );
}
