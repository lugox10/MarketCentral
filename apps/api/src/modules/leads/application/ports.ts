import type { LeadSourceValue, LeadStatusValue } from '../domain/lead.js';

export interface ContactTargetRecord {
  businessId: string;
  businessName: string;
  businessSlug: string;
  listingId: string | null;
  listingTitle: string | null;
  source: LeadSourceValue;
}

export interface LeadRecord {
  id: string;
  businessId: string;
  listingId: string | null;
  listingTitle: string | null;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  message: string;
  status: LeadStatusValue;
  source: LeadSourceValue;
  consentAt: Date;
  createdAt: Date;
  expiresAt: Date;
}

export interface CreateLeadInput {
  businessId: string;
  listingId: string | null;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  message: string;
  source: LeadSourceValue;
  consentAt: Date;
  ipHash: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface LeadRecipientRecord {
  email: string;
  name: string;
  businessName: string;
}

export interface LeadListQuery {
  businessId: string;
  status?: LeadStatusValue;
  search?: string;
  page: number;
  limit: number;
}

export interface LeadListResult {
  items: LeadRecord[];
  total: number;
  unreadCount: number;
}

export interface LeadRepository {
  /** Dueño del negocio (membresía OWNER) para el aviso por correo. */
  findRecipient(businessId: string): Promise<LeadRecipientRecord | null>;
  /**
   * Crea el lead salvo que exista otro del mismo correo para la misma publicación
   * dentro de la ventana de deduplicación. Debe ser atómico frente a concurrencia.
   */
  createUnlessDuplicate(
    input: CreateLeadInput,
    duplicateSince: Date,
  ): Promise<{ created: boolean; lead: LeadRecord | null }>;
  listByBusiness(query: LeadListQuery): Promise<LeadListResult>;
  findByIdForBusiness(leadId: string, businessId: string): Promise<LeadRecord | null>;
  /** Marca READ si el lead seguía en NEW; idempotente. */
  markRead(leadId: string, businessId: string): Promise<LeadRecord | null>;
  setStatus(
    leadId: string,
    businessId: string,
    status: LeadStatusValue,
  ): Promise<LeadRecord | null>;
}

/** Contador de ventana deslizante; sustituible por Redis sin tocar los casos de uso. */
export interface RateLimiter {
  consume(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}
