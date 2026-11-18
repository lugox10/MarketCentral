import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { ListingError, type ListingErrorCode } from '../domain/listing-error.js';

const STATUS: Record<ListingErrorCode, number> = {
  INVALID_INPUT: HttpStatus.BAD_REQUEST,
  INVALID_TITLE: HttpStatus.BAD_REQUEST,
  INVALID_DESCRIPTION: HttpStatus.BAD_REQUEST,
  INVALID_PRICE: HttpStatus.BAD_REQUEST,
  INVALID_CONDITION: HttpStatus.BAD_REQUEST,
  INVALID_STATUS_TRANSITION: HttpStatus.CONFLICT,
  LISTING_NOT_FOUND: HttpStatus.NOT_FOUND,
  LISTING_NOT_OWNED: HttpStatus.FORBIDDEN,
  LISTING_LOCKED: HttpStatus.CONFLICT,
  LISTING_LIMIT_REACHED: HttpStatus.CONFLICT,
  FEATURED_LIMIT_REACHED: HttpStatus.CONFLICT,
  CATEGORY_NOT_FOUND: HttpStatus.NOT_FOUND,
  CATEGORY_NOT_IN_VERTICAL: HttpStatus.BAD_REQUEST,
  CATEGORY_NOT_AVAILABLE: HttpStatus.BAD_REQUEST,
  INVALID_ATTRIBUTES: HttpStatus.BAD_REQUEST,
  IMAGE_LIMIT_REACHED: HttpStatus.CONFLICT,
  INVALID_IMAGE_TYPE: HttpStatus.BAD_REQUEST,
  IMAGE_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
  IMAGE_NOT_FOUND: HttpStatus.NOT_FOUND,
  BUSINESS_NOT_FOUND: HttpStatus.NOT_FOUND,
  SLUG_EXHAUSTED: HttpStatus.CONFLICT,
};

@Catch(ListingError)
export class ListingExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ListingExceptionFilter.name);

  catch(error: ListingError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = STATUS[error.code] ?? HttpStatus.BAD_REQUEST;

    if (status >= 500) this.logger.error(`${error.code}: ${error.message}`);

    response.status(status).json({ statusCode: status, error: error.code, message: error.message });
  }
}
