import { createHash, randomBytes } from 'node:crypto';

/** Vida de una sesión (7 días) y de los tokens de correo. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Solo se persiste el hash: el token en claro nunca toca la base. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Hash estable de IP con secreto (nunca se guarda la IP cruda). */
export function hashIp(ip: string | undefined, secret: string): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${secret}:${ip}`).digest('hex');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
