export const LISTING_STATUSES = ['DRAFT', 'PUBLISHED', 'SOLD', 'ARCHIVED'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'FOR_PARTS'] as const;
export type ListingCondition = (typeof LISTING_CONDITIONS)[number];

export const TITLE_MIN = 5;
export const TITLE_MAX = 120;
export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 4000;
export const PRICE_MAX = 1_000_000_000;
/** Monedas admitidas para el precio de una publicación. */
export const LISTING_CURRENCIES = ['COP', 'USD'] as const;
export type ListingCurrency = (typeof LISTING_CURRENCIES)[number];
export const DEFAULT_CURRENCY: ListingCurrency = 'COP';
export const MAX_IMAGES = 6;
/**
 * Fotos mínimas para publicar. La decisión es de negocio: una prendería necesita
 * mostrar el producto desde varios ángulos para que el comprador confíe.
 */
export const MIN_PUBLISH_IMAGES = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];
export const ATTRIBUTES_SCHEMA_VERSION = 1;

/**
 * Transiciones permitidas (ADR-011):
 *
 *   DRAFT      → PUBLISHED | ARCHIVED
 *   PUBLISHED  → SOLD | ARCHIVED
 *   SOLD       → ARCHIVED
 *   ARCHIVED   → (terminal, irreversible)
 *
 * `SOLD` conserva el histórico del artículo vendido; `ARCHIVED` equivale a
 * eliminarlo y no se puede republicar.
 */
const TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  DRAFT: ['PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['SOLD', 'ARCHIVED'],
  SOLD: ['ARCHIVED'],
  ARCHIVED: [],
};

export function canTransition(from: ListingStatus, to: ListingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: ListingStatus): boolean {
  return status === 'ARCHIVED';
}

/** Un anuncio archivado o vendido ya no se edita. */
export function isEditable(status: ListingStatus): boolean {
  return status === 'DRAFT' || status === 'PUBLISHED';
}

/** Cuenta para el cupo del plan todo lo que no está archivado. */
export function countsTowardsQuota(status: ListingStatus): boolean {
  return status !== 'ARCHIVED';
}

export function normalizeTitle(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function isValidTitle(title: string): boolean {
  return title.length >= TITLE_MIN && title.length <= TITLE_MAX;
}

export function normalizeDescription(raw: string): string {
  return raw.replace(/\r\n/g, '\n').trim();
}

export function isValidDescription(description: string): boolean {
  return description.length >= DESCRIPTION_MIN && description.length <= DESCRIPTION_MAX;
}

export function isValidPrice(price: number): boolean {
  return Number.isInteger(price) && price >= 0 && price <= PRICE_MAX;
}

export function isListingCondition(value: string): value is ListingCondition {
  return (LISTING_CONDITIONS as readonly string[]).includes(value);
}

/** Sufijo corto y estable para que dos publicaciones distintas no choquen en el slug. */
export function slugSuffix(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).slice(0, 6).padEnd(6, '0');
}
