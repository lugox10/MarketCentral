import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';

import type { SessionRepository, UserRepository } from '../application/ports.js';
import { SESSION_REPOSITORY, USER_REPOSITORY } from '../application/tokens.js';
import { hashToken } from '../domain/session-token.js';

export const SESSION_COOKIE = 'mc_session';

export interface AuthenticatedActor {
  userId: string;
  sessionId: string;
  email: string;
  name: string;
  role: string;
}

export type AuthenticatedRequest = Request & {
  actor?: AuthenticatedActor;
  sessionId?: string;
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException('Sesión no iniciada');

    const session = await this.sessions.findActiveByTokenHash(hashToken(token), new Date());
    if (!session) throw new UnauthorizedException('Sesión inválida o expirada');

    const user = await this.users.findById(session.userId);
    if (!user || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    request.actor = {
      userId: user.id,
      sessionId: session.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    request.sessionId = session.id;
    return true;
  }
}

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedActor => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.actor) throw new UnauthorizedException('Sesión no iniciada');
    return request.actor;
  },
);
