import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { TaxonomyError, type TaxonomyErrorCode } from '../domain/taxonomy-error.js';

const STATUS: Record<TaxonomyErrorCode, number> = {
  INVALID_NAME: HttpStatus.BAD_REQUEST,
  INVALID_SLUG: HttpStatus.BAD_REQUEST,
  INVALID_CODE: HttpStatus.BAD_REQUEST,
  INVALID_TYPE: HttpStatus.BAD_REQUEST,
  INVALID_OPTIONS: HttpStatus.BAD_REQUEST,
  INVALID_INPUT: HttpStatus.BAD_REQUEST,
  VERTICAL_NOT_FOUND: HttpStatus.NOT_FOUND,
  CATEGORY_NOT_FOUND: HttpStatus.NOT_FOUND,
  PARENT_VERTICAL_MISMATCH: HttpStatus.BAD_REQUEST,
  PARENT_CYCLE: HttpStatus.BAD_REQUEST,
  DUPLICATE_VERTICAL: HttpStatus.CONFLICT,
  DUPLICATE_CATEGORY: HttpStatus.CONFLICT,
  DUPLICATE_CODE: HttpStatus.CONFLICT,
};

interface PrismaKnownError {
  code?: string;
}

export function isPrismaUniqueViolation(error: unknown): error is PrismaKnownError {
  return (
    typeof error === 'object' && error !== null && (error as PrismaKnownError).code === 'P2002'
  );
}

/**
 * Traduce errores de taxonomía a HTTP. Las carreras de unicidad se convierten en
 * `TaxonomyError` dentro del repositorio, así que aquí no hace falta un filtro
 * global: eso mantendría intactos los 401/403 de los guards.
 */
@Catch(TaxonomyError)
export class TaxonomyExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(TaxonomyExceptionFilter.name);

  catch(error: TaxonomyError, host: ArgumentsHost): void {
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
