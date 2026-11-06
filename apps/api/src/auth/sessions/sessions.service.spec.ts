import { HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainException } from '../../common/errors/domain.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { SessionsService } from './sessions.service.js';

describe('SessionsService', () => {
  let service: SessionsService;
  let mockPrisma: any;
  let mockConfig: ConfigService;

  const userId = 'user-uuid-1';
  const dummyUser = {
    id: userId,
    email: 'user@daydone.local',
    name: 'User One',
    avatarUrl: null,
  };

  const dummySession = {
    id: 'session-uuid-1',
    userId,
    platform: 'WEB' as const,
    userAgent: 'vitest-agent',
    refreshTokenHash: 'hash-of-token-1',
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    revokedAt: null,
    replacedById: null,
    user: dummyUser,
  };

  beforeEach(() => {
    mockConfig = {
      get: vi.fn().mockReturnValue(30),
    } as unknown as ConfigService;

    mockPrisma = {
      session: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(mockPrisma)),
    };

    service = new SessionsService(
      mockPrisma as unknown as PrismaService,
      mockConfig,
    );
  });

  describe('createSession', () => {
    it('membuat sesi baru dengan hash SHA-256 dan token base64url', async () => {
      mockPrisma.session.create.mockResolvedValue(dummySession);

      const result = await service.createSession(userId, 'WEB', 'agent');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken.length).toBeGreaterThanOrEqual(40); // 32 bytes base64url ~ 43 chars
      expect(mockPrisma.session.create).toHaveBeenCalled();
    });
  });

  describe('rotateSession', () => {
    it('berhasil merotasi sesi aktif dan menautkan replacedById', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(dummySession);
      mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });
      const newSession = { ...dummySession, id: 'session-uuid-2' };
      mockPrisma.session.create.mockResolvedValue(newSession);

      const result = await service.rotateSession('raw-token-1');

      expect(result.session.id).toBe('session-uuid-2');
      expect(result.refreshToken).toBeDefined();
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: dummySession.id },
        data: { replacedById: 'session-uuid-2' },
      });
    });

    it('mendeteksi pemakaian ulang (reuse) saat updateMany count === 0 dan mencabut SEMUA sesi user', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(dummySession);
      // count === 0 mensimulasikan token sudah dicabut sebelumnya
      mockPrisma.session.updateMany.mockResolvedValueOnce({ count: 0 });

      try {
        await service.rotateSession('reused-token');
        expect.unreachable('Harus melempar exception');
      } catch (err) {
        expect(err).toBeInstanceOf(DomainException);
        const domainErr = err as DomainException;
        expect(domainErr.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect(domainErr.code).toBe(ErrorCode.SESSION_EXPIRED);
        // Pastikan updateMany kedua dipanggil untuk mencabut semua sesi user
        expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
          where: {
            userId: dummySession.userId,
            revokedAt: null,
          },
          data: {
            revokedAt: expect.any(Date),
          },
        });
      }
    });

    it('menolak bila token tidak ditemukan di database', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(service.rotateSession('unknown-token')).rejects.toThrow(
        DomainException,
      );
    });

    it('menolak bila sesi sudah kedaluwarsa', async () => {
      const expiredSession = {
        ...dummySession,
        expiresAt: new Date(Date.now() - 1000),
      };
      mockPrisma.session.findUnique.mockResolvedValue(expiredSession);

      await expect(service.rotateSession('expired-token')).rejects.toThrow(
        DomainException,
      );
    });

    it('dua refresh paralel dengan token yang sama: paling banyak satu yang berhasil', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(dummySession);

      // Panggilan pertama berhasil (count: 1), panggilan kedua gagal (count: 0)
      mockPrisma.session.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      mockPrisma.session.create.mockResolvedValue({
        ...dummySession,
        id: 'session-uuid-new',
      });

      const call1 = service.rotateSession('token-paralel');
      const call2 = service.rotateSession('token-paralel');

      const results = await Promise.allSettled([call1, call2]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
    });
  });

  describe('validateSession', () => {
    it('mengembalikan sesi jika valid dan user aktif', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(dummySession);

      const result = await service.validateSession('session-uuid-1');
      expect(result).not.toBeNull();
      expect(result?.id).toBe(dummySession.id);
    });

    it('mengembalikan null jika sesi sudah dicabut (revokedAt tidak null)', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...dummySession,
        revokedAt: new Date(),
      });

      const result = await service.validateSession('session-uuid-1');
      expect(result).toBeNull();
    });

    it('mengembalikan null jika user pemilik sesi sudah tidak ada di database', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        ...dummySession,
        user: null,
      });

      const result = await service.validateSession('session-uuid-1');
      expect(result).toBeNull();
    });
  });
});
