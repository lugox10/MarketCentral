import type {
  AmvaCity,
  BusinessStatus,
  MembershipRole,
  SubscriptionStatus,
} from '../domain/business.js';

/** Vista del negocio que devuelve la API (sin datos internos). */
export interface BusinessProfile {
  id: string;
  name: string;
  slug: string;
  city: AmvaCity;
  addressLine: string | null;
  whatsapp: string;
  status: BusinessStatus;
  createdAt: Date;
}

export interface PlanSummary {
  id: string;
  code: string;
  name: string;
  priceCop: number;
  intervalMonths: number;
  trialDays: number;
}

export interface SubscriptionView {
  id: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  plan: PlanSummary;
}

/** Negocio + membresía del actor + suscripción vigente. */
export interface BusinessContext {
  business: BusinessProfile;
  membershipRole: MembershipRole;
  subscription: SubscriptionView | null;
}

export interface BusinessWithOwner extends BusinessProfile {
  owner: { id: string; name: string; email: string } | null;
  subscriptionStatus: SubscriptionStatus | null;
  planName: string | null;
}

export interface CreateBusinessInput {
  userId: string;
  name: string;
  city: AmvaCity;
  addressLine: string | null;
  whatsapp: string;
  slug: string;
  now: Date;
  periodEnd: Date;
  planId: string;
  subscriptionStatus: 'TRIALING' | 'ACTIVE';
}

export interface UpdateBusinessInput {
  name?: string;
  city?: AmvaCity;
  addressLine?: string | null;
  whatsapp?: string;
}

/** Puerto de salida: persistencia del negocio y su membresía. */
export interface BusinessRepository {
  findByUserId(userId: string): Promise<BusinessContext | null>;
  createWithOwner(input: CreateBusinessInput): Promise<BusinessContext>;
  updateProfile(businessId: string, data: UpdateBusinessInput): Promise<BusinessProfile>;
  updateStatus(businessId: string, status: BusinessStatus): Promise<BusinessProfile>;
  listAll(): Promise<BusinessWithOwner[]>;
  findById(businessId: string): Promise<BusinessProfile | null>;
}

/** Puerto de salida: catálogo de planes. */
export interface PlanRepository {
  findByCode(code: string): Promise<PlanSummary | null>;
}
