import { Inject, Injectable } from '@nestjs/common';

import type { SessionRepository, UserRepository } from './ports.js';
import { SESSION_REPOSITORY, USER_REPOSITORY } from './tokens.js';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
}

@Injectable()
export class GetCurrentUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(userId: string): Promise<CurrentUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new Error('Usuario no encontrado');
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
    };
  }
}

@Injectable()
export class LogoutUseCase {
  constructor(@Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository) {}

  async execute(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId);
  }
}
