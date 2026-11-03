import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import multer from 'multer';
import { ErrorCode } from '../errors/error-codes.js';

/**
 * Filter untuk menangani MulterError secara eksplisit:
 * - LIMIT_FILE_SIZE -> 413 Payload Too Large (FILE_TOO_LARGE)
 * - LIMIT_FILE_COUNT & LIMIT_UNEXPECTED_FILE -> 409 Conflict (ATTACHMENT_LIMIT_REACHED)
 */
@Catch(multer.MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: multer.MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception.code === 'LIMIT_FILE_SIZE') {
      return response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        error: 'Payload Too Large',
        message: 'Ukuran file melebihi batas maksimum 10 MB per file',
        code: ErrorCode.FILE_TOO_LARGE,
      });
    }

    if (
      exception.code === 'LIMIT_FILE_COUNT' ||
      exception.code === 'LIMIT_UNEXPECTED_FILE'
    ) {
      return response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message:
          'Jumlah file lampiran melebihi batas maksimum (maksimal 5 file per logbook)',
        code: ErrorCode.ATTACHMENT_LIMIT_REACHED,
      });
    }

    return response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      message: exception.message,
    });
  }
}

