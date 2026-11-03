import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { DomainException } from './domain.exception.js';
import { ErrorCode } from './error-codes.js';

describe('DomainException', () => {
  it('menyertakan field statusCode, error, message, dan code sesuai docs/04 untuk Conflict (409)', () => {
    const ex = new DomainException(
      HttpStatus.CONFLICT,
      'Logbook untuk tanggal 2026-11-02 sudah ada',
      ErrorCode.LOG_DATE_CONFLICT,
      { existingLogId: 'log-uuid-123' },
    );

    const response = ex.getResponse() as Record<string, unknown>;

    expect(ex.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(response).toEqual({
      statusCode: 409,
      error: 'Conflict',
      message: 'Logbook untuk tanggal 2026-11-02 sudah ada',
      code: 'LOG_DATE_CONFLICT',
      existingLogId: 'log-uuid-123',
    });
  });

  it('menyertakan field error: "Unauthorized" untuk status 401', () => {
    const ex = new DomainException(
      HttpStatus.UNAUTHORIZED,
      'Sesi telah kedaluwarsa',
      ErrorCode.SESSION_EXPIRED,
    );

    const response = ex.getResponse() as Record<string, unknown>;

    expect(ex.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(response).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Sesi telah kedaluwarsa',
      code: 'SESSION_EXPIRED',
    });
  });
});

