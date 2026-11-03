import { HttpException, type HttpStatus } from '@nestjs/common';
import type { ErrorCode } from './error-codes.js';

/**
 * Exception domain kustom untuk error bisnis yang membutuhkan kode error spesifik
 * dan payload tambahan (seperti existingLogId pada LOG_DATE_CONFLICT).
 */
export class DomainException extends HttpException {
  constructor(
    status: HttpStatus,
    message: string,
    public readonly code: ErrorCode,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(
      {
        statusCode: status,
        message,
        code,
        ...details,
      },
      status,
    );
  }
}

