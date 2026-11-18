import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { CategoryError, type CategoryErrorCode } from '../domain/category-error.js';

const STATUS: Record<CategoryErrorCode, number> = {
  INVALID_INPUT: HttpStatus.BAD_REQUEST,
  INVALID_CATEGORY_NAME: HttpStatus.BAD_REQUEST,
  INVALID_CATEGORY_PARENT: HttpStatus.BAD_REQUEST,
  CATEGORY_NOT_FOUND: HttpStatus.NOT_FOUND,
  CATEGORY_NOT_OWNED: HttpStatus.FORBIDDEN,
  CATEGORY_LIMIT_REACHED: HttpStatus.CONFLICT,
  DUPLICATE_CATEGORY: HttpStatus.CONFLICT,
  CATEGORY_HAS_LISTINGS: HttpStatus.CONFLICT,
};

/** Traduce `CategoryError` a HTTP con el mismo sobre que el resto de la API. */
@Catch(CategoryError)
export class CategoryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CategoryExceptionFilter.name);

  catch(error: CategoryError, host: ArgumentsHost): void {
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
