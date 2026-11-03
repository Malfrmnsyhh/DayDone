import { ServiceUnavailableException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaMock: { $queryRaw: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('harus mengembalikan status ok dan database up saat koneksi DB sehat', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

    const result = await controller.check();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('harus melempar ServiceUnavailableException (503) saat query DB gagal', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('DB Connection Refused'));

    await expect(controller.check()).rejects.toThrow(
      ServiceUnavailableException,
    );

    try {
      await controller.check();
    } catch (err) {
      const error = err as ServiceUnavailableException;
      expect(error.getStatus()).toBe(503);
      const response = error.getResponse() as Record<string, unknown>;
      expect(response.status).toBe('error');
      expect(response.database).toBe('down');
      expect(response.timestamp).toBeDefined();
    }
  });
});
