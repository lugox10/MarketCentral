/** Contrato E4: planes, suscripción del negocio, activación manual e historial. */

import { getJson, postJson } from './api';

import type { Plan } from './business';

export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';

export interface ActivationSummary {
  activatedAt: string;
  adminName: string | null;
  note: string;
  kind: 'ACTIVATED' | 'RENEWED' | 'PLAN_CHANGED';
}

export interface ActivationDetail extends ActivationSummary {
  id: string;
  planCode: string;
  planName: string;
  periodStart: string;
  previousPeriodEnd: string | null;
  newPeriodEnd: string;
  priceCop: number;
  currency: string;
}

export interface Subscription {
  id: string;
  business: { id: string; name: string };
  plan: Plan;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  remainingDays: number;
  isExpired: boolean;
  lastActivation: ActivationSummary | null;
}

export interface AdminSubscriptionRow extends Subscription {
  businessId: string;
  businessName: string;
}

export interface AdminSubscriptionPage {
  items: AdminSubscriptionRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ActivateSubscriptionResult {
  subscription: Subscription;
  activation: ActivationDetail;
  replayed: boolean;
}

export const PLAN_ORDER = ['FREE', 'BASE', 'PRO'] as const;

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  TRIALING: 'En prueba',
  ACTIVE: 'Activa',
  SUSPENDED: 'Suspendida',
  EXPIRED: 'Vencida',
  CANCELLED: 'Cancelada',
};

export const ACTIVATION_LABELS: Record<ActivationSummary['kind'], string> = {
  ACTIVATED: 'Activación',
  RENEWED: 'Renovación',
  PLAN_CHANGED: 'Cambio de plan',
};

export function formatCop(amount: number): string {
  return `$${amount.toLocaleString('es-CO')} COP`;
}

export function planPeriodLabel(plan: Plan): string {
  if (plan.billingPeriodDays) return `${plan.billingPeriodDays} días`;
  if (plan.trialMonths > 0) return `${plan.trialMonths} meses de prueba`;
  return '—';
}

export function fetchPlans(): Promise<Plan[]> {
  return getJson<Plan[]>('/subscriptions/plans');
}

export function fetchMySubscription(): Promise<Subscription> {
  return getJson<Subscription>('/subscriptions/me');
}

export function fetchAdminSubscriptions(params: {
  page?: number;
  limit?: number;
  status?: string;
  plan?: string;
  q?: string;
}): Promise<AdminSubscriptionPage> {
  const search = new URLSearchParams();
  search.set('page', String(params.page ?? 1));
  search.set('limit', String(params.limit ?? 20));
  if (params.status) search.set('status', params.status);
  if (params.plan) search.set('plan', params.plan);
  if (params.q?.trim()) search.set('q', params.q.trim());
  return getJson<AdminSubscriptionPage>(`/admin/subscriptions?${search.toString()}`);
}

export function fetchActivationHistory(businessId: string): Promise<ActivationDetail[]> {
  return getJson<ActivationDetail[]>(`/admin/subscriptions/${businessId}/history`);
}

/**
 * Activación manual de un plan pagado.
 *
 * `idempotencyKey` debe ser estable durante los reintentos del mismo intento:
 * el backend devuelve el resultado original en lugar de extender dos veces.
 */
export function activateSubscription(
  businessId: string,
  body: { planId: string; note: string },
  idempotencyKey: string,
): Promise<ActivateSubscriptionResult> {
  return postJson<ActivateSubscriptionResult>(`/admin/subscriptions/${businessId}/activate`, body, {
    'Idempotency-Key': idempotencyKey,
  });
}

/** Clave única por intento deliberado (formato aceptado por el backend). */
export function newIdempotencyKey(prefix = 'web'): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}:${random}`.slice(0, 80);
}
