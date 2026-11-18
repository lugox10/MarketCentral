export type CategoryErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_CATEGORY_NAME'
  | 'INVALID_CATEGORY_PARENT'
  | 'CATEGORY_NOT_FOUND'
  | 'CATEGORY_NOT_OWNED'
  | 'CATEGORY_LIMIT_REACHED'
  | 'DUPLICATE_CATEGORY'
  | 'CATEGORY_HAS_LISTINGS';

/** Error de dominio de las categorías propias del negocio. */
export class CategoryError extends Error {
  constructor(
    readonly code: CategoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CategoryError';
  }
}
