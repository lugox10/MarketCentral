/** Tipos del contrato E2 (negocio, plan y suscripción). */

export const AMVA_CITY_LABELS = {
  MEDELLIN: 'Medellín',
  BELLO: 'Bello',
  ITAGUI: 'Itagüí',
  ENVIGADO: 'Envigado',
  SABANETA: 'Sabaneta',
  LA_ESTRELLA: 'La Estrella',
  CALDAS: 'Caldas',
  COPACABANA: 'Copacabana',
  GIRARDOTA: 'Girardota',
  BARBOSA: 'Barbosa',
} as const;

export type AmvaCity = keyof typeof AMVA_CITY_LABELS;

export const AMVA_CITIES = Object.keys(AMVA_CITY_LABELS) as AmvaCity[];

export interface Plan {
  id: string;
  code: string;
  name: string;
  priceCop: number;
  currency: string;
  maxListings: number;
  maxCategories: number;
  featuredSlots: number;
  trialMonths: number;
  trialDays: number | null;
  billingPeriodDays: number | null;
  isActive: boolean;
}

export interface Subscription {
  id: string;
  status: 'TRIALING' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  plan: Plan;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  city: AmvaCity;
  addressLine: string;
  whatsapp: string;
  status: 'APPROVED' | 'SUSPENDED';
  verticalId: string;
  verticalName: string;
  flaggedForReview: boolean;
  createdAt: string;
}

export interface MyBusiness {
  business: Business;
  membershipRole: 'OWNER' | 'MANAGER' | 'STAFF';
  subscription: Subscription | null;
}

export interface AdminBusiness extends Business {
  owner: { id: string; name: string; email: string } | null;
  subscriptionStatus: Subscription['status'] | null;
  planName: string | null;
}

const STATUS_LABELS: Record<Subscription['status'], string> = {
  TRIALING: 'Prueba',
  ACTIVE: 'Activa',
  SUSPENDED: 'Suspendida',
  EXPIRED: 'Vencida',
  CANCELLED: 'Cancelada',
};

export function subscriptionLabel(subscription: Subscription | null): string {
  if (!subscription) return 'Sin suscripción';
  return `Plan ${subscription.plan.name} · ${STATUS_LABELS[subscription.status]}`;
}

/** «Vence el 12 de enero de 2027» a partir de una fecha ISO. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

export function cityLabel(city: AmvaCity): string {
  return AMVA_CITY_LABELS[city] ?? city;
}
