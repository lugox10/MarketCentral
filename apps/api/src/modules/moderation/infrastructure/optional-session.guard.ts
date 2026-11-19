import { Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import { SessionGuard } from '../../auth/infrastructure/session.guard.js';

/**
 * Intenta resolver la sesión pero nunca la exige: permite que una persona con
 * cuenta iniciada denuncie y quede identificada, sin obligar a iniciar sesión
 * para denunciar. Cualquier fallo de la sesión (cookie inválida, expirada) se
 * ignora a propósito: el reporte sigue siendo válido como anónimo.
 */
@Injectable()
export class OptionalSessionGuard implements CanActivate {
  constructor(@Inject(SessionGuard) private readonly sessionGuard: SessionGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await this.sessionGuard.canActivate(context);
    } catch {
      // Anónimo: sin actor en la request.
    }
    return true;
  }
}
