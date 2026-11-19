import { getJson, patchJson, postJson } from './api';

export type LeadStatus = 'NEW' | 'READ' | 'REPLIED' | 'ARCHIVED' | 'SPAM';
export type LeadSource = 'LISTING' | 'BUSINESS_PROFILE';

export interface Lead {
  id: string;
  listingId: string | null;
  listingTitle: string | null;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  message: string;
  status: LeadStatus;
  source: LeadSource;
  consentAt: string;
  createdAt: string;
  expiresAt: string;
}

export interface LeadList {
  items: Lead[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unreadCount: number;
}

export interface LeadSummary {
  unreadCount: number;
  total: number;
}

export interface LeadFormToken {
  token: string;
  minSeconds: number;
  ttlSeconds: number;
}

export interface CreateLeadInput {
  businessSlug: string;
  listingSlug?: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  message: string;
  consent: boolean;
  website: string;
  formToken: string;
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'Nuevo',
  READ: 'Leído',
  REPLIED: 'Respondido',
  ARCHIVED: 'Archivado',
  SPAM: 'Spam',
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  LISTING: 'Publicación',
  BUSINESS_PROFILE: 'Perfil del negocio',
};

export const LEAD_STATUS_TONES: Record<
  LeadStatus,
  'brand' | 'success' | 'warning' | 'neutral' | 'danger' | 'outline'
> = {
  NEW: 'brand',
  READ: 'neutral',
  REPLIED: 'success',
  ARCHIVED: 'outline',
  SPAM: 'danger',
};

/** Estados que el negocio puede fijar manualmente (nunca NEW). */
export const BUSINESS_SETTABLE_STATUSES: LeadStatus[] = ['REPLIED', 'ARCHIVED', 'SPAM'];

export function formatLeadDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function leadsFilterQuery(filters: {
  status?: LeadStatus | '';
  search?: string;
  page: number;
  limit: number;
}): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  const search = filters.search?.trim();
  if (search) params.set('search', search);
  params.set('page', String(filters.page));
  params.set('limit', String(filters.limit));
  return params.toString();
}

/** Token que firma el servidor: evita que el navegador falsee el tiempo mínimo. */
export function fetchLeadFormToken(): Promise<LeadFormToken> {
  return getJson<LeadFormToken>('/public/leads/form-token');
}

export function submitPublicLead(
  input: CreateLeadInput,
): Promise<{ ok: boolean; message: string }> {
  return postJson<{ ok: boolean; message: string }>('/public/leads', input);
}

export function fetchLeads(filters: {
  status?: LeadStatus | '';
  search?: string;
  page: number;
  limit: number;
}): Promise<LeadList> {
  return getJson<LeadList>(`/businesses/me/leads?${leadsFilterQuery(filters)}`);
}

export function fetchLeadSummary(): Promise<LeadSummary> {
  return getJson<LeadSummary>('/businesses/me/leads/summary');
}

export function fetchLead(leadId: string): Promise<Lead> {
  return getJson<Lead>(`/businesses/me/leads/${leadId}`);
}

export function updateLeadStatus(leadId: string, status: LeadStatus): Promise<Lead> {
  return patchJson<Lead>(`/businesses/me/leads/${leadId}`, { status });
}

/** Mensaje en español para cada código de error del API de leads. */
export function leadErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case 'DUPLICATE_LEAD':
      return 'Ya enviaste un mensaje por este artículo en las últimas 24 horas. El negocio lo tiene.';
    case 'FORM_TOKEN_TOO_FAST':
      return 'Espera un segundo y vuelve a intentar: estamos verificando que no seas un robot.';
    case 'FORM_TOKEN_INVALID':
    case 'FORM_TOKEN_EXPIRED':
      return 'El formulario caducó. Cierra y vuelve a abrirlo para reintentar.';
    case 'RATE_LIMITED':
      return 'Demasiados mensajes seguidos. Espera unos minutos antes de volver a escribir.';
    case 'LISTING_NOT_AVAILABLE':
      return 'Esta publicación ya no está disponible. Mira otras del mismo negocio.';
    case 'BUSINESS_NOT_AVAILABLE':
      return 'Este negocio no está disponible en este momento.';
    case 'INVALID_PHONE':
      return 'Revisa el teléfono: debe ser un celular colombiano o un número con indicativo.';
    case 'INVALID_EMAIL':
      return 'Revisa el correo electrónico.';
    case 'INVALID_NAME':
      return 'Escribe tu nombre completo.';
    case 'INVALID_MESSAGE':
      return 'El mensaje debe tener entre 10 y 2000 caracteres.';
    case 'CONSENT_REQUIRED':
      return 'Marca la casilla de consentimiento para que el negocio pueda contactarte.';
    default:
      return fallback;
  }
}
