import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignedUrlService } from './signed-url.service.js';

describe('SignedUrlService', () => {
  let service: SignedUrlService;
  let mockConfigService: any;

  beforeEach(() => {
    mockConfigService = {
      getOrThrow: vi.fn((key: string) => {
        if (key === 'ATTACHMENT_URL_SECRET') {
          return 'this-is-a-very-long-secret-key-at-least-32-chars!';
        }
        if (key === 'PUBLIC_API_URL') {
          return 'http://localhost:3000';
        }
        throw new Error(`Unknown config ${key}`);
      }),
    };

    service = new SignedUrlService(mockConfigService as unknown as ConfigService);
  });

  it('menghasilkan URL bertanda tangan dengan format yang benar', () => {
    const result = service.generateUrl('att-uuid-1', 'user-uuid-1');

    expect(result.url).toContain('http://localhost:3000/api/v1/attachments/att-uuid-1/content?token=');
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Ambil token dari URL
    const token = new URL(result.url).searchParams.get('token')!;
    expect(token).toBeDefined();

    // Verifikasi token yang baru dibuat
    const verified = service.verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.attachmentId).toBe('att-uuid-1');
    expect(verified?.userId).toBe('user-uuid-1');
  });

  it('menolak token yang dimodifikasi (tampered signature)', () => {
    const result = service.generateUrl('att-uuid-1', 'user-uuid-1');
    const token = new URL(result.url).searchParams.get('token')!;
    const [payloadPart, sigPart] = token.split('.');

    // Ubah karakter pertama signature (menghindari bit padding di karakter terakhir base64url)
    const tamperedSig =
      (sigPart.startsWith('a') ? 'b' : 'a') + sigPart.slice(1);
    const tamperedToken = `${payloadPart}.${tamperedSig}`;

    const verified = service.verifyToken(tamperedToken);
    expect(verified).toBeNull();
  });

  it('menolak token yang telah kedaluwarsa', () => {
    // Buat token dengan TTL negatif (-10 detik)
    const result = service.generateUrl('att-uuid-1', 'user-uuid-1', -10);
    const token = new URL(result.url).searchParams.get('token')!;

    const verified = service.verifyToken(token);
    expect(verified).toBeNull();
  });

  it('menolak token dengan format sembarangan', () => {
    expect(service.verifyToken('')).toBeNull();
    expect(service.verifyToken('invalid-token-without-dot')).toBeNull();
    expect(service.verifyToken('part1.part2.part3')).toBeNull();
  });
});

