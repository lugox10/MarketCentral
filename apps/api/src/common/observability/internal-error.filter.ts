import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Red de seguridad para errores no controlados.
 *
 * Los filtros de cada módulo siguen respondiendo los códigos de dominio; este
 * solo se activa cuando nada más capturó la excepción. Registra el stack con el
 * `requestId` de la petición y devuelve un mensaje genérico: los detalles
 * internos nunca llegan al cliente.
 */
@Catch()
export class InternalErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(error: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const requestId = String(response.locals?.requestId ?? '');
    const status =
      error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      const stack = error instanceof Error ? error.stack : undefined;
      const cause = error instanceof Error ? error.message : String(error);
      this.logger.error(
        JSON.stringify({
          event: 'http_error',
          requestId,
          method: request.method,
          path: request.path.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id'),
          status,
          cause,
          stack: stack?.split('\n').slice(0, 8).join('\n'),
        }),
      );
    }

    if (response.headersSent) return;

    if (error instanceof HttpException) {
      const payload = error.getResponse();
      response
        .status(status)
        .json(typeof payload === 'string' ? { statusCode: status, message: payload } : payload);
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_ERROR',
      message: 'Algo salió mal de nuestro lado. Inténtalo de nuevo en un momento.',
      requestId,
    });
  }
}
