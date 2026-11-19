import { createHmac, timingSafeEqual } from 'node:crypto';

/** Un formulario enviado antes de este tiempo es casi con seguridad un bot. */
export const MIN_FILL_MS = 3_000;
/** Vida máxima del token: nadie rellena un formulario en dos horas. */
export const FORM_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

export type FormTokenFailure = 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED' | 'TOO_FAST';

export interface FormTokenCheck {
  ok: boolean;
  reason?: FormTokenFailure;
  issuedAt?: Date;
}

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex').slice(0, 40);
}

/**
 * Token firmado por el servidor para medir el tiempo de relleno sin confiar en
 * un timestamp del navegador. No contiene datos personales: solo la emisión.
 */
export function createFormToken(issuedAt: Date, secret: string): string {
  const payload = `v1.${issuedAt.getTime().toString(36)}`;
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyFormToken(token: string, secret: string, now: Date): FormTokenCheck {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return { ok: false, reason: 'MALFORMED' };

  const payload = `${parts[0]}.${parts[1]}`;
  const expected = signature(payload, secret);
  const provided = parts[2] ?? '';

  if (provided.length !== expected.length) return { ok: false, reason: 'BAD_SIGNATURE' };
  if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    return { ok: false, reason: 'BAD_SIGNATURE' };
  }

  const issuedAtMs = Number.parseInt(parts[1] ?? '', 36);
  if (!Number.isFinite(issuedAtMs) || issuedAtMs <= 0) return { ok: false, reason: 'MALFORMED' };

  const issuedAt = new Date(issuedAtMs);
  const elapsed = now.getTime() - issuedAt.getTime();
  if (elapsed > FORM_TOKEN_TTL_MS) return { ok: false, reason: 'EXPIRED' };
  if (elapsed < MIN_FILL_MS) return { ok: false, reason: 'TOO_FAST' };

  return { ok: true, issuedAt };
}
