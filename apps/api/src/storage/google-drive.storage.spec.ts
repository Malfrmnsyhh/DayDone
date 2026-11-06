import { HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EncryptionService } from '../common/crypto/encryption.service.js';
import { DomainException } from '../common/errors/domain.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { DriveStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { GoogleDriveStorage } from './google-drive.storage.js';

// Mock @googleapis/drive
const mockDriveFilesCreate = vi.fn();
const mockDriveFilesGet = vi.fn();
const mockDriveFilesUpdate = vi.fn();

vi.mock('@googleapis/drive', () => ({
  drive: () => ({
    files: {
      create: mockDriveFilesCreate,
      get: mockDriveFilesGet,
      update: mockDriveFilesUpdate,
    },
  }),
}));

describe('GoogleDriveStorage', () => {
  let storage: GoogleDriveStorage;
  let mockPrisma: any;
  let mockConfigService: any;
  let mockEncryptionService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          driveStatus: DriveStatus.CONNECTED,
          googleRefreshToken: 'v1.encrypted-token',
          driveFolderId: null,
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'user-1',
          driveFolderId: 'folder-winner',
        }),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    mockConfigService = {
      getOrThrow: vi.fn((key: string) => {
        if (key === 'GOOGLE_WEB_CLIENT_ID') return 'client-id';
        if (key === 'GOOGLE_WEB_CLIENT_SECRET') return 'client-secret';
        throw new Error(`Unknown config ${key}`);
      }),
    };

    mockEncryptionService = {
      decrypt: vi.fn().mockReturnValue('decrypted-refresh-token'),
    };

    storage = new GoogleDriveStorage(
      mockPrisma as unknown as PrismaService,
      mockConfigService as unknown as ConfigService,
      mockEncryptionService as unknown as EncryptionService,
    );
  });

  describe('ensureAppFolder', () => {
    it('mengembalikan driveFolderId yang sudah ada jika tersimpan di DB dan tidak trashed', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        driveFolderId: 'folder-existing-123',
      });
      mockDriveFilesGet.mockResolvedValueOnce({
        data: { id: 'folder-existing-123', trashed: false },
      });

      const folderId = await storage.ensureAppFolder('user-1');

      expect(folderId).toBe('folder-existing-123');
      expect(mockDriveFilesGet).toHaveBeenCalledWith({
        fileId: 'folder-existing-123',
        fields: 'id,trashed',
      });
      expect(mockDriveFilesCreate).not.toHaveBeenCalled();
    });

    it('membuat folder baru bila folder yang tersimpan di DB berada di Trash (trashed: true)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        driveFolderId: 'folder-trashed-123',
      });
      mockDriveFilesGet.mockResolvedValueOnce({
        data: { id: 'folder-trashed-123', trashed: true },
      });
      mockDriveFilesCreate.mockResolvedValueOnce({
        data: { id: 'new-folder-after-trash' },
      });

      const folderId = await storage.ensureAppFolder('user-1');

      expect(folderId).toBe('new-folder-after-trash');
      expect(mockDriveFilesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: {
            name: 'DayDone',
            mimeType: 'application/vnd.google-apps.folder',
          },
        }),
      );
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', driveFolderId: 'folder-trashed-123' },
        data: { driveFolderId: 'new-folder-after-trash' },
      });
    });

    it('membuat folder baru bila folder yang tersimpan di DB mengembalikan status 404 saat dicek', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        driveFolderId: 'folder-deleted-404',
      });
      mockDriveFilesGet.mockRejectedValueOnce({ status: 404 });
      mockDriveFilesCreate.mockResolvedValueOnce({
        data: { id: 'new-folder-after-404' },
      });

      const folderId = await storage.ensureAppFolder('user-1');

      expect(folderId).toBe('new-folder-after-404');
      expect(mockDriveFilesCreate).toHaveBeenCalled();
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', driveFolderId: 'folder-deleted-404' },
        data: { driveFolderId: 'new-folder-after-404' },
      });
    });

    it('membuat folder DayDone baru dan menyimpannya jika belum ada', async () => {
      mockDriveFilesCreate.mockResolvedValueOnce({
        data: { id: 'new-folder-456' },
      });

      const folderId = await storage.ensureAppFolder('user-1');

      expect(folderId).toBe('new-folder-456');
      expect(mockDriveFilesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: {
            name: 'DayDone',
            mimeType: 'application/vnd.google-apps.folder',
          },
        }),
      );
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', driveFolderId: null },
        data: { driveFolderId: 'new-folder-456' },
      });
    });

    it('aman terhadap request paralel: jika updateMany menghasilkan count 0, trash folder ekstra dan pakai folder pemenang', async () => {
      mockDriveFilesCreate.mockResolvedValueOnce({
        data: { id: 'extra-folder-789' },
      });
      // Simulasi request paralel lain sudah mengupdate DB
      mockPrisma.user.updateMany.mockResolvedValueOnce({ count: 0 });
      mockDriveFilesUpdate.mockResolvedValueOnce({});

      const folderId = await storage.ensureAppFolder('user-1');

      expect(folderId).toBe('folder-winner');
      // Memastikan folder ekstra di-trash
      expect(mockDriveFilesUpdate).toHaveBeenCalledWith({
        fileId: 'extra-folder-789',
        requestBody: { trashed: true },
      });
    });
  });

  describe('handleDriveError', () => {
    it('gagal mendekripsi googleRefreshToken menandai NEEDS_RECONNECT, menghapus token rusak, dan melempar DRIVE_RECONNECT_REQUIRED (409)', async () => {
      mockEncryptionService.decrypt.mockImplementationOnce(() => {
        throw new Error('Unsupported state or unable to authenticate data');
      });

      try {
        await storage.upload('user-1', {
          name: 'test.jpg',
          mimeType: 'image/jpeg',
          body: Buffer.from('data'),
        });
        expect.unreachable();
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(DomainException);
        const domainErr = err as DomainException;
        expect(domainErr.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(domainErr.code).toBe(ErrorCode.DRIVE_RECONNECT_REQUIRED);
      }

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          driveStatus: DriveStatus.NEEDS_RECONNECT,
          googleRefreshToken: null,
        },
      });
    });

    it('invalid_grant memetakan ke DRIVE_RECONNECT_REQUIRED dan mengupdate status user di DB', async () => {
      mockDriveFilesCreate.mockRejectedValueOnce(
        new Error('invalid_grant: Bad Request'),
      );

      await expect(
        storage.upload('user-1', {
          name: 'test.jpg',
          mimeType: 'image/jpeg',
          body: Buffer.from('data'),
        }),
      ).rejects.toThrow(DomainException);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          driveStatus: DriveStatus.NEEDS_RECONNECT,
          googleRefreshToken: null,
        },
      });
    });

    it('storageQuotaExceeded memetakan ke DRIVE_STORAGE_FULL (507)', async () => {
      const quotaError = {
        status: 403,
        response: {
          status: 403,
          data: {
            error: {
              errors: [{ reason: 'storageQuotaExceeded' }],
            },
          },
        },
      };
      mockDriveFilesCreate.mockRejectedValueOnce(quotaError);

      try {
        await storage.upload('user-1', {
          name: 'test.jpg',
          mimeType: 'image/jpeg',
          body: Buffer.from('data'),
        });
        expect.unreachable();
      } catch (err: any) {
        expect(err).toBeInstanceOf(DomainException);
        expect(err.getStatus()).toBe(HttpStatus.INSUFFICIENT_STORAGE);
        expect(err.code).toBe(ErrorCode.DRIVE_STORAGE_FULL);
      }
    });

    it('error 500 Google setelah retry memetakan ke DRIVE_UNAVAILABLE (502)', async () => {
      const serverError = {
        status: 500,
        response: { status: 500, data: {} },
        message: 'Google Internal Server Error',
      };
      mockDriveFilesCreate.mockRejectedValue(serverError);

      try {
        await storage.upload('user-1', {
          name: 'test.jpg',
          mimeType: 'image/jpeg',
          body: Buffer.from('data'),
        });
        expect.unreachable();
      } catch (err: any) {
        expect(err).toBeInstanceOf(DomainException);
        expect(err.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
        expect(err.code).toBe(ErrorCode.DRIVE_UNAVAILABLE);
      }
    });
  });
});
