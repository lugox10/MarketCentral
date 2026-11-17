import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from '../../modules/auth/infrastructure/session.guard.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/**
 * Autoriza por rol de plataforma (`SUPER_ADMIN`, `BUSINESS_OWNER`).
 *
 * Debe ejecutarse **después** de `SessionGuard`: no lee cookies ni tokens, solo
 * el `actor` que el guard de sesión dejó en la petición. Si no hay actor, la
 * sesión no es válida y el resultado es `401` (nunca `403`).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.actor) throw new UnauthorizedException('Sesión no iniciada');

    if (!required.includes(request.actor.role)) {
      throw new ForbiddenException('No tienes permisos para esta operación');
    }
    return true;
  }
}
