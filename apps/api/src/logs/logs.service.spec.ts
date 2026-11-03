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
        delete: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    mockAttachmentsService = {
      buildAttachmentUrl: vi.fn((attId: string, uId: string) => ({
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
      mockPrisma.logEntry.findFirst.mockResolvedValue({ id: 'existing-id-123' });

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
  });

  describe('update', () => {
    it('harus berhasil memperbarui logbook', async () => {
      mockPrisma.logEntry.findFirst.mockResolvedValue(dummyLogEntry);
      mockPrisma.logEntry.update.mockResolvedValue({
        ...dummyLogEntry,
        description: 'Updated deskripsi',
      });

      const result = await service.update(userId, dummyLogEntry.id, {
        description: 'Updated deskripsi',
      });
      expect(result.description).toBe('Updated deskripsi');
    });

    it('harus melempar LOG_DATE_CONFLICT jika update tanggal menyebabkan P2002', async () => {
      mockPrisma.logEntry.findFirst
        .mockResolvedValueOnce(dummyLogEntry) // findOne check
        .mockResolvedValueOnce({ id: 'existing-other-id' }); // findFirst for existing conflict
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '7.10.1',
        },
      );
      mockPrisma.logEntry.update.mockRejectedValue(p2002Error);

      await expect(
        service.update(userId, dummyLogEntry.id, { date: '2026-11-02' }),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('remove', () => {
    it('harus menghapus logbook jika ditemukan dan milik pengguna', async () => {
      mockPrisma.logEntry.findFirst.mockResolvedValue(dummyLogEntry);
      mockPrisma.logEntry.delete.mockResolvedValue(dummyLogEntry);

      await expect(
        service.remove(userId, dummyLogEntry.id),
      ).resolves.toBeUndefined();
      expect(mockPrisma.logEntry.delete).toHaveBeenCalledWith({
        where: { id: dummyLogEntry.id },
      });
    });

    it('harus melempar NotFoundException jika id tidak ditemukan saat remove', async () => {
      mockPrisma.logEntry.findFirst.mockResolvedValue(null);

      await expect(service.remove(userId, 'unknown-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.logEntry.delete).not.toHaveBeenCalled();
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
  });
});
