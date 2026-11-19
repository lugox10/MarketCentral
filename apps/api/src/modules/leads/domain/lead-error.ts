export type LeadErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_NAME'
  | 'INVALID_EMAIL'
  | 'INVALID_PHONE'
  | 'INVALID_MESSAGE'
  | 'INVALID_STATUS'
  | 'CONSENT_REQUIRED'
  | 'FORM_TOKEN_INVALID'
  | 'FORM_TOKEN_EXPIRED'
  | 'FORM_TOKEN_TOO_FAST'
  | 'LISTING_NOT_AVAILABLE'
  | 'BUSINESS_NOT_AVAILABLE'
  | 'DUPLICATE_LEAD'
  | 'RATE_LIMITED'
  | 'LEAD_NOT_FOUND'
  | 'BUSINESS_NOT_FOUND';

/** Error de negocio del módulo de leads; el filtro lo traduce a HTTP. */
export class LeadError extends Error {
  constructor(
    readonly code: LeadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LeadError';
  }
}
