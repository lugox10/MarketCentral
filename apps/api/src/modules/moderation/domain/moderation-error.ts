export type ModerationErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_REASON'
  | 'INVALID_DETAILS'
  | 'INVALID_EMAIL'
  | 'INVALID_STATUS'
  | 'INVALID_TRANSITION'
  | 'INVALID_REASON_TEXT'
  | 'LISTING_NOT_AVAILABLE'
  | 'BUSINESS_NOT_AVAILABLE'
  | 'BUSINESS_NOT_FOUND'
  | 'LISTING_NOT_FOUND'
  | 'REPORT_NOT_FOUND'
  | 'DUPLICATE_REPORT'
  | 'RATE_LIMITED';

export class ModerationError extends Error {
  constructor(
    readonly code: ModerationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ModerationError';
  }
}
