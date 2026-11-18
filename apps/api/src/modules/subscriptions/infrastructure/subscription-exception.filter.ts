import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { SubscriptionError, type SubscriptionErrorCode } from '../domain/subscription-error.js';

const STATUS: Record<SubscriptionErrorCode, number> = {
  INVALID_INPUT: HttpStatus.BAD_REQUEST,
  INVALID_NOTE: HttpStatus.BAD_REQUEST,
  INVALID_IDEMPOTENCY_KEY: HttpStatus.BAD_REQUEST,
  PLAN_NOT_FOUND: HttpStatus.NOT_FOUND,
  PLAN_INACTIVE: HttpStatus.BAD_REQUEST,
  PLAN_NOT_PAYABLE: HttpStatus.BAD_REQUEST,
  BUSINESS_NOT_FOUND: HttpStatus.NOT_FOUND,
  SUBSCRIPTION_NOT_FOUND: HttpStatus.NOT_FOUND,
  IDEMPOTENCY_CONFLICT: HttpStatus.CONFLICT,
  FORBIDDEN: HttpStatus.FORBIDDEN,
};

/**
 * Traduce los errores de suscripciones al formato de error del proyecto.
 *
 * Se registra por controlador (no como filtro global) para no capturar los 401
 * y 403 que emiten `SessionGuard` y `RolesGuard` y convertirlos en 500.
 */
@Catch(SubscriptionError)
export class SubscriptionExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SubscriptionExceptionFilter.name);

  catch(error: SubscriptionError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = STATUS[error.code] ?? HttpStatus.BAD_REQUEST;

    if (status >= 500) {
      this.logger.error(`${error.code}: ${error.message}`);
    }

    response.status(status).json({
      statusCode: status,
      error: error.code,
      message: error.message,
    });
  }
}
