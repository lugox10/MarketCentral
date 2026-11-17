/** Errores de negocio del módulo Businesses. El filtro HTTP los traduce. */
export type BusinessErrorCode =
  | 'ALREADY_HAS_BUSINESS'
  | 'BUSINESS_NOT_FOUND'
  | 'INVALID_CITY'
  | 'INVALID_WHATSAPP'
  | 'INVALID_NAME'
  | 'INVALID_ADDRESS'
  | 'INVALID_INPUT'
  | 'INVALID_STATUS'
  | 'PLAN_NOT_FOUND'
  | 'SLUG_EXHAUSTED'
  | 'FORBIDDEN'
  | 'LAST_OWNER';

export class BusinessError extends Error {
  constructor(
    readonly code: BusinessErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}
