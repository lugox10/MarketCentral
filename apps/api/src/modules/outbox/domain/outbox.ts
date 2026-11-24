/**
 * Eventos de dominio publicados mediante el patrón transactional outbox.
 *
 * El nombre describe un hecho ya ocurrido (`LeadCreated`), no una orden. El
 * payload lleva identificadores y datos de negocio, nunca datos personales:
 * los consumidores externos (n8n u otros) piden el detalle por su propia API
 * autenticada si lo necesitan.
 */
export const OUTBOX_EVENT_TYPES = [
  'LeadCreated',
  'BusinessRegistered',
  'SubscriptionActivated',
  'ReportCreated',
] as const;

export type OutboxEventType = (typeof OUTBOX_EVENT_TYPES)[number];

/** Intentos antes de dejar un evento en FAILED para revisión manual. */
export const MAX_OUTBOX_ATTEMPTS = 8;

/** Espera base del reintento exponencial (1, 2, 4, 8… minutos). */
export const OUTBOX_RETRY_BASE_MS = 60_000;

/** Tope del backoff para que un evento roto no quede dormido para siempre. */
export const OUTBOX_RETRY_MAX_MS = 60 * 60 * 1000;

export interface LeadCreatedPayload {
  leadId: string;
  businessId: string;
  businessSlug: string;
  listingId: string | null;
  source: string;
  createdAt: string;
}

export interface BusinessRegisteredPayload {
  businessId: string;
  businessSlug: string;
  verticalId: string;
  city: string;
  flaggedForReview: boolean;
  createdAt: string;
}

export interface SubscriptionActivatedPayload {
  subscriptionId: string;
  activationId: string;
  businessId: string;
  planCode: string;
  kind: string;
  status: string;
  priceCop: number;
  currentPeriodEnd: string;
}

export interface ReportCreatedPayload {
  reportId: string;
  businessId: string;
  listingId: string | null;
  reason: string;
  status: string;
  createdAt: string;
}

export function computeRetryDelayMs(attempts: number): number {
  const exponent = Math.max(0, Math.min(attempts, 10));
  return Math.min(OUTBOX_RETRY_BASE_MS * 2 ** exponent, OUTBOX_RETRY_MAX_MS);
}

/** Trunca el mensaje de error para que quepa en la columna. */
export function truncateError(message: string): string {
  const clean = message.replace(/\s+/g, ' ').trim();
  return clean.length > 500 ? `${clean.slice(0, 497)}...` : clean;
}

/** Clave de deduplicación estable por hecho de negocio. */
export function dedupeKeyFor(type: OutboxEventType, id: string): string {
  return `${type}:${id}`;
}
