import { Inject, Injectable } from '@nestjs/common';

import { AuthError } from '../domain/auth-error.js';
import type { PasswordHasher } from '../domain/password-hasher.js';
import { SESSION_TTL_MS, generateOpaqueToken, hashToken } from '../domain/session-token.js';
import type { SessionRepository, UserRepository } from './ports.js';
import { PASSWORD_HASHER, SESSION_REPOSITORY, USER_REPOSITORY } from './tokens.js';

export interface LoginInput {
  email: string;
  password: string;
  ipHash: string | null;
  userAgent: string | null;
}

export interface LoginResult {
  token: string;
  expiresAt: Date;
  user: { id: string; email: string; name: string; role: string; emailVerified: boolean };
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const user = await this.users.findByEmail(input.email);
    // Mismo error para correo inexistente y contraseña incorrecta (no enumerar cuentas).
    if (!user) throw new AuthError('INVALID_CREDENTIALS', 'Credenciales inválidas');
    if (user.status === 'SUSPENDED') {
      throw new AuthError('USER_SUSPENDED', 'La cuenta está suspendida');
    }

    const valid = await this.hasher.verify(user.passwordHash, input.password);
    if (!valid) throw new AuthError('INVALID_CREDENTIALS', 'Credenciales inválidas');

    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.sessions.create({
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt,
      ipHash: input.ipHash,
      userAgent: input.userAgent,
    });

    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerifiedAt !== null,
      },
    };
  }
}
