/**
 * Utilidades de texto compartidas por los módulos con identificadores públicos.
 *
 * El slug es un identificador estable que aparece en URLs y en el catálogo:
 * minúsculas, sin acentos, separado por guiones y sin guiones en los extremos.
 */

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 60;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** «Prendería La 70» → `prenderya-la-70`. Puede devolver `''` si no queda nada útil. */
export function slugify(input: string, maxLength: number = SLUG_MAX_LENGTH): string {
  const base = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return base.slice(0, maxLength).replace(/-+$/g, '');
}

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}
