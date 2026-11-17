/**
 * Errores de dominio de la taxonomía. El filtro HTTP los traduce a un código
 * de estado concreto; nunca se expone el stack ni el detalle de Prisma.
 */

export const TAXONOMY_ERROR_CODES = [
  'INVALID_NAME',
  'INVALID_SLUG',
  'INVALID_CODE',
  'INVALID_TYPE',
  'INVALID_OPTIONS',
  'INVALID_INPUT',
  'VERTICAL_NOT_FOUND',
  'CATEGORY_NOT_FOUND',
  'PARENT_VERTICAL_MISMATCH',
  'PARENT_CYCLE',
  'DUPLICATE_VERTICAL',
  'DUPLICATE_CATEGORY',
  'DUPLICATE_CODE',
] as const;

export type TaxonomyErrorCode = (typeof TAXONOMY_ERROR_CODES)[number];

export class TaxonomyError extends Error {
  constructor(
    readonly code: TaxonomyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TaxonomyError';
  }
}
