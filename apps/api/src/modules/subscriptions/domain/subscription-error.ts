/** Error de dominio del módulo Subscriptions (E4). El filtro HTTP lo traduce. */
export type SubscriptionErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_NOTE'
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'PLAN_NOT_FOUND'
  | 'PLAN_INACTIVE'
  | 'PLAN_NOT_PAYABLE'
  | 'BUSINESS_NOT_FOUND'
  | 'SUBSCRIPTION_NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'FORBIDDEN';

export class SubscriptionError extends Error {
  constructor(
    readonly code: SubscriptionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SubscriptionError';
  }
}
