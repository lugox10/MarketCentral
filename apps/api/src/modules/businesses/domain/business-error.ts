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
  | 'LAST_OWNER'
  | 'VERTICAL_NOT_FOUND'
  | 'VERTICAL_INACTIVE'
  | 'WHATSAPP_TAKEN'
  | 'DUPLICATE_BUSINESS'
  | 'OWNER_LIMIT_REACHED'
  | 'NEW_BUSINESS_TOO_SOON'
  | 'SIGNUPS_CLOSED';

export class BusinessError extends Error {
  constructor(
    readonly code: BusinessErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}
