import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Límite de peticiones para el catálogo público.
 *
 * Ventana fija en memoria por IP y ruta. Es deliberadamente simple: el MVP corre
 * en una sola instancia del API. Con varias réplicas cada una tendría su propio
 * contador; cuando eso ocurra, el límite debe moverse a un almacén compartido
 * (Redis) sin cambiar la firma del guard.
 */
@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  private readonly windowMs = 60_000;
  private readonly max = Number(process.env.PUBLIC_RATE_LIMIT ?? 180);
  private readonly hits = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { ip?: string }>();
    const key = `${request.ip ?? 'unknown'}:${request.route?.path ?? request.path}`;
    const now = Date.now();
    const timestamps = (this.hits.get(key) ?? []).filter((time) => now - time < this.windowMs);

    if (timestamps.length >= this.max) {
      this.hits.set(key, timestamps);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'RATE_LIMITED',
          message: 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);

    // Poda oportunista para que el mapa no crezca sin límite.
    if (this.hits.size > 5_000) {
      for (const [entryKey, entry] of this.hits) {
        if (entry.every((time) => now - time >= this.windowMs)) this.hits.delete(entryKey);
      }
    }

    return true;
  }
}
