import type { ActivationKind, SubscriptionStatus } from '../domain/subscription.js';

/** Proyección del plan que consume el backend y expone la API. */
export interface PlanRecord {
  id: string;
  code: string;
  name: string;
  priceCop: number;
  currency: string;
  maxListings: number;
  trialMonths: number;
  billingPeriodDays: number | null;
  isActive: boolean;
}

/** Una activación/renovación registrada en el historial inmutable. */
export interface ActivationRecord {
  id: string;
  kind: ActivationKind;
  note: string;
  activatedAt: Date;
  periodStart: Date;
  previousPeriodEnd: Date | null;
  newPeriodEnd: Date;
  priceCop: number;
  currency: string;
  planCode: string;
  planName: string;
  adminName: string | null;
}

export interface SubscriptionRecord {
  id: string;
  businessId: string;
  businessName: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  plan: PlanRecord;
  lastActivation: ActivationRecord | null;
}

export interface AdminSubscriptionQuery {
  page: number;
  limit: number;
  status?: SubscriptionStatus;
  planCode?: string;
  search?: string;
}

export interface AdminSubscriptionPage {
  items: SubscriptionRecord[];
  total: number;
}

export interface EnsureFreeSubscriptionInput {
  businessId: string;
  planId: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface ActivateSubscriptionInput {
  subscriptionId: string;
  adminId: string;
  plan: PlanRecord;
  note: string;
  kind: ActivationKind;
  periodStart: Date;
  previousPeriodEnd: Date | null;
  newPeriodEnd: Date;
  idempotencyKey: string | null;
  requestHash: string | null;
  activatedAt: Date;
}

export interface ActivationResult {
  subscription: SubscriptionRecord;
  activation: ActivationRecord;
  replayed: boolean;
}

/** Puerto de salida: suscripciones, planes e historial. */
export interface SubscriptionRepository {
  findPlans(): Promise<PlanRecord[]>;
  findPlanById(planId: string): Promise<PlanRecord | null>;
  findPlanByCode(code: string): Promise<PlanRecord | null>;
  findByBusinessId(businessId: string): Promise<SubscriptionRecord | null>;
  ensureFreeSubscription(input: EnsureFreeSubscriptionInput): Promise<SubscriptionRecord>;
  expireOverdue(now: Date): Promise<number>;
  listAdmin(query: AdminSubscriptionQuery): Promise<AdminSubscriptionPage>;
  history(businessId: string): Promise<ActivationRecord[]>;
  activate(input: ActivateSubscriptionInput): Promise<ActivationResult>;
}
