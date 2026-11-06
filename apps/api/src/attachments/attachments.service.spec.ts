import {
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainException } from '../common/errors/domain.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { DriveStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AttachmentsService } from './attachments.service.js';
import type { ImageProcessorService } from './image-processor.service.js';
import type { SignedUrlService } from './signed-url.service.js';
import type { StorageProvider } from '../storage/storage.interface.js';

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let mockPrisma: any;
  let mockImageProcessor: any;
  let mockSignedUrlService: any;
  let mockStorageProvider: any;

  const userId = 'user-uuid-1';
  const logId = 'log-uuid-1';

  const dummyUser = {
    id: userId,
    driveStatus: DriveStatus.CONNECTED,
    googleRefreshToken: 'v1.encrypted.token',
  };

  const dummyLog = {
    id: logId,
    userId,
    date: new Date('2026-11-03T00:00:00.000Z'),
    description: 'Log hari ini',
    attachments: [],
    user: dummyUser,
  };

  const dummyFile = {
    buffer: Buffer.from('image-data'),
    originalname: 'test.jpg',
    mimetype: 'image/jpeg',
    size: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: logId }]),
      logEntry: {
        findFirst: vi.fn().mockResolvedValue(dummyLog),
      },
      attachment: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn((args: any) => ({
          ...args.data,
          createdAt: new Date('2026-11-03T10:00:00.000Z'),
        })),
        delete: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn(async (arg: any) => {
        if (typeof arg === 'function') {
          return arg(mockPrisma);
        }
        return Promise.all(arg);
      }),
    };

    mockImageProcessor = {
      process: vi.fn().mockResolvedValue({
        buffer: Buffer.from('processed-image-data'),
        mimeType: 'image/jpeg',
        width: 1024,
        height: 768,
        sizeBytes: 500,
      }),
    };

    mockSignedUrlService = {
      generateUrl: vi.fn((attId: string) => ({
        url: `http://localhost:3000/api/v1/attachments/${attId}/content?token=valid-token`,
        expiresAt: new Date(Date.now() + 300000),
      })),
      verifyToken: vi.fn(),
    };

    mockStorageProvider = {
      ensureAppFolder: vi.fn().mockResolvedValue('folder-123'),
      upload: vi.fn().mockResolvedValue({
        fileId: 'drive-file-123',
        sizeBytes: 500,
      }),
      download: vi.fn().mockResolvedValue({ pipe: vi.fn() }),
      trash: vi.fn().mockResolvedValue(undefined),
    };

    service = new AttachmentsService(
      mockPrisma as unknown as PrismaService,
      mockImageProcessor as unknown as ImageProcessorService,
      mockSignedUrlService as unknown as SignedUrlService,
      mockStorageProvider as unknown as StorageProvider,
    );
  });

  describe('uploadAttachments', () => {
    it('berhasil mengunggah file dan mengembalikan metadata lampiran dengan signed url', async () => {
      const results = await service.uploadAttachments(userId, logId, [
        dummyFile,
      ]);

      expect(results).toHaveLength(1);
      expect(results[0]?.fileName).toContain('2026-11-03_');
      expect(results[0]?.url).toContain('valid-token');
      expect(mockImageProcessor.process).toHaveBeenCalled();
      expect(mockStorageProvider.upload).toHaveBeenCalled();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('menolak dengan 404 bila logbook tidak ditemukan atau bukan milik pengguna', async () => {
      mockPrisma.logEntry.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.uploadAttachments(userId, logId, [dummyFile]),
      ).rejects.toThrow(NotFoundException);
    });

    it('menolak dengan 409 DRIVE_NOT_CONNECTED bila status drive user NOT_CONNECTED', async () => {
      mockPrisma.logEntry.findFirst.mockResolvedValueOnce({
        ...dummyLog,
        user: { ...dummyUser, driveStatus: DriveStatus.NOT_CONNECTED },
      });

      try {
        await service.uploadAttachments(userId, logId, [dummyFile]);
        expect.unreachable();
      } catch (err: any) {
        expect(err).toBeInstanceOf(DomainException);
        expect(err.code).toBe(ErrorCode.DRIVE_NOT_CONNECTED);
      }
    });

    it('menolak dengan 409 DRIVE_RECONNECT_REQUIRED bila status drive user NEEDS_RECONNECT', async () => {
      mockPrisma.logEntry.findFirst.mockResolvedValueOnce({
        ...dummyLog,
        user: { ...dummyUser, driveStatus: DriveStatus.NEEDS_RECONNECT },
      });

      try {
        await service.uploadAttachments(userId, logId, [dummyFile]);
        expect.unreachable();
      } catch (err: any) {
        expect(err).toBeInstanceOf(DomainException);
        expect(err.code).toBe(ErrorCode.DRIVE_RECONNECT_REQUIRED);
      }
    });

    it('menolak dengan 409 ATTACHMENT_LIMIT_REACHED bila total lampiran melebihi 5', async () => {
      mockPrisma.logEntry.findFirst.mockResolvedValueOnce({
        ...dummyLog,
        attachments: [
          { id: '1', position: 0 },
          { id: '2', position: 1 },
          { id: '3', position: 2 },
          { id: '4', position: 3 },
          { id: '5', position: 4 },
        ],
      });

      try {
        await service.uploadAttachments(userId, logId, [dummyFile]);
        expect.unreachable();
      } catch (err: any) {
        expect(err).toBeInstanceOf(DomainException);
        expect(err.code).toBe(ErrorCode.ATTACHMENT_LIMIT_REACHED);
      }
    });

    it('jika ImageProcessor gagal, Drive TIDAK disentuh', async () => {
      mockImageProcessor.process.mockRejectedValueOnce(
        new DomainException(
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          'File rusak',
          ErrorCode.UNSUPPORTED_FILE_TYPE,
        ),
      );

      await expect(
        service.uploadAttachments(userId, logId, [dummyFile]),
      ).rejects.toThrow(DomainException);

      expect(mockStorageProvider.upload).not.toHaveBeenCalled();
    });

    it('kompensasi: jika upload file ke-2 gagal di Drive, file ke-1 langsung di-trash', async () => {
      mockStorageProvider.upload
        .mockResolvedValueOnce({ fileId: 'drive-file-1', sizeBytes: 100 })
        .mockRejectedValueOnce(new Error('Network drop on Drive'));

      await expect(
        service.uploadAttachments(userId, logId, [dummyFile, dummyFile]),
      ).rejects.toThrow('Network drop on Drive');

      expect(mockStorageProvider.trash).toHaveBeenCalledWith(
        userId,
        'drive-file-1',
      );
    });

    it('kompensasi: jika insert DB gagal, seluruh file yang sudah diunggah di-trash', async () => {
      mockStorageProvider.upload.mockResolvedValueOnce({
        fileId: 'drive-file-1',
        sizeBytes: 100,
      });
      mockPrisma.$transaction.mockRejectedValueOnce(
        new Error('DB transaction error'),
      );

      await expect(
        service.uploadAttachments(userId, logId, [dummyFile]),
      ).rejects.toThrow('DB transaction error');

      expect(mockStorageProvider.trash).toHaveBeenCalledWith(
        userId,
        'drive-file-1',
      );
    });

    it('menolak dengan 409 ATTACHMENT_LIMIT_REACHED bila kuota terisi oleh upload paralel saat di dalam transaksi', async () => {
      mockPrisma.attachment.count.mockResolvedValueOnce(5);

      try {
        await service.uploadAttachments(userId, logId, [dummyFile]);
        expect.unreachable();
      } catch (err: any) {
        expect(err).toBeInstanceOf(DomainException);
        expect(err.code).toBe(ErrorCode.ATTACHMENT_LIMIT_REACHED);
      }

      expect(mockStorageProvider.trash).toHaveBeenCalledWith(
        userId,
        'drive-file-123',
      );
    });
  });

  describe('getAttachmentUrl', () => {
    it('mengembalikan url bertanda tangan untuk lampiran yang valid', async () => {
      mockPrisma.attachment.findFirst.mockResolvedValueOnce({
        id: 'att-1',
        logEntry: { user: dummyUser },
      });

      const result = await service.getAttachmentUrl(userId, 'att-1');

      expect(result.url).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('menolak 404 bila lampiran tidak ditemukan', async () => {
      mockPrisma.attachment.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getAttachmentUrl(userId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAttachmentContent', () => {
    it('menolak 401 bila token signed URL tidak valid atau kedaluwarsa', async () => {
      mockSignedUrlService.verifyToken.mockReturnValueOnce(null);

      await expect(
        service.getAttachmentContent('att-1', 'bad-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('berhasil mengalirkan stream bila token sah dan lampiran terverifikasi di DB', async () => {
      mockSignedUrlService.verifyToken.mockReturnValueOnce({
        attachmentId: 'att-1',
        userId,
        expiresAt: new Date(Date.now() + 60000),
      });

      mockPrisma.attachment.findFirst.mockResolvedValueOnce({
        id: 'att-1',
        driveFileId: 'drive-file-1',
        mimeType: 'image/jpeg',
        sizeBytes: 500,
        logEntry: { user: dummyUser },
      });

      const result = await service.getAttachmentContent('att-1', 'valid-token');

      expect(result.mimeType).toBe('image/jpeg');
      expect(result.sizeBytes).toBe(500);
      expect(mockStorageProvider.download).toHaveBeenCalledWith(
        userId,
        'drive-file-1',
      );
    });
  });

  describe('deleteAttachment', () => {
    it('menghapus lampiran, merapatkan posisi, dan memanggil trash pada storage', async () => {
      mockPrisma.attachment.findFirst.mockResolvedValueOnce({
        id: 'att-1',
        logEntryId: logId,
        driveFileId: 'drive-file-1',
      });

      mockPrisma.attachment.findMany.mockResolvedValueOnce([
        { id: 'att-2', position: 1 },
      ]);

      await service.deleteAttachment(userId, 'att-1');

      expect(mockPrisma.attachment.delete).toHaveBeenCalledWith({
        where: { id: 'att-1' },
      });
      // att-2 dirapatkan dari posisi 1 ke 0
      expect(mockPrisma.attachment.update).toHaveBeenCalledWith({
        where: { id: 'att-2' },
        data: { position: 0 },
      });
      expect(mockStorageProvider.trash).toHaveBeenCalledWith(
        userId,
        'drive-file-1',
      );
    });
  });
});
