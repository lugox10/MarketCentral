/**
 * Reglas de negocio de la taxonomía global (E3).
 *
 * La taxonomía no pertenece a ningún negocio: es configuración de plataforma.
 * Este archivo no conoce NestJS, Prisma ni HTTP.
 */

import {
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  isValidSlug,
  slugify,
} from '../../../common/utils/slug.js';

export const ATTRIBUTE_TYPES = ['TEXT', 'NUMBER', 'BOOLEAN', 'ENUM'] as const;

export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 60;
export const CODE_MAX_LENGTH = 40;
export const OPTION_MAX_LENGTH = 60;
export const CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isAttributeType(value: unknown): value is AttributeType {
  return typeof value === 'string' && (ATTRIBUTE_TYPES as readonly string[]).includes(value);
}

/** Recorta y colapsa espacios internos: «  Celulares   usados » → «Celulares usados». */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function isValidName(value: string): boolean {
  return value.length >= NAME_MIN_LENGTH && value.length <= NAME_MAX_LENGTH;
}

/**
 * Slug explícito enviado por el administrador: debe venir ya normalizado.
 * Si no se envía, se genera a partir del nombre con `slugify`.
 */
export function resolveSlug(name: string, explicitSlug?: string): string | null {
  if (explicitSlug !== undefined && explicitSlug !== null && explicitSlug !== '') {
    const cleaned = explicitSlug.trim();
    return isValidSlug(cleaned) && cleaned.length <= SLUG_MAX_LENGTH ? cleaned : null;
  }

  const generated = slugify(name, SLUG_MAX_LENGTH);
  return generated.length >= SLUG_MIN_LENGTH ? generated : null;
}

/** Código estable del atributo (`marca`, `tipo-material`). */
export function normalizeCode(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase();
  return CODE_PATTERN.test(cleaned) && cleaned.length <= CODE_MAX_LENGTH ? cleaned : null;
}

/**
 * Normaliza las opciones de un atributo ENUM: recorta, colapsa espacios y
 * rechaza vacías, demasiado largas o duplicadas (sin distinguir mayúsculas).
 */
export type NormalizedOptions =
  { ok: true; options: string[] } | { ok: false; reason: 'EMPTY' | 'TOO_LONG' | 'DUPLICATE' };

export function normalizeOptions(raw: readonly string[]): NormalizedOptions {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of raw) {
    const cleaned = value.trim().replace(/\s+/g, ' ');
    if (cleaned.length === 0) return { ok: false, reason: 'EMPTY' };
    if (cleaned.length > OPTION_MAX_LENGTH) return { ok: false, reason: 'TOO_LONG' };

    const key = cleaned.toLowerCase();
    if (seen.has(key)) return { ok: false, reason: 'DUPLICATE' };

    seen.add(key);
    result.push(cleaned);
  }

  return { ok: true, options: result };
}

/** Un atributo ENUM necesita al menos una opción; los demás tipos no admiten opciones. */
export function validateOptionsForType(type: AttributeType, options: readonly string[]): boolean {
  if (type === 'ENUM') return options.length > 0;
  return options.length === 0;
}
