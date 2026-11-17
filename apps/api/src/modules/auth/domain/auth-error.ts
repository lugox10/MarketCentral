/**
 * Errores de dominio de identidad. No conocen HTTP: el filtro de la capa de
 * infraestructura los traduce a códigos de estado.
 */
export type AuthErrorCode =
  | 'EMAIL_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'USER_SUSPENDED'
  | 'UNAUTHENTICATED';

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'AuthError';
  }
}
