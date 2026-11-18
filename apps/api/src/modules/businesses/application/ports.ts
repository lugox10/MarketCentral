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
  addressLine: string;
  whatsapp: string;
  verticalId: string;
  verticalName: string | null;
  flaggedForReview: boolean;
  status: BusinessStatus;
  createdAt: Date;
}

export interface PlanSummary {
  id: string;
  code: string;
  name: string;
  priceCop: number;
  currency: string;
  maxListings: number;
  maxCategories: number;
  featuredSlots: number;
  /** Meses calendario de prueba del plan (0 = sin prueba). */
  trialMonths: number;
  /** Días de prueba que sustituyen a los meses cuando están definidos. */
  trialDays: number | null;
  /** Días exactos del periodo pagado (0 = plan no pagado). */
  billingPeriodDays: number | null;
  isActive: boolean;
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

export interface VerticalRecord {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface CreateBusinessInput {
  ownerUserId: string;
  verticalId: string;
  name: string;
  city: AmvaCity;
  addressLine: string;
  whatsapp: string;
  fingerprint: string;
  slug: string;
  flaggedForReview: boolean;
  now: Date;
  periodEnd: Date;
  planId: string;
  subscriptionStatus: 'TRIALING' | 'ACTIVE';
}

export interface UpdateBusinessInput {
  name?: string;
  city?: AmvaCity;
  addressLine?: string;
  whatsapp?: string;
}

/**
 * Puerto de salida del módulo: persistencia del negocio, sus cupos y los
 * datos de vertical necesarios para validar el alta (D-40, D-41).
 */
export interface BusinessRepository {
  findByUserId(userId: string): Promise<BusinessContext | null>;
  createWithOwner(input: CreateBusinessInput): Promise<BusinessContext>;
  updateProfile(businessId: string, data: UpdateBusinessInput): Promise<BusinessProfile>;
  updateStatus(businessId: string, status: BusinessStatus): Promise<BusinessProfile>;
  listAll(): Promise<BusinessWithOwner[]>;
  findById(businessId: string): Promise<BusinessProfile | null>;
  findVertical(verticalId: string): Promise<VerticalRecord | null>;
  findFirstActiveVertical(): Promise<VerticalRecord | null>;
  countByOwner(userId: string): Promise<number>;
  lastCreatedAtByOwner(userId: string): Promise<Date | null>;
  findWhatsappInVertical(verticalId: string, whatsapp: string): Promise<boolean>;
  listFingerprints(verticalId: string): Promise<string[]>;
  countActiveListings(businessId: string): Promise<number>;
}

/** Puerto de salida: catálogo de planes. */
export interface PlanRepository {
  findByCode(code: string): Promise<PlanSummary | null>;
}

/** Categoría propia de un negocio (`category.business_id` no nulo). */
export interface BusinessCategory {
  id: string;
  verticalId: string;
  businessId: string | null;
  parentId: string | null;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
}

export interface CategoryParentOption {
  id: string;
  name: string;
  slug: string;
  isOwn: boolean;
}

export interface CreateBusinessCategoryInput {
  verticalId: string;
  businessId: string;
  parentId: string | null;
  name: string;
  slug: string;
}

/**
 * Puerto de salida: categorías propias del negocio. La categoría global
 * (`business_id IS NULL`) no se toca desde este puerto.
 */
export interface BusinessCategoryRepository {
  listByBusiness(businessId: string): Promise<BusinessCategory[]>;
  findById(categoryId: string): Promise<BusinessCategory | null>;
  countActiveByBusiness(businessId: string): Promise<number>;
  existsSlug(businessId: string, slug: string): Promise<boolean>;
  create(input: CreateBusinessCategoryInput): Promise<BusinessCategory>;
  setActive(categoryId: string, isActive: boolean): Promise<BusinessCategory>;
  rename(categoryId: string, name: string, slug: string): Promise<BusinessCategory>;
  listParentOptions(businessId: string, verticalId: string): Promise<CategoryParentOption[]>;
  countPublishedListings(categoryId: string): Promise<number>;
}
