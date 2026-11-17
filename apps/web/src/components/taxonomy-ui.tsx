'use client';

import type { ReactNode } from 'react';

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-700 text-white shadow-sm hover:bg-brand-900 focus-visible:outline-brand-700 disabled:bg-brand-700/60',
  secondary:
    'border border-stone-300 bg-white text-stone-700 shadow-sm hover:bg-stone-100 focus-visible:outline-stone-500',
  ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-stone-500',
};

export function buttonStyles(variant: ButtonVariant = 'primary', size: 'sm' | 'md' = 'md'): string {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition',
    'focus-visible:outline-2 focus-visible:outline-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-60',
    size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
    BUTTON_VARIANTS[variant],
  );
}

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'outline';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-stone-100 text-stone-700 ring-stone-200',
  brand: 'bg-brand-50 text-brand-900 ring-brand-700/20',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  danger: 'bg-red-50 text-red-800 ring-red-600/20',
  outline: 'bg-white text-stone-600 ring-stone-300',
};

export function Badge({
  children,
  tone = 'neutral',
  mono = false,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  mono?: boolean;
}): React.ReactElement {
  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        mono && 'font-mono',
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}): React.ReactElement {
  return (
    <div className="min-w-0 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{value}</p>
      {hint ? <p className="mt-0.5 truncate text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

export function SearchField({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
        fill="none"
      >
        <circle cx="9" cy="9" r="5.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        id={id}
        type="search"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cx(
          'w-full rounded-lg border border-stone-300 bg-white py-1.5 pl-8 pr-3 text-sm text-stone-900',
          'placeholder:text-stone-400 disabled:bg-stone-100 disabled:text-stone-400',
          'focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20',
        )}
      />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 px-4 py-8 text-center">
      <p className="text-sm font-medium text-stone-800">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-xs text-stone-500">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }): React.ReactElement {
  return (
    <ul className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index} className="animate-pulse rounded-xl border border-stone-200 p-3">
          <div className="h-3 w-2/3 rounded bg-stone-200" />
          <div className="mt-2 h-2.5 w-1/3 rounded bg-stone-100" />
        </li>
      ))}
    </ul>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-stone-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-stone-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const inputStyles =
  'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm ' +
  'placeholder:text-stone-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20 ' +
  'disabled:bg-stone-100';

export function Banner({
  tone,
  message,
  onDismiss,
}: {
  tone: 'success' | 'error' | 'info';
  message: string;
  onDismiss?: () => void;
}): React.ReactElement {
  const tones = {
    success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    error: 'border-red-300 bg-red-50 text-red-900',
    info: 'border-sky-300 bg-sky-50 text-sky-900',
  } as const;

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={cx(
        'flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm shadow-sm',
        tones[tone],
      )}
    >
      <span className="min-w-0 break-words">{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Descartar mensaje"
          className="shrink-0 rounded p-0.5 opacity-70 transition hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none">
            <path
              d="M5 5l10 10M15 5L5 15"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
