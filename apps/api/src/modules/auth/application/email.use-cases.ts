import { Inject, Injectable, Logger } from '@nestjs/common';

import { AuthError } from '../domain/auth-error.js';
import { EMAIL_TOKEN_TTL_MS, generateOpaqueToken, hashToken } from '../domain/session-token.js';
import type { MailSender, TokenRepository, UserRepository } from './ports.js';
import { MAIL_SENDER, USER_REPOSITORY, VERIFICATION_TOKEN_REPOSITORY } from './tokens.js';

@Injectable()
export class VerifyEmailUseCase {
  constructor(
    @Inject(VERIFICATION_TOKEN_REPOSITORY) private readonly tokens: TokenRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async execute(token: string): Promise<void> {
    const record = await this.tokens.findActiveByTokenHash(hashToken(token));
    if (!record || record.usedAt) {
      throw new AuthError('INVALID_TOKEN', 'El token no es válido');
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      throw new AuthError('TOKEN_EXPIRED', 'El token expiró');
    }

    await this.tokens.markUsed(record.id);
    await this.users.markEmailVerified(record.userId);
  }
}

@Injectable()
export class ResendVerificationUseCase {
  private readonly logger = new Logger(ResendVerificationUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(VERIFICATION_TOKEN_REPOSITORY) private readonly tokens: TokenRepository,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
  ) {}

  /** Respuesta uniforme (202) para no revelar si el correo existe. */
  async execute(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || user.emailVerifiedAt) return;

    const token = generateOpaqueToken();
    await this.tokens.create({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
    });

    try {
      await this.mail.sendVerificationEmail({ to: user.email, name: user.name, token });
    } catch (error: unknown) {
      this.logger.warn(`Reenvío de verificación falló para ${user.email}: ${String(error)}`);
    }
  }
}
