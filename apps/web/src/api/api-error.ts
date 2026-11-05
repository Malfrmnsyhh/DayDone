import type { ApiError as ApiErrorPayload, ErrorCode } from '@daydone/shared';
import { getErrorMessage } from '@daydone/shared';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly error: string;
  readonly code?: ErrorCode;
  readonly existingLogId?: string;
  readonly details?: string[];

  constructor(payload: Partial<ApiErrorPayload> & { statusCode: number }) {
    const code = payload.code;
    const msg = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message || payload.error || 'Terjadi kesalahan sistem';

    // Prioritaskan pesan ramah bahasa Indonesia dari ErrorCode bila tersedia
    const userMessage = code ? getErrorMessage(code, msg) : msg;

    super(userMessage);
    this.name = 'ApiError';
    this.statusCode = payload.statusCode;
    this.error = payload.error || 'Error';
    this.code = code;
    this.existingLogId = payload.existingLogId;
    if (Array.isArray(payload.message)) {
      this.details = payload.message;
    }
  }
}

