import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EncryptionService } from '../common/crypto/encryption.service.js';
import { DriveStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import type { GoogleOAuthService } from './google/google-oauth.interface.js';
import type { SessionsService } from './sessions/sessions.service.js';

describe('AuthService', () => {
  let service: AuthService;
  let mockPrisma: any;
  let mockConfig: ConfigService;
  let mockJwt: JwtService;
  let mockEncryption: {
    encrypt: ReturnType<typeof vi.fn>;
    decrypt: ReturnType<typeof vi.fn>;
  };
  let mockSessions: {
    createSession: ReturnType<typeof vi.fn>;
    rotateSession: ReturnType<typeof vi.fn>;
    revokeSession: ReturnType<typeof vi.fn>;
  };
  let mockGoogleOAuth: {
    exchangeCode: ReturnType<typeof vi.fn>;
  };

  const dummyUser = {
    id: 'user-uuid-1',
    googleId: 'google-sub-1',
    email: 'user@daydone.local',
    name: 'User One',
    avatarUrl: 'https://example.com/avatar.jpg',
    googleRefreshToken: 'v1.iv.tag.cipher',
    driveStatus: DriveStatus.CONNECTED,
    driveFolderId: null,
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    };

    mockConfig = {
      get: vi.fn().mockReturnValue('15m'),
    } as unknown as ConfigService;

    mockJwt = {
      sign: vi.fn().mockReturnValue('dummy.jwt.token'),
    } as unknown as JwtService;

    mockEncryption = {
      encrypt: vi.fn().mockReturnValue('v1.encrypted.token'),
      decrypt: vi.fn().mockReturnValue('raw.token'),
    };

    mockSessions = {
      createSession: vi.fn().mockResolvedValue({
        session: { id: 'session-1' },
        refreshToken: 'raw-session-refresh-token',
      }),
      rotateSession: vi.fn().mockResolvedValue({
        session: { id: 'session-2', userId: 'user-uuid-1' },
        refreshToken: 'new-session-refresh-token',
        user: dummyUser,
      }),
      revokeSession: vi.fn().mockResolvedValue(undefined),
    };

    mockGoogleOAuth = {
      exchangeCode: vi.fn().mockResolvedValue({
        googleId: 'google-sub-1',
        email: 'user@daydone.local',
        name: 'User One',
        avatarUrl: 'https://example.com/avatar.jpg',
        refreshToken: 'google-rt-1',
        driveGranted: true,
      }),
    };

    service = new AuthService(
      mockPrisma as unknown as PrismaService,
      mockConfig,
      mockJwt,
      mockEncryption as unknown as EncryptionService,
      mockSessions as unknown as SessionsService,
      mockGoogleOAuth as unknown as GoogleOAuthService,
    );
  });

  describe('googleLogin', () => {
    it('berhasil login user baru, mengenkripsi token Google, dan membuat sesi', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.upsert.mockResolvedValue(dummyUser);

      const result = await service.googleLogin({
        code: 'valid-code',
        platform: 'WEB',
      });

      expect(result.accessToken).toBe('dummy.jwt.token');
      expect(result.rawSessionRefreshToken).toBe('raw-session-refresh-token');
      expect(result.user.email).toBe(dummyUser.email);
      expect(mockEncryption.encrypt).toHaveBeenCalledWith('google-rt-1');
      expect(mockSessions.createSession).toHaveBeenCalledWith(
        dummyUser.id,
        'WEB',
        undefined,
      );
    });

    it('tidak menimpa googleRefreshToken yang sudah ada bila Google tidak mengirim refresh token baru', async () => {
      mockGoogleOAuth.exchangeCode = vi.fn().mockResolvedValue({
        googleId: 'google-sub-1',
        email: 'user@daydone.local',
        name: 'User One',
        avatarUrl: null,
        refreshToken: undefined, // tidak ada refresh token baru
        driveGranted: true,
      });

      mockPrisma.user.findUnique.mockResolvedValue(dummyUser);
      mockPrisma.user.upsert.mockResolvedValue(dummyUser);

      await service.googleLogin({
        code: 'valid-code-relogin',
        platform: 'WEB',
      });

      expect(mockEncryption.encrypt).not.toHaveBeenCalled();
      expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            googleRefreshToken: dummyUser.googleRefreshToken,
          }),
        }),
      );
    });

    it('menetapkan driveStatus NEEDS_RECONNECT jika scope Drive diberikan tapi belum ada refresh token', async () => {
      mockGoogleOAuth.exchangeCode = vi.fn().mockResolvedValue({
        googleId: 'google-sub-new',
        email: 'new@daydone.local',
        name: 'New User',
        avatarUrl: null,
        refreshToken: undefined, // tidak ada refresh token
        driveGranted: true,
      });

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.upsert.mockResolvedValue({
        ...dummyUser,
        driveStatus: DriveStatus.NEEDS_RECONNECT,
      });

      const res = await service.googleLogin({
        code: 'code-no-rt',
        platform: 'WEB',
      });

      expect(res.user.driveStatus).toBe(DriveStatus.NEEDS_RECONNECT);
    });

    it('menetapkan driveStatus NOT_CONNECTED jika user tidak memberi izin scope drive.file', async () => {
      mockGoogleOAuth.exchangeCode = vi.fn().mockResolvedValue({
        googleId: 'google-sub-1',
        email: 'user@daydone.local',
        name: 'User One',
        avatarUrl: null,
        refreshToken: 'rt-1',
        driveGranted: false, // scope ditolak
      });

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.upsert.mockResolvedValue({
        ...dummyUser,
        driveStatus: DriveStatus.NOT_CONNECTED,
      });

      const res = await service.googleLogin({
        code: 'code-no-drive',
        platform: 'WEB',
      });

      expect(res.user.driveStatus).toBe(DriveStatus.NOT_CONNECTED);
    });
  });

  describe('refresh', () => {
    it('merotasi sesi dan mengembalikan access token baru', async () => {
      const res = await service.refresh('old-token');
      expect(res.accessToken).toBe('dummy.jwt.token');
      expect(res.rawSessionRefreshToken).toBe('new-session-refresh-token');
      expect(mockSessions.rotateSession).toHaveBeenCalledWith(
        'old-token',
        undefined,
      );
    });
  });

  describe('logout', () => {
    it('mencabut sesi jika token diberikan', async () => {
      await service.logout('session-token');
      expect(mockSessions.revokeSession).toHaveBeenCalledWith('session-token');
    });
  });

  describe('getMe', () => {
    it('mengembalikan profil user jika ditemukan', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(dummyUser);

      const res = await service.getMe('user-uuid-1');
      expect(res.id).toBe(dummyUser.id);
      expect(res.email).toBe(dummyUser.email);
    });

    it('melempar NotFoundException jika user tidak ditemukan', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
