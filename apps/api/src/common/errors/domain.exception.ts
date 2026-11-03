import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from './error-codes.js';

function getErrorNameByStatus(status: HttpStatus): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'Bad Request';
    case HttpStatus.UNAUTHORIZED:
      return 'Unauthorized';
    case HttpStatus.FORBIDDEN:
      return 'Forbidden';
    case HttpStatus.NOT_FOUND:
      return 'Not Found';
    case HttpStatus.CONFLICT:
      return 'Conflict';
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return 'Payload Too Large';
    case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
      return 'Unsupported Media Type';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'Too Many Requests';
    case HttpStatus.INTERNAL_SERVER_ERROR:
      return 'Internal Server Error';
    case HttpStatus.BAD_GATEWAY:
      return 'Bad Gateway';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'Service Unavailable';
    case HttpStatus.INSUFFICIENT_STORAGE:
      return 'Insufficient Storage';
    default:
      return 'Error';
  }
}

/**
 * Exception domain kustom untuk error bisnis yang membutuhkan kode error spesifik
 * dan payload tambahan (seperti existingLogId pada LOG_DATE_CONFLICT).
 * Mengikuti format error resmi NestJS dan docs/04-api-spec.md.
 */
export class DomainException extends HttpException {
  constructor(
    status: HttpStatus,
    message: string,
    public readonly code: ErrorCode,
    public readonly details: Record<string, unknown> = {},
  ) {
    const error = getErrorNameByStatus(status);
    super(
      {
        statusCode: status,
        error,
        message,
        code,
        ...details,
      },
      status,
    );
  }
}
