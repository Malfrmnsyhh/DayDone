import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EncryptionService } from '../common/crypto/encryption.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

const mockRevokeToken = vi.fn();

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    revokeToken = mockRevokeToken;
  },
}));

describe('UsersService', () => {
  let service: UsersService;
  let mockPrisma: any;
  let mockConfigService: any;
  let mockEncryptionService: any;

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

    mockConfigService = {
      getOrThrow: vi.fn((key: string) => {
        if (key === 'GOOGLE_WEB_CLIENT_ID') return 'client-id';
        if (key === 'GOOGLE_WEB_CLIENT_SECRET') return 'client-secret';
        throw new Error(`Unknown ${key}`);
      }),
    };

    mockEncryptionService = {
      decrypt: vi.fn().mockReturnValue('decrypted-token'),
    };

    service = new UsersService(
      mockPrisma as unknown as PrismaService,
      mockConfigService as unknown as ConfigService,
      mockEncryptionService as unknown as EncryptionService,
    );
  });

  it('berhasil menghapus user dari DB dan mencabut token Google', async () => {
    mockRevokeToken.mockResolvedValueOnce({});

    await service.deleteMe('user-1');

    expect(mockEncryptionService.decrypt).toHaveBeenCalledWith(
      'v1.encrypted.token',
    );
    expect(mockRevokeToken).toHaveBeenCalledWith('decrypted-token');
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });

  it('tetap menghapus user di DB meskipun revoke token Google gagal (best-effort)', async () => {
    mockRevokeToken.mockRejectedValueOnce(new Error('Google network error'));

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
