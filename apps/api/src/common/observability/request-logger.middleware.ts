import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { Logger } from '@nestjs/common';

const logger = new Logger('HTTP');

const SKIPPED_PREFIXES = ['/media/', '/favicon.ico', '/_next/'];
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const LONG_HEX_PATTERN = /\b[0-9a-f]{16,}\b/gi;

/**
 * Logger de peticiones en una sola línea JSON.
 *
 * Solo registra método, ruta normalizada, estado, duración y un id de
 * correlación. Nunca el cuerpo, la query cruda, cabeceras ni cookies: ahí
 * viajan correos, teléfonos y tokens de sesión.
 */
export function requestLogger(request: Request, response: Response, next: NextFunction): void {
  const requestId = randomUUID();
  const startedAt = process.hrtime.bigint();

  response.locals.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);

  response.on('finish', () => {
    if (SKIPPED_PREFIXES.some((prefix) => request.path.startsWith(prefix))) return;

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const line = {
      event: 'http_request',
      requestId,
      method: request.method,
      path: normalizePath(request),
      status: response.statusCode,
      durationMs: Math.round(durationMs),
    };

    if (response.statusCode >= 500) logger.error(JSON.stringify(line));
    else if (response.statusCode >= 400) logger.warn(JSON.stringify(line));
    else logger.log(JSON.stringify(line));
  });

  next();
}

/** Colapsa ids volátiles para que las métricas agrupen por ruta y no por recurso. */
export function normalizePath(request: Request): string {
  const route = (request as Request & { route?: { path?: string } }).route?.path;
  const raw = route ? `${request.baseUrl}${route === '/' ? '' : route}` : request.path;
  return raw.replace(UUID_PATTERN, ':id').replace(LONG_HEX_PATTERN, ':id');
}
