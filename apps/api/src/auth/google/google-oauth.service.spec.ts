import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { DomainException } from '../../common/errors/domain.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { FakeGoogleOAuthService } from './fake-google-oauth.service.js';

describe('Google OAuth Service', () => {
  describe('FakeGoogleOAuthService', () => {
    const fakeService = new FakeGoogleOAuthService();

    it('berhasil menukar code valid dev-a dengan profil lengkap dan driveGranted true', async () => {
      const result = await fakeService.exchangeCode('code-dev-a');
      expect(result.googleId).toBe('google-dev-a');
      expect(result.email).toBe('dev-a@daydone.local');
      expect(result.driveGranted).toBe(true);
      expect(result.refreshToken).toBe('fake-refresh-token-a');
    });

    it('menangani skenario login ulang tanpa refresh token', async () => {
      const result = await fakeService.exchangeCode('code-dev-a-no-refresh');
      expect(result.googleId).toBe('google-dev-a');
      expect(result.refreshToken).toBeUndefined();
    });

    it('menangani skenario user tidak memberi izin scope drive.file', async () => {
      const result = await fakeService.exchangeCode('code-dev-a-no-drive');
      expect(result.driveGranted).toBe(false);
    });

    it('melempar GOOGLE_AUTH_FAILED bila email unverified', async () => {
      try {
        await fakeService.exchangeCode('code-unverified-email');
        expect.unreachable('Harus melempar exception');
      } catch (err) {
        expect(err).toBeInstanceOf(DomainException);
        const domainErr = err as DomainException;
        expect(domainErr.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect(domainErr.code).toBe(ErrorCode.GOOGLE_AUTH_FAILED);
      }
    });

    it('melempar GOOGLE_AUTH_FAILED bila kode tidak terdaftar / invalid', async () => {
      await expect(
        fakeService.exchangeCode('random-invalid-code'),
      ).rejects.toThrow(DomainException);
    });
  });
});
