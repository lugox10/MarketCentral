import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { BusinessError, type BusinessErrorCode } from '../domain/business-error.js';

const STATUS: Record<BusinessErrorCode, number> = {
  ALREADY_HAS_BUSINESS: HttpStatus.CONFLICT,
  BUSINESS_NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_CITY: HttpStatus.BAD_REQUEST,
  INVALID_WHATSAPP: HttpStatus.BAD_REQUEST,
  INVALID_NAME: HttpStatus.BAD_REQUEST,
  INVALID_ADDRESS: HttpStatus.BAD_REQUEST,
  INVALID_INPUT: HttpStatus.BAD_REQUEST,
  INVALID_STATUS: HttpStatus.BAD_REQUEST,
  PLAN_NOT_FOUND: HttpStatus.SERVICE_UNAVAILABLE,
  SLUG_EXHAUSTED: HttpStatus.CONFLICT,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  LAST_OWNER: HttpStatus.CONFLICT,
  VERTICAL_NOT_FOUND: HttpStatus.NOT_FOUND,
  VERTICAL_INACTIVE: HttpStatus.CONFLICT,
  WHATSAPP_TAKEN: HttpStatus.CONFLICT,
  DUPLICATE_BUSINESS: HttpStatus.CONFLICT,
  OWNER_LIMIT_REACHED: HttpStatus.CONFLICT,
  NEW_BUSINESS_TOO_SOON: HttpStatus.CONFLICT,
  SIGNUPS_CLOSED: HttpStatus.CONFLICT,
};

/** Traduce `BusinessError` a HTTP sin filtrar detalles internos. */
@Catch(BusinessError)
export class BusinessExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(BusinessExceptionFilter.name);

  catch(error: BusinessError, host: ArgumentsHost): void {
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
