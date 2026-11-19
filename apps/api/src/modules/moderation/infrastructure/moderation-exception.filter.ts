import { Catch, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

import { ModerationError, type ModerationErrorCode } from '../domain/moderation-error.js';

const STATUS: Record<ModerationErrorCode, HttpStatus> = {
  INVALID_INPUT: HttpStatus.BAD_REQUEST,
  INVALID_REASON: HttpStatus.BAD_REQUEST,
  INVALID_DETAILS: HttpStatus.BAD_REQUEST,
  INVALID_EMAIL: HttpStatus.BAD_REQUEST,
  INVALID_STATUS: HttpStatus.BAD_REQUEST,
  INVALID_TRANSITION: HttpStatus.CONFLICT,
  INVALID_REASON_TEXT: HttpStatus.BAD_REQUEST,
  LISTING_NOT_AVAILABLE: HttpStatus.NOT_FOUND,
  BUSINESS_NOT_AVAILABLE: HttpStatus.NOT_FOUND,
  BUSINESS_NOT_FOUND: HttpStatus.NOT_FOUND,
  LISTING_NOT_FOUND: HttpStatus.NOT_FOUND,
  REPORT_NOT_FOUND: HttpStatus.NOT_FOUND,
  DUPLICATE_REPORT: HttpStatus.CONFLICT,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
};

@Catch(ModerationError)
export class ModerationExceptionFilter implements ExceptionFilter {
  catch(error: ModerationError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = STATUS[error.code] ?? HttpStatus.BAD_REQUEST;

    response.status(statusCode).json({
      statusCode,
      error: error.code,
      message: error.message,
    });
  }
}
