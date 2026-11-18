import { addUtcDays, DAY_MS } from '../../../common/utils/dates.js';
import { SubscriptionError } from './subscription-error.js';

/** Estados persistidos. E4 solo asigna TRIALING, ACTIVE y EXPIRED (D-38). */
export const SUBSCRIPTION_STATUSES = [
  'TRIALING',
  'ACTIVE',
  'SUSPENDED',
  'EXPIRED',
  'CANCELLED',
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Estados que dependen de una fecha de vencimiento. */
export const PERIOD_BOUND_STATUSES: readonly SubscriptionStatus[] = ['TRIALING', 'ACTIVE'];

export const PLAN_CODES = ['FREE', 'BASE', 'PRO'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

/** Solo estos planes se activan con cobro manual verificado. */
export const PAID_PLAN_CODES: readonly PlanCode[] = ['BASE', 'PRO'];

export const CURRENCY = 'COP';
export const NOTE_MAX_LENGTH = 500;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 80;
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,80}$/;
/** Duración por defecto de una activación pagada si el plan no la define. */
export const DEFAULT_PAID_PERIOD_DAYS = 30;

export type ActivationKind = 'ACTIVATED' | 'RENEWED' | 'PLAN_CHANGED';

export interface PlanSnapshot {
  id: string;
  code: string;
  priceCop: number;
  currency: string;
  billingPeriodDays: number | null;
  isActive: boolean;
}

export interface ActivationState {
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  planId: string;
}

export interface ActivationSchedule {
  kind: ActivationKind;
  periodStart: Date;
  previousPeriodEnd: Date;
  newPeriodEnd: Date;
}

export function isPaidPlanCode(code: string): code is 'BASE' | 'PRO' {
  return code === 'BASE' || code === 'PRO';
}

/**
 * Estado efectivo: una suscripción con periodo vencido ya no está vigente
 * aunque el registro todavía diga TRIALING/ACTIVE. La respuesta HTTP y el
 * listado usan siempre este valor.
 */
export function effectiveStatus(
  status: SubscriptionStatus,
  currentPeriodEnd: Date,
  now: Date,
): SubscriptionStatus {
  if (PERIOD_BOUND_STATUSES.includes(status) && currentPeriodEnd.getTime() <= now.getTime()) {
    return 'EXPIRED';
  }
  return status;
}

/** Días restantes redondeados hacia arriba; 0 si ya venció. */
export function remainingDays(currentPeriodEnd: Date, now: Date): number {
  const diff = currentPeriodEnd.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / DAY_MS);
}

export function isExpired(currentPeriodEnd: Date, now: Date): boolean {
  return currentPeriodEnd.getTime() <= now.getTime();
}

/**
 * Política de activación aprobada (D-37: conservar lo pagado).
 *
 * - TRIALING o vencida → el periodo pagado empieza ahora.
 * - ACTIVE con vencimiento futuro → se suman días al vencimiento vigente.
 * - El cambio de plan es inmediato, sin prorrateo ni reembolso.
 */
export function computeActivationSchedule(
  current: ActivationState,
  plan: PlanSnapshot,
  now: Date,
): ActivationSchedule {
  const days = plan.billingPeriodDays ?? DEFAULT_PAID_PERIOD_DAYS;
  if (days < 1 || days > 366) {
    throw new SubscriptionError(
      'INVALID_INPUT',
      'La duración del plan debe estar entre 1 y 366 días',
    );
  }

  const stillPaid =
    current.status === 'ACTIVE' && current.currentPeriodEnd.getTime() > now.getTime();

  if (stillPaid) {
    return {
      kind: current.planId === plan.id ? 'RENEWED' : 'PLAN_CHANGED',
      periodStart: current.currentPeriodStart,
      previousPeriodEnd: current.currentPeriodEnd,
      newPeriodEnd: addUtcDays(current.currentPeriodEnd, days),
    };
  }

  return {
    kind: 'ACTIVATED',
    periodStart: now,
    previousPeriodEnd: current.currentPeriodEnd,
    newPeriodEnd: addUtcDays(now, days),
  };
}

/** Verifica que un plan pueda activarse con cobro manual. */
export function assertPayablePlan(plan: PlanSnapshot): void {
  if (!isPaidPlanCode(plan.code)) {
    throw new SubscriptionError(
      'PLAN_NOT_PAYABLE',
      'El plan Free no se activa con cobro manual: es la prueba inicial del negocio',
    );
  }
  if (!plan.isActive) {
    throw new SubscriptionError('PLAN_INACTIVE', 'El plan no está disponible');
  }
}

/** Nota administrativa: obligatoria, sin espacios sobrantes y acotada. */
export function normalizeActivationNote(note: string | undefined | null): string {
  const trimmed = (note ?? '').trim();
  if (trimmed.length === 0) {
    throw new SubscriptionError('INVALID_NOTE', 'La nota de verificación del pago es obligatoria');
  }
  if (trimmed.length > NOTE_MAX_LENGTH) {
    throw new SubscriptionError(
      'INVALID_NOTE',
      `La nota no puede superar ${NOTE_MAX_LENGTH} caracteres`,
    );
  }
  return trimmed;
}

/** Clave de idempotencia enviada por el cliente en `Idempotency-Key`. */
export function normalizeIdempotencyKey(key: string | undefined | null): string | null {
  if (key === undefined || key === null) return null;
  const trimmed = key.trim();
  if (trimmed.length === 0) return null;
  if (!IDEMPOTENCY_KEY_PATTERN.test(trimmed) || trimmed.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new SubscriptionError(
      'INVALID_IDEMPOTENCY_KEY',
      'Idempotency-Key debe tener entre 8 y 80 caracteres [A-Za-z0-9._:-]',
    );
  }
  return trimmed;
}
