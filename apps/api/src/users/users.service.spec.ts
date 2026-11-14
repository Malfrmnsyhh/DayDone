import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleOAuthService } from '../auth/google/google-oauth.interface.js';
import type { EncryptionService } from '../common/crypto/encryption.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let mockPrisma: any;
  let mockEncryptionService: any;
  let mockGoogleOAuthService: {
    revokeToken: ReturnType<typeof vi.fn>;
    exchangeCode: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          googleRefreshToken: 'v1.encrypted.token',
        }),
        delete: vi.fn().mockResolvedValue({}),
      },
    };

    mockEncryptionService = {
      decrypt: vi.fn().mockReturnValue('decrypted-token'),
    };

    mockGoogleOAuthService = {
      revokeToken: vi.fn(),
      exchangeCode: vi.fn(),
    };

    service = new UsersService(
      mockPrisma as unknown as PrismaService,
      mockEncryptionService as unknown as EncryptionService,
      mockGoogleOAuthService as unknown as GoogleOAuthService,
    );
  });

  it('berhasil menghapus user dari DB dan mencabut token Google via GoogleOAuthService', async () => {
    mockGoogleOAuthService.revokeToken.mockResolvedValueOnce(undefined);

    await service.deleteMe('user-1');

    expect(mockEncryptionService.decrypt).toHaveBeenCalledWith(
      'v1.encrypted.token',
    );
    expect(mockGoogleOAuthService.revokeToken).toHaveBeenCalledWith(
      'decrypted-token',
    );
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });

  it('tetap menghapus user di DB meskipun revoke token Google gagal (best-effort)', async () => {
    mockGoogleOAuthService.revokeToken.mockRejectedValueOnce(
      new Error('Google network error'),
    );

    await service.deleteMe('user-1');

    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });

  it('menolak dengan 404 bila user tidak ditemukan', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(service.deleteMe('non-existent')).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });
});
