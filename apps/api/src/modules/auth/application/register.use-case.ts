import { Inject, Injectable, Logger } from '@nestjs/common';

import { AuthError } from '../domain/auth-error.js';
import type { PasswordHasher } from '../domain/password-hasher.js';
import { EMAIL_TOKEN_TTL_MS, generateOpaqueToken, hashToken } from '../domain/session-token.js';
import type { MailSender, TokenRepository, UserRepository } from './ports.js';
import {
  MAIL_SENDER,
  PASSWORD_HASHER,
  USER_REPOSITORY,
  VERIFICATION_TOKEN_REPOSITORY,
} from './tokens.js';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface RegisterResult {
  id: string;
  email: string;
  name: string;
}

@Injectable()
export class RegisterUseCase {
  private readonly logger = new Logger(RegisterUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(VERIFICATION_TOKEN_REPOSITORY) private readonly tokens: TokenRepository,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
  ) {}

  async execute(input: RegisterInput): Promise<RegisterResult> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new AuthError('EMAIL_TAKEN', 'Ya existe una cuenta con ese correo');
    }

    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({
      email: input.email,
      passwordHash,
      name: input.name.trim(),
    });

    const token = generateOpaqueToken();
    await this.tokens.create({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
    });

    // Un fallo del proveedor de correo no revierte el registro (E1-H6).
    try {
      await this.mail.sendVerificationEmail({ to: user.email, name: user.name, token });
    } catch (error: unknown) {
      this.logger.warn(`No se pudo enviar la verificación a ${user.email}: ${String(error)}`);
    }

    return { id: user.id, email: user.email, name: user.name };
  }
}
