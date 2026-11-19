import { getJson, patchJson, postJson } from './api';

export type ReportReason = 'SCAM' | 'STOLEN' | 'INAPPROPRIATE' | 'WRONG_CATEGORY' | 'OTHER';
export type ReportStatus = 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';

export const REPORT_REASONS: Array<{ value: ReportReason; label: string; hint: string }> = [
  { value: 'SCAM', label: 'Posible estafa', hint: 'Pide anticipos o datos raros.' },
  { value: 'STOLEN', label: 'Artículo robado', hint: 'Hay indicios de procedencia ilegal.' },
  { value: 'INAPPROPRIATE', label: 'Contenido inapropiado', hint: 'Fotos o texto ofensivos.' },
  {
    value: 'WRONG_CATEGORY',
    label: 'Categoría equivocada',
    hint: 'No corresponde a la vertical o categoría.',
  },
  { value: 'OTHER', label: 'Otro motivo', hint: 'Cuéntanos qué pasa.' },
];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SCAM: 'Posible estafa',
  STOLEN: 'Artículo robado',
  INAPPROPRIATE: 'Contenido inapropiado',
  WRONG_CATEGORY: 'Categoría equivocada',
  OTHER: 'Otro motivo',
};

export const REPORT_STATUSES: ReportStatus[] = ['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'];

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: 'Pendiente',
  REVIEWED: 'En revisión',
  RESOLVED: 'Resuelto',
  DISMISSED: 'Descartado',
};

export const REPORT_STATUS_TONES: Record<
  ReportStatus,
  'warning' | 'brand' | 'success' | 'neutral'
> = {
  PENDING: 'warning',
  REVIEWED: 'brand',
  RESOLVED: 'success',
  DISMISSED: 'neutral',
};

export interface ReportTargetBusiness {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface ReportTargetListing {
  id: string;
  title: string;
  slug: string;
  status: string;
}

export interface Report {
  id: string;
  reason: ReportReason;
  status: ReportStatus;
  details: string | null;
  reporterEmail: string | null;
  reporterUserId: string | null;
  createdAt: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  business: ReportTargetBusiness;
  listing: ReportTargetListing | null;
}

export interface ReportPage {
  items: Report[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ModerationSummary {
  pending: number;
  reviewed: number;
  resolvedToday: number;
  suspendedBusinesses: number;
}

export interface CreateReportInput {
  businessSlug: string;
  listingSlug?: string;
  reason: ReportReason;
  details?: string;
  reporterEmail?: string;
  website: string;
}

export interface ReportFilters {
  status?: ReportStatus | '';
  reason?: ReportReason | '';
  q?: string;
  page?: number;
  limit?: number;
}

export function formatReportDate(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function reportsQuery(filters: ReportFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.reason) params.set('reason', filters.reason);
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 20));
  return params.toString();
}

/** Denuncia pública. No exige sesión; si la hay, el backend la registra. */
export function submitReport(input: CreateReportInput): Promise<{ ok: boolean; message: string }> {
  return postJson('/public/reports', input);
}

export function fetchReports(filters: ReportFilters): Promise<ReportPage> {
  return getJson(`/admin/reports?${reportsQuery(filters)}`);
}

export function fetchReportSummary(): Promise<ModerationSummary> {
  return getJson('/admin/reports/summary');
}

export function fetchReport(reportId: string): Promise<Report> {
  return getJson(`/admin/reports/${reportId}`);
}

export function updateReportStatus(
  reportId: string,
  input: { status: ReportStatus; note?: string },
): Promise<Report> {
  return patchJson(`/admin/reports/${reportId}`, input);
}

export function suspendBusiness(
  businessId: string,
  reason: string,
): Promise<{ ok: boolean; message: string }> {
  return postJson(`/admin/businesses/${businessId}/suspend`, { reason });
}

export function archiveListing(
  listingId: string,
  reason: string,
  reportId?: string,
): Promise<{ ok: boolean; message: string }> {
  return postJson(`/admin/listings/${listingId}/archive`, { reason, reportId });
}

/** Traduce los códigos del backend a un mensaje que se pueda mostrar. */
export function reportErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case 'INVALID_DETAILS':
      return 'Cuéntanos un poco más (mínimo 10 caracteres).';
    case 'INVALID_EMAIL':
      return 'Revisa el correo electrónico.';
    case 'DUPLICATE_REPORT':
      return 'Ya recibimos este reporte hace poco. Lo estamos revisando.';
    case 'RATE_LIMITED':
      return 'Recibimos varios reportes desde tu conexión. Inténtalo más tarde.';
    case 'LISTING_NOT_AVAILABLE':
      return 'Esta publicación ya no está disponible.';
    case 'BUSINESS_NOT_AVAILABLE':
      return 'Este negocio ya no está disponible.';
    case 'INVALID_TRANSITION':
      return 'Ese cambio de estado no es posible: el reporte ya está cerrado.';
    case 'REPORT_NOT_FOUND':
      return 'El reporte ya no existe.';
    default:
      return fallback;
  }
}
