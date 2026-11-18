export type ListingErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_TITLE'
  | 'INVALID_DESCRIPTION'
  | 'INVALID_PRICE'
  | 'INVALID_CONDITION'
  | 'INVALID_STATUS_TRANSITION'
  | 'LISTING_NOT_FOUND'
  | 'LISTING_NOT_OWNED'
  | 'LISTING_LOCKED'
  | 'LISTING_LIMIT_REACHED'
  | 'FEATURED_LIMIT_REACHED'
  | 'CATEGORY_NOT_FOUND'
  | 'CATEGORY_NOT_IN_VERTICAL'
  | 'CATEGORY_NOT_AVAILABLE'
  | 'INVALID_ATTRIBUTES'
  | 'IMAGE_LIMIT_REACHED'
  | 'IMAGES_REQUIRED'
  | 'INVALID_IMAGE_TYPE'
  | 'IMAGE_TOO_LARGE'
  | 'IMAGE_NOT_FOUND'
  | 'BUSINESS_NOT_FOUND'
  | 'SLUG_EXHAUSTED';

/** Error de dominio de publicaciones e imágenes. */
export class ListingError extends Error {
  constructor(
    readonly code: ListingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ListingError';
  }
}
