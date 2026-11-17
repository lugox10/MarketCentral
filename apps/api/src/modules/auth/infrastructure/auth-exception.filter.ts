import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { AuthError, type AuthErrorCode } from '../domain/auth-error.js';

const STATUS_BY_CODE: Record<AuthErrorCode, number> = {
  EMAIL_TAKEN: HttpStatus.CONFLICT,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  INVALID_TOKEN: HttpStatus.GONE,
  TOKEN_EXPIRED: HttpStatus.GONE,
  USER_SUSPENDED: HttpStatus.FORBIDDEN,
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
};

/** Traduce errores de dominio a HTTP sin que el dominio conozca Express. */
@Catch(AuthError)
export class AuthExceptionFilter implements ExceptionFilter<AuthError> {
  private readonly logger = new Logger(AuthExceptionFilter.name);

  catch(exception: AuthError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = STATUS_BY_CODE[exception.code] ?? HttpStatus.BAD_REQUEST;
    if (status >= 500) this.logger.error(exception.message);
    response.status(status).json({
      statusCode: status,
      error: exception.code,
      message: exception.message,
    });
  }
}
