import { Catch, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

import { PublicCatalogError } from '../domain/public-catalog-error.js';

const STATUS_BY_CODE: Record<string, HttpStatus> = {
  PUBLIC_LISTING_NOT_FOUND: HttpStatus.NOT_FOUND,
  PUBLIC_BUSINESS_NOT_FOUND: HttpStatus.NOT_FOUND,
  PUBLIC_VERTICAL_NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_FILTERS: HttpStatus.BAD_REQUEST,
};

/** Traduce errores del catálogo público a respuestas HTTP estables. */
@Catch(PublicCatalogError)
export class PublicCatalogExceptionFilter implements ExceptionFilter {
  catch(exception: PublicCatalogError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = STATUS_BY_CODE[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      error: exception.code,
      message: exception.message,
    });
  }
}
