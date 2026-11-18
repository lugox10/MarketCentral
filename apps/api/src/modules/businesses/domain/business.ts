/**
 * Reglas de negocio del agregado `Business` (E2).
 *
 * Vive en el dominio: no conoce NestJS, Prisma ni HTTP. Todo lo que aquí se
 * decide es invariante del negocio y se prueba sin base de datos.
 */

import { slugify as slugifyText } from '../../../common/utils/slug.js';

/** Municipios del Área Metropolitana del Valle de Aburrá (Q-16). */
export const AMVA_CITIES = [
  'MEDELLIN',
  'BELLO',
  'ITAGUI',
  'ENVIGADO',
  'SABANETA',
  'LA_ESTRELLA',
  'CALDAS',
  'COPACABANA',
  'GIRARDOTA',
  'BARBOSA',
] as const;

export type AmvaCity = (typeof AMVA_CITIES)[number];

export const BUSINESS_STATUSES = ['APPROVED', 'SUSPENDED'] as const;

export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const MEMBERSHIP_ROLES = ['OWNER', 'MANAGER', 'STAFF'] as const;

export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const SUBSCRIPTION_STATUSES = [
  'TRIALING',
  'ACTIVE',
  'SUSPENDED',
  'EXPIRED',
  'CANCELLED',
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Plan que recibe todo negocio nuevo (Q-02/Q-03). */
export const FREE_PLAN_CODE = 'FREE' as const;

export const BUSINESS_NAME_MIN = 2;
export const BUSINESS_NAME_MAX = 80;
export const ADDRESS_LINE_MAX = 160;
export const SLUG_MIN = 3;
export const SLUG_MAX = 60;

export function isAmvaCity(value: unknown): value is AmvaCity {
  return typeof value === 'string' && (AMVA_CITIES as readonly string[]).includes(value);
}

/**
 * Genera el slug público a partir del nombre comercial.
 * «Prendería La 70» → `prenderya-la-70` (sin acentos, sin signos).
 */
export function slugify(name: string): string {
  const base = slugifyText(name, SLUG_MAX);

  return base.length >= SLUG_MIN ? base : `negocio-${base}`.slice(0, SLUG_MAX);
}

/**
 * Normaliza el WhatsApp comercial a E.164 colombiano (`+57` + 10 dígitos).
 * Acepta `3001234567`, `+573001234567` y variantes con espacios o guiones.
 * Devuelve `null` si no es un número colombiano válido.
 */
export function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 10 && digits.startsWith('3')) return `+57${digits}`;
  if (digits.length === 12 && digits.startsWith('57') && digits[2] === '3') return `+${digits}`;
  if (digits.length === 13 && digits.startsWith('057')) return `+${digits.slice(1)}`;
  return null;
}

/** Roles con permiso de escritura sobre el perfil del negocio. */
export function canEditBusiness(role: MembershipRole): boolean {
  return role === 'OWNER' || role === 'MANAGER';
}

/** Límites anti-abuso del plan Free (D-41). */
export const MAX_BUSINESSES_PER_OWNER = 3;
export const MIN_HOURS_BETWEEN_BUSINESSES = 24;
export const FINGERPRINT_MAX = 200;

/**
 * Huella normalizada de nombre + dirección: minúsculas, sin tildes, sin signos
 * y con espacios colapsados. Sirve para bloquear duplicados exactos y detectar
 * negocios sospechosamente parecidos dentro de la misma vertical.
 */
export function normalizeFingerprint(name: string, addressLine: string): string {
  return `${name}|${addressLine}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9|\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, FINGERPRINT_MAX);
}

function tokenSet(fingerprint: string): Set<string> {
  return new Set(fingerprint.split(/[|\s]+/).filter((token) => token.length > 1));
}

/**
 * Similitud de Jaccard sobre palabras. ≥ 0.8 se considera un posible duplicado:
 * el alta se permite, pero el negocio queda marcado para revisión.
 */
export function areFingerprintsSimilar(left: string, right: string): boolean {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (a.size === 0 || b.size === 0) return false;

  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;

  return shared / (a.size + b.size - shared) >= 0.8;
}

/** Textos de mejora de plan que la UI muestra cuando una capacidad no está incluida. */
export const PLAN_FEATURE_HINTS = {
  categories:
    'Las categorías propias permiten ordenar tu inventario con nombres de tu negocio. Están incluidas en Base (3) y Pro (5).',
  listings: 'El plan Free permite 10 publicaciones activas; Base llega a 30 y Pro a 50.',
  featured:
    'Los destacados suben tus publicaciones al inicio del catálogo mientras estén activos.',
} as const;
