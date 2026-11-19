import { addCalendarMonths } from '../../../common/utils/dates.js';

export const LEAD_STATUSES = ['NEW', 'READ', 'REPLIED', 'ARCHIVED', 'SPAM'] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = ['LISTING', 'BUSINESS_PROFILE'] as const;
export type LeadSourceValue = (typeof LEAD_SOURCES)[number];

/** Estados que el negocio puede fijar a mano (nunca NEW). */
export const BUSINESS_SETTABLE_STATUSES = ['REPLIED', 'ARCHIVED', 'SPAM'] as const;

export const LEAD_NAME_MIN = 2;
export const LEAD_NAME_MAX = 100;
export const LEAD_EMAIL_MAX = 320;
export const LEAD_PHONE_MAX = 20;
export const LEAD_MESSAGE_MIN = 10;
export const LEAD_MESSAGE_MAX = 2000;
export const LEAD_RETENTION_MONTHS = 12;
export const LEAD_DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+[1-9][0-9]{7,14}$/;
// eslint-disable-next-line no-control-regex -- se eliminan caracteres de control del mensaje del comprador
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function normalizeLeadName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function isValidLeadName(value: string): boolean {
  return value.length >= LEAD_NAME_MIN && value.length <= LEAD_NAME_MAX;
}

export function normalizeLeadEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidLeadEmail(value: string): boolean {
  return value.length <= LEAD_EMAIL_MAX && EMAIL_PATTERN.test(value);
}

/**
 * Acepta formatos colombianos e internacionales y devuelve siempre E.164.
 * Un número de 10 dígitos que empieza por 3 se interpreta como celular colombiano.
 */
export function normalizeLeadPhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s().-]/g, '');
  if (!cleaned) return null;

  let candidate = cleaned;
  if (/^3\d{9}$/.test(candidate)) candidate = `+57${candidate}`;
  else if (/^57\d{10}$/.test(candidate)) candidate = `+${candidate}`;

  if (!PHONE_PATTERN.test(candidate)) return null;
  return candidate;
}

export function isValidLeadPhone(value: string): boolean {
  return value.length <= LEAD_PHONE_MAX && PHONE_PATTERN.test(value);
}

/** Quita caracteres de control y normaliza saltos de línea; nunca interpreta HTML. */
export function sanitizeLeadMessage(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(CONTROL_CHARS, '').trim();
}

export function isValidLeadMessage(value: string): boolean {
  return value.length >= LEAD_MESSAGE_MIN && value.length <= LEAD_MESSAGE_MAX;
}

/** Retención: 12 meses calendario desde la creación, no 365 días. */
export function computeLeadsExpiresAt(createdAt: Date): Date {
  return addCalendarMonths(createdAt, LEAD_RETENTION_MONTHS);
}

export function isLeadStatus(value: string): value is LeadStatusValue {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

export function isBusinessSettableStatus(value: string): boolean {
  return (BUSINESS_SETTABLE_STATUSES as readonly string[]).includes(value);
}

/** El negocio nunca vuelve un lead a NEW; repetir el mismo estado es idempotente. */
export function canSetLeadStatus(current: LeadStatusValue, next: LeadStatusValue): boolean {
  if (current === next) return true;
  return isBusinessSettableStatus(next);
}

export function leadStatusRequiresAttention(status: LeadStatusValue): boolean {
  return status === 'NEW';
}
