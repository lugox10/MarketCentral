import type { ReportReason, ReportStatus } from '../domain/report.js';

export interface ReportRecord {
  id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  reporterEmail: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  resolvedBy: string | null;
  businessId: string;
  businessName: string;
  businessSlug: string;
  businessStatus: 'APPROVED' | 'SUSPENDED';
  listingId: string | null;
  listingTitle: string | null;
  listingSlug: string | null;
  listingStatus: string | null;
}

export interface CreateReportInput {
  businessId: string;
  listingId: string | null;
  reason: ReportReason;
  details: string | null;
  reporterEmail: string | null;
  reporterUserId: string | null;
  ipHash: string;
  duplicateSince: Date;
}

export interface ReportListQuery {
  status?: ReportStatus;
  reason?: ReportReason;
  search?: string;
  page: number;
  limit: number;
}

export interface ReportListResult {
  items: ReportRecord[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

export interface ModerationSummary {
  pending: number;
  reviewed: number;
  resolvedToday: number;
  suspendedBusinesses: number;
}

export interface BusinessModerationTarget {
  id: string;
  name: string;
  slug: string;
  status: 'APPROVED' | 'SUSPENDED';
}

export interface ListingModerationTarget {
  id: string;
  title: string;
  slug: string;
  status: string;
  businessId: string;
  businessName: string;
}

export interface ModerationRepository {
  /** Crea la denuncia salvo que ya exista una idéntica reciente de la misma IP. */
  createUnlessDuplicate(input: CreateReportInput): Promise<ReportRecord | null>;
  list(query: ReportListQuery): Promise<ReportListResult>;
  findById(reportId: string): Promise<ReportRecord | null>;
  setStatus(input: {
    reportId: string;
    status: ReportStatus;
    note: string | null;
    resolvedByAdminId: string;
    resolvedAt: Date | null;
  }): Promise<ReportRecord>;
  findBusiness(businessId: string): Promise<BusinessModerationTarget | null>;
  findListing(listingId: string): Promise<ListingModerationTarget | null>;
  setBusinessStatus(businessId: string, status: 'APPROVED' | 'SUSPENDED'): Promise<void>;
  archiveListing(listingId: string): Promise<void>;
  logAction(input: {
    actorUserId: string;
    reportId: string | null;
    businessId: string | null;
    listingId: string | null;
    kind:
      'REPORT_STATUS_CHANGED' | 'BUSINESS_SUSPENDED' | 'BUSINESS_REACTIVATED' | 'LISTING_ARCHIVED';
    reason: string;
  }): Promise<void>;
  summary(): Promise<ModerationSummary>;
}

export interface RateLimiter {
  consume(
    key: string,
    limit: number,
    windowMs: number,
  ): { allowed: boolean; retryAfterSeconds: number };
}
