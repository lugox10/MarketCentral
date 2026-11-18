/** Errores de dominio del catálogo público. */

export type PublicCatalogErrorCode =
  | 'PUBLIC_LISTING_NOT_FOUND'
  | 'PUBLIC_BUSINESS_NOT_FOUND'
  | 'PUBLIC_VERTICAL_NOT_FOUND'
  | 'INVALID_FILTERS';

export class PublicCatalogError extends Error {
  constructor(
    readonly code: PublicCatalogErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PublicCatalogError';
  }
}
