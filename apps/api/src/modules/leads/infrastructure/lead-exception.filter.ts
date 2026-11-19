import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

import { LeadError, type LeadErrorCode } from '../domain/lead-error.js';

const STATUS: Record<LeadErrorCode, HttpStatus> = {
  INVALID_INPUT: HttpStatus.BAD_REQUEST,
  INVALID_NAME: HttpStatus.BAD_REQUEST,
  INVALID_EMAIL: HttpStatus.BAD_REQUEST,
  INVALID_PHONE: HttpStatus.BAD_REQUEST,
  INVALID_MESSAGE: HttpStatus.BAD_REQUEST,
  INVALID_STATUS: HttpStatus.BAD_REQUEST,
  CONSENT_REQUIRED: HttpStatus.BAD_REQUEST,
  FORM_TOKEN_INVALID: HttpStatus.BAD_REQUEST,
  FORM_TOKEN_EXPIRED: HttpStatus.BAD_REQUEST,
  FORM_TOKEN_TOO_FAST: HttpStatus.BAD_REQUEST,
  LISTING_NOT_AVAILABLE: HttpStatus.NOT_FOUND,
  BUSINESS_NOT_AVAILABLE: HttpStatus.NOT_FOUND,
  BUSINESS_NOT_FOUND: HttpStatus.NOT_FOUND,
  LEAD_NOT_FOUND: HttpStatus.NOT_FOUND,
  DUPLICATE_LEAD: HttpStatus.CONFLICT,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
};

@Catch(LeadError)
export class LeadExceptionFilter implements ExceptionFilter {
  catch(error: LeadError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = STATUS[error.code] ?? HttpStatus.BAD_REQUEST;

    response.status(statusCode).json({
      statusCode,
      error: error.code,
      message: error.message,
    });
  }
}
