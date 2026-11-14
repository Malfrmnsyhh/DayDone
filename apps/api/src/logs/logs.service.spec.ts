import { HttpStatus, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainException } from '../common/errors/domain.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { LogsService } from './logs.service.js';

describe('LogsService', () => {
  let service: LogsService;
  let mockPrisma: any;

  const userId = '11111111-1111-4111-8111-111111111111';
  const dummyLogEntry = {
    id: '22222222-2222-4222-8222-222222222222',
    userId,
    date: new Date('2026-11-01T00:00:00.000Z'),
    description: 'Deskripsi logbook',
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    updatedAt: new Date('2026-11-01T10:00:00.000Z'),
    attachments: [],
  };

  let mockAttachmentsService: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ driveStatus: 'CONNECTED' }),
      },
      logEntry: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    mockAttachmentsService = {
      buildAttachmentUrl: vi.fn((attId: string, _uId: string) => ({
        url: `http://localhost:3000/api/v1/attachments/${attId}/content?token=abc`,
        urlExpiresAt: '2026-11-03T10:05:00.000Z',
      })),
      trashAttachmentsForLog: vi.fn().mockResolvedValue(undefined),
    };

    service = new LogsService(
      mockPrisma as unknown as PrismaService,
      mockAttachmentsService,
    );
  });

  describe('create', () => {
    it('harus berhasil membuat logbook baru', async () => {
      mockPrisma.logEntry.create.mockResolvedValue(dummyLogEntry);

      const result = await service.create(userId, {
        date: '2026-11-01',
        description: 'Deskripsi logbook',
      });

      expect(result.id).toBe(dummyLogEntry.id);
      expect(result.date).toBe('2026-11-01');
      expect(mockPrisma.logEntry.create).toHaveBeenCalled();
    });

    it('harus menangkap P2002 dan melempar DomainException LOG_DATE_CONFLICT beserta existingLogId', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '7.10.1',
        },
      );
      mockPrisma.logEntry.create.mockRejectedValue(p2002Error);
      mockPrisma.logEntry.findFirst.mockResolvedValue({
        id: 'existing-id-123',
      });

      try {
        await service.create(userId, {
          date: '2026-11-01',
          description: 'Duplikat',
        });
        expect.unreachable('Harus melempar DomainException');
      } catch (err) {
        expect(err).toBeInstanceOf(DomainException);
        const domainErr = err as DomainException;
        expect(domainErr.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(domainErr.code).toBe(ErrorCode.LOG_DATE_CONFLICT);
        expect(domainErr.details).toEqual({ existingLogId: 'existing-id-123' });
      }
    });

    it('harus melempar kembali error tak terduga selain P2002', async () => {
      const genericError = new Error('Database connection failed');
      mockPrisma.logEntry.create.mockRejectedValue(genericError);

      await expect(
        service.create(userId, {
          date: '2026-11-01',
          description: 'Test',
        }),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('findOne & findByDate', () => {
    it('harus mengembalikan log sesuai id dan userId', async () => {
      mockPrisma.logEntry.findFirst.mockResolvedValue(dummyLogEntry);

      const result = await service.findOne(userId, dummyLogEntry.id);
      expect(result.id).toBe(dummyLogEntry.id);
      expect(mockPrisma.logEntry.findFirst).toHaveBeenCalledWith({
        where: { id: dummyLogEntry.id, userId },
        include: {
          attachments: {
            orderBy: { position: 'asc' },
          },
        },
      });
    });

    it('harus melempar NotFoundException jika id tidak ditemukan atau milik user lain', async () => {
      mockPrisma.logEntry.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, 'unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('harus mengembalikan log sesuai tanggal via unique userId_date', async () => {
      mockPrisma.logEntry.findUnique.mockResolvedValue(dummyLogEntry);

      const result = await service.findByDate(userId, '2026-11-01');
      expect(result.id).toBe(dummyLogEntry.id);
      expect(mockPrisma.logEntry.findUnique).toHaveBeenCalled();
    });

    it('harus melempar NotFoundException jika tanggal belum ada logbook', async () => {
      mockPrisma.logEntry.findUnique.mockResolvedValue(null);

      await expect(service.findByDate(userId, '2026-11-01')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('harus mengembalikan url null pada lampiran jika driveStatus NEEDS_RECONNECT', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        driveStatus: 'NEEDS_RECONNECT',
      });
      const logWithAtt = {
        ...dummyLogEntry,
        attachments: [
          {
            id: 'att-1',
            fileName: 'photo.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 1000,
            width: 800,
            height: 600,
            position: 0,
          },
        ],
      };
      mockPrisma.logEntry.findFirst.mockResolvedValue(logWithAtt);

      const result = await service.findOne(userId, dummyLogEntry.id);
      expect(result.attachments[0]?.url).toBeNull();
      expect(result.attachments[0]?.urlExpiresAt).toBeNull();
    });

    it('harus mengeksekusi urlBuilder callback saat log memiliki lampiran dan Drive CONNECTED', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        driveStatus: 'CONNECTED',
      });
      const logWithAtt = {
        ...dummyLogEntry,
        attachments: [
          {
            id: 'att-2',
            fileName: 'photo2.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 2000,
            width: 1024,
            height: 768,
            position: 0,
          },
        ],
      };
      mockPrisma.logEntry.findFirst.mockResolvedValue(logWithAtt);

      const result = await service.findOne(userId, dummyLogEntry.id);
      expect(mockAttachmentsService.buildAttachmentUrl).toHaveBeenCalledWith(
        'att-2',
        userId,
      );
      expect(result.attachments[0]?.url).toContain('att-2');
    });
  });

  describe('update', () => {
    it('harus berhasil memperbarui logbook dengan updateMany yang di-scope userId', async () => {
      mockPrisma.logEntry.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.logEntry.findFirst.mockResolvedValue({
        ...dummyLogEntry,
        description: 'Updated deskripsi',
      });

      const result = await service.update(userId, dummyLogEntry.id, {
        description: 'Updated deskripsi',
      });

      expect(mockPrisma.logEntry.updateMany).toHaveBeenCalledWith({
        where: { id: dummyLogEntry.id, userId },
        data: { description: 'Updated deskripsi' },
      });
      expect(result.description).toBe('Updated deskripsi');
    });

    it('harus melempar NotFoundException jika id tidak ditemukan atau milik user lain saat update', async () => {
      mockPrisma.logEntry.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.update(userId, 'unknown-id', { description: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.logEntry.findFirst).not.toHaveBeenCalled();
    });

    it('harus melempar LOG_DATE_CONFLICT jika update tanggal menyebabkan P2002', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '7.10.1',
        },
      );
      mockPrisma.logEntry.updateMany.mockRejectedValue(p2002Error);
      mockPrisma.logEntry.findFirst.mockResolvedValue({
        id: 'existing-other-id',
      });

      await expect(
        service.update(userId, dummyLogEntry.id, { date: '2026-11-02' }),
      ).rejects.toThrow(DomainException);
    });

    it('harus melempar kembali error tak terduga selain P2002 saat update', async () => {
      const genericError = new Error('DB write failed');
      mockPrisma.logEntry.updateMany.mockRejectedValue(genericError);

      await expect(
        service.update(userId, dummyLogEntry.id, { description: 'Updated' }),
      ).rejects.toThrow('DB write failed');
    });
  });

  describe('remove', () => {
    it('harus menghapus logbook jika ditemukan dan milik pengguna menggunakan deleteMany yang di-scope userId', async () => {
      mockPrisma.logEntry.findFirst.mockResolvedValue(dummyLogEntry);
      mockPrisma.logEntry.deleteMany.mockResolvedValue({ count: 1 });

      await expect(
        service.remove(userId, dummyLogEntry.id),
      ).resolves.toBeUndefined();
      expect(mockPrisma.logEntry.deleteMany).toHaveBeenCalledWith({
        where: { id: dummyLogEntry.id, userId },
      });
    });

    it('harus melempar NotFoundException jika id tidak ditemukan saat remove', async () => {
      mockPrisma.logEntry.findFirst.mockResolvedValue(null);

      await expect(service.remove(userId, 'unknown-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.logEntry.deleteMany).not.toHaveBeenCalled();
    });

    it('harus melempar NotFoundException jika deleteMany menghasilkan count 0', async () => {
      mockPrisma.logEntry.findFirst.mockResolvedValue(dummyLogEntry);
      mockPrisma.logEntry.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.remove(userId, dummyLogEntry.id)).rejects.toThrow(
        NotFoundException,
      );
      expect(
        mockAttachmentsService.trashAttachmentsForLog,
      ).not.toHaveBeenCalled();
    });

    it('harus mentrash lampiran di Drive jika logbook memiliki lampiran', async () => {
      const logWithAttachments = {
        ...dummyLogEntry,
        attachments: [{ driveFileId: 'drive-file-123' }],
      };
      mockPrisma.logEntry.findFirst.mockResolvedValue(logWithAttachments);
      mockPrisma.logEntry.deleteMany.mockResolvedValue({ count: 1 });

      await service.remove(userId, dummyLogEntry.id);

      expect(
        mockAttachmentsService.trashAttachmentsForLog,
      ).toHaveBeenCalledWith(userId, logWithAttachments.attachments);
    });
  });

  describe('findAll', () => {
    it('harus mengembalikan daftar log terpaginasi dengan meta yang benar', async () => {
      mockPrisma.$transaction.mockResolvedValue([
        25, // total
        [dummyLogEntry], // items
      ]);

      const result = await service.findAll(userId, {
        page: 2,
        limit: 10,
        search: 'magang',
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total).toBe(25);
      expect(result.meta.totalPages).toBe(3); // ceil(25 / 10)
    });

    it('harus mengembalikan totalPages 0 bila total 0', async () => {
      mockPrisma.$transaction.mockResolvedValue([0, []]);

      const result = await service.findAll(userId, {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('harus menyaring berdasarkan query from saja', async () => {
      mockPrisma.$transaction.mockResolvedValue([1, [dummyLogEntry]]);

      await service.findAll(userId, { from: '2026-11-01' });

      expect(mockPrisma.logEntry.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId,
          date: { gte: expect.any(Date) },
        }),
      });
    });

    it('harus menyaring berdasarkan query to saja', async () => {
      mockPrisma.$transaction.mockResolvedValue([1, [dummyLogEntry]]);

      await service.findAll(userId, { to: '2026-11-30' });

      expect(mockPrisma.logEntry.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId,
          date: { lte: expect.any(Date) },
        }),
      });
    });

    it('harus menyaring berdasarkan query from dan to sekaligus', async () => {
      mockPrisma.$transaction.mockResolvedValue([1, [dummyLogEntry]]);

      await service.findAll(userId, {
        from: '2026-11-01',
        to: '2026-11-30',
      });

      expect(mockPrisma.logEntry.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId,
          date: { gte: expect.any(Date), lte: expect.any(Date) },
        }),
      });
    });
  });

  describe('stats', () => {
    it('harus mengembalikan statistik bulanan dan total seluruh waktu yang di-scope userId', async () => {
      const monthLogs = [
        { date: new Date('2026-11-03T00:00:00.000Z') },
        { date: new Date('2026-11-05T00:00:00.000Z') },
        { date: new Date('2026-11-12T00:00:00.000Z') },
      ];
      mockPrisma.$transaction.mockResolvedValue([
        10, // totalAllTime
        monthLogs,
      ]);

      const result = await service.stats(userId, '2026-11');

      expect(result).toEqual({
        month: '2026-11',
        totalThisMonth: 3,
        totalAllTime: 10,
        loggedDates: ['2026-11-03', '2026-11-05', '2026-11-12'],
      });

      expect(mockPrisma.logEntry.count).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(mockPrisma.logEntry.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          date: {
            gte: new Date('2026-11-01T00:00:00.000Z'),
            lt: new Date('2026-12-01T00:00:00.000Z'),
          },
        },
        select: {
          date: true,
        },
        orderBy: {
          date: 'asc',
        },
      });
    });

    it('harus menangani pergantian tahun pada bulan Desember (12 -> 01 tahun depan)', async () => {
      mockPrisma.$transaction.mockResolvedValue([
        5,
        [{ date: new Date('2026-12-31T00:00:00.000Z') }],
      ]);

      const result = await service.stats(userId, '2026-12');

      expect(result.month).toBe('2026-12');
      expect(result.totalThisMonth).toBe(1);
      expect(result.loggedDates).toEqual(['2026-12-31']);

      expect(mockPrisma.logEntry.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          date: {
            gte: new Date('2026-12-01T00:00:00.000Z'),
            lt: new Date('2027-01-01T00:00:00.000Z'),
          },
        },
        select: {
          date: true,
        },
        orderBy: {
          date: 'asc',
        },
      });
    });

    it('harus mengembalikan array loggedDates kosong jika tidak ada logbook di bulan tersebut', async () => {
      mockPrisma.$transaction.mockResolvedValue([
        7, // totalAllTime
        [], // monthLogs kosong
      ]);

      const result = await service.stats(userId, '2026-05');

      expect(result).toEqual({
        month: '2026-05',
        totalThisMonth: 0,
        totalAllTime: 7,
        loggedDates: [],
      });
    });
  });
});
