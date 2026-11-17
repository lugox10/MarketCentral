import { Inject, Injectable, Logger } from '@nestjs/common';

import { AuthError } from '../domain/auth-error.js';
import type { PasswordHasher } from '../domain/password-hasher.js';
import { RESET_TOKEN_TTL_MS, generateOpaqueToken, hashToken } from '../domain/session-token.js';
import type { MailSender, SessionRepository, TokenRepository, UserRepository } from './ports.js';
import {
  MAIL_SENDER,
  PASSWORD_HASHER,
  RESET_TOKEN_REPOSITORY,
  SESSION_REPOSITORY,
  USER_REPOSITORY,
} from './tokens.js';

@Injectable()
export class RequestPasswordResetUseCase {
  private readonly logger = new Logger(RequestPasswordResetUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(RESET_TOKEN_REPOSITORY) private readonly tokens: TokenRepository,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
  ) {}

  /** Siempre 202: no se revela si el correo está registrado. */
  async execute(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return;

    const token = generateOpaqueToken();
    await this.tokens.create({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });

    try {
      await this.mail.sendPasswordResetEmail({ to: user.email, name: user.name, token });
    } catch (error: unknown) {
      this.logger.warn(`Envío de restablecimiento falló para ${user.email}: ${String(error)}`);
    }
  }
}

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(RESET_TOKEN_REPOSITORY) private readonly tokens: TokenRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: { token: string; password: string }): Promise<void> {
    const record = await this.tokens.findActiveByTokenHash(hashToken(input.token));
    if (!record || record.usedAt) {
      throw new AuthError('INVALID_TOKEN', 'El token no es válido');
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      throw new AuthError('TOKEN_EXPIRED', 'El token expiró');
    }

    const passwordHash = await this.hasher.hash(input.password);
    await this.users.updatePassword(record.userId, passwordHash);
    await this.tokens.markUsed(record.id);
    // Cambiar contraseña cierra todas las sesiones abiertas.
    await this.sessions.revokeAllForUser(record.userId);
  }
}
