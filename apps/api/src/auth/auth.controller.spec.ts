import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DriveStatus } from '../generated/prisma/client.js';
import { AuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: any;
  let mockConfigService: any;

  interface MockRes {
    cookie: ReturnType<typeof vi.fn>;
    clearCookie: ReturnType<typeof vi.fn>;
  }

  const createMockResponse = (): MockRes => ({
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  });

  const mockUser = {
    id: 'user-uuid-1',
    email: 'user@daydone.local',
    name: 'User One',
    avatarUrl: null,
    driveStatus: DriveStatus.CONNECTED,
  };

  beforeEach(() => {
    mockAuthService = {
      googleLogin: vi.fn().mockResolvedValue({
        accessToken: 'jwt-access-token',
        accessTokenExpiresAt: '2026-11-03T15:00:00.000Z',
        rawSessionRefreshToken: 'session-rt-123',
        user: mockUser,
      }),
      refresh: vi.fn().mockResolvedValue({
        accessToken: 'new-jwt-access-token',
        accessTokenExpiresAt: '2026-11-03T15:15:00.000Z',
        rawSessionRefreshToken: 'new-session-rt-456',
      }),
      logout: vi.fn().mockResolvedValue(undefined),
      getMe: vi.fn().mockResolvedValue(mockUser),
    };

    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: any) => {
        if (key === 'COOKIE_SAMESITE') return 'lax';
        if (key === 'COOKIE_SECURE') return true;
        if (key === 'REFRESH_TOKEN_TTL_DAYS') return 30;
        return defaultValue;
      }),
    };

    controller = new AuthController(
      mockAuthService as unknown as AuthService,
      mockConfigService as unknown as ConfigService,
    );
  });

  describe('googleLogin', () => {
    it('untuk platform WEB: pasang cookie daydone_rt dan tidak menyertakan refreshToken di body', async () => {
      const res = createMockResponse();
      const result = await controller.googleLogin(
        { code: 'google-code-123', platform: 'WEB' },
        'test-browser',
        res as unknown as Response,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'daydone_rt',
        'session-rt-123',
        expect.objectContaining({
          httpOnly: true,
          path: '/api/v1/auth',
          sameSite: 'lax',
          secure: true,
        }),
      );
      expect(result.accessToken).toBe('jwt-access-token');
      expect(result.user).toEqual(mockUser);
      expect(result.refreshToken).toBeUndefined();
    });

    it('untuk platform MOBILE: menyertakan refreshToken di body dan tidak memasang cookie', async () => {
      const res = createMockResponse();
      const result = await controller.googleLogin(
        { code: 'google-code-123', platform: 'MOBILE' },
        'test-mobile-app',
        res as unknown as Response,
      );

      expect(res.cookie).not.toHaveBeenCalled();
      expect(result.refreshToken).toBe('session-rt-123');
      expect(result.accessToken).toBe('jwt-access-token');
    });
  });

  describe('refresh', () => {
    it('request WEB berhasil bila ada cookie dan header X-Requested-With: daydone-web', async () => {
      const res = createMockResponse();
      const req = {
        cookies: { daydone_rt: 'cookie-token-123' },
      } as any;

      const result = await controller.refresh(
        {},
        'browser',
        'daydone-web',
        req,
        res as unknown as Response,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        'daydone_rt',
        'new-session-rt-456',
        expect.anything(),
      );
      expect(result.accessToken).toBe('new-jwt-access-token');
      expect(result.refreshToken).toBeUndefined();
    });

    it('request WEB menolak dengan 403 bila header X-Requested-With hilang', async () => {
      const res = createMockResponse();
      const req = {
        cookies: { daydone_rt: 'cookie-token-123' },
      } as any;

      await expect(
        controller.refresh({}, 'browser', undefined, req, res as unknown as Response),
      ).rejects.toThrow(ForbiddenException);
    });

    it('request MOBILE membaca refreshToken dari body', async () => {
      const res = createMockResponse();
      const req = { cookies: {} } as any;

      const result = await controller.refresh(
        { refreshToken: 'mobile-rt-123' },
        'mobile',
        undefined,
        req,
        res as unknown as Response,
      );

      expect(result.refreshToken).toBe('new-session-rt-456');
    });
  });

  describe('logout', () => {
    it('request WEB menghapus cookie dengan atribut yang sama dan memanggil logout', async () => {
      const res = createMockResponse();
      const req = {
        cookies: { daydone_rt: 'cookie-to-delete' },
      } as any;

      await controller.logout({}, 'daydone-web', req, res as unknown as Response);

      expect(res.clearCookie).toHaveBeenCalledWith(
        'daydone_rt',
        expect.objectContaining({
          path: '/api/v1/auth',
          sameSite: 'lax',
          secure: true,
        }),
      );
      expect(mockAuthService.logout).toHaveBeenCalledWith('cookie-to-delete');
    });

    it('request WEB menolak logout bila header X-Requested-With hilang', async () => {
      const res = createMockResponse();
      const req = {
        cookies: { daydone_rt: 'cookie-to-delete' },
      } as any;

      await expect(
        controller.logout({}, undefined, req, res as unknown as Response),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMe', () => {
    it('mengambil profil dari service berdasarkan userId CurrentUser', async () => {
      const result = await controller.getMe({
        userId: 'user-uuid-1',
        sessionId: 'session-1',
      });
      expect(result.id).toBe('user-uuid-1');
      expect(mockAuthService.getMe).toHaveBeenCalledWith('user-uuid-1');
    });
  });
});
