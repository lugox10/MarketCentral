import type { ButtonHTMLAttributes } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Placeholder del bootstrap: un único botón con estilos Tailwind.
 * La librería real de UI se construye en el Prompt 04.
 */
export function Button({ className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        'inline-flex items-center justify-center rounded-md bg-emerald-700 px-4 py-2',
        'text-sm font-semibold text-white transition-colors hover:bg-emerald-800',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}
