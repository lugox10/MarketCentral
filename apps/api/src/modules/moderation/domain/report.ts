/** Dominio de moderación: motivos, estados y reglas de una denuncia. */

export const REPORT_REASONS = [
  'SCAM',
  'STOLEN',
  'INAPPROPRIATE',
  'WRONG_CATEGORY',
  'OTHER',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SCAM: 'Posible estafa',
  STOLEN: 'Artículo robado',
  INAPPROPRIATE: 'Contenido inapropiado',
  WRONG_CATEGORY: 'Categoría equivocada',
  OTHER: 'Otro motivo',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: 'Pendiente',
  REVIEWED: 'En revisión',
  RESOLVED: 'Resuelta',
  DISMISSED: 'Descartada',
};

export const DETAILS_MIN = 10;
export const DETAILS_MAX = 2000;
export const NOTE_MIN = 5;
export const NOTE_MAX = 500;
export const ACTION_REASON_MIN = 5;
export const ACTION_REASON_MAX = 500;
export const EMAIL_MAX = 320;

/** Ventana de deduplicación: la misma IP no puede denunciar lo mismo dos veces al día. */
export const REPORT_DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Límite anti-abuso del formulario público. */
export const REPORT_RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };

/**
 * Transiciones permitidas. RESOLVED y DISMISSED son terminales: reabrir una
 * denuncia cerrada dejaría el historial de auditoría mintiendo.
 */
const TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  PENDING: ['REVIEWED', 'RESOLVED', 'DISMISSED'],
  REVIEWED: ['RESOLVED', 'DISMISSED'],
  RESOLVED: [],
  DISMISSED: [],
};

export function isReportStatus(value: unknown): value is ReportStatus {
  return typeof value === 'string' && (REPORT_STATUSES as readonly string[]).includes(value);
}

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === 'string' && (REPORT_REASONS as readonly string[]).includes(value);
}

export function canChangeReportStatus(from: ReportStatus, to: ReportStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

export function isTerminalStatus(status: ReportStatus): boolean {
  return status === 'RESOLVED' || status === 'DISMISSED';
}

/** Normaliza los detalles: colapsa saltos de línea repetidos y recorta. */
export function normalizeReportDetails(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized.length === 0 ? null : normalized;
}

export function isValidReportDetails(value: string | null): boolean {
  if (value == null) return true;
  return value.length >= DETAILS_MIN && value.length <= DETAILS_MAX;
}

export function normalizeReportEmail(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length === 0 ? null : trimmed;
}

export function isValidReportEmail(value: string | null): boolean {
  if (value == null) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= EMAIL_MAX;
}

export function isValidActionReason(value: string | null): boolean {
  if (value == null) return false;
  const trimmed = value.trim();
  return trimmed.length >= ACTION_REASON_MIN && trimmed.length <= ACTION_REASON_MAX;
}
