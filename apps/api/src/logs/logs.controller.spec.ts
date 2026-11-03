import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUserData } from '../common/decorators/current-user.decorator.js';
import { LogsController } from './logs.controller.js';
import { LogsService } from './logs.service.js';

describe('LogsController', () => {
  let controller: LogsController;
  let mockLogsService: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    findByDate: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  const mockUser: CurrentUserData = {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'user@daydone.local',
  };

  const mockLogResponse = {
    id: '22222222-2222-4222-8222-222222222222',
    date: '2026-11-01',
    description: 'Test log',
    attachments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    mockLogsService = {
      findAll: vi.fn().mockResolvedValue({
        data: [{ ...mockLogResponse, attachmentCount: 0 }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
      findOne: vi.fn().mockResolvedValue(mockLogResponse),
      findByDate: vi.fn().mockResolvedValue(mockLogResponse),
      create: vi.fn().mockResolvedValue(mockLogResponse),
      update: vi.fn().mockResolvedValue(mockLogResponse),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LogsController],
      providers: [
        {
          provide: LogsService,
          useValue: mockLogsService,
        },
      ],
    }).compile();

    controller = module.get<LogsController>(LogsController);
  });

  it('harus memanggil create dengan userId dan mengembalikan log baru', async () => {
    const result = await controller.create(mockUser, {
      date: '2026-11-01',
      description: 'Test log',
    });
    expect(mockLogsService.create).toHaveBeenCalledWith(mockUser.userId, {
      date: '2026-11-01',
      description: 'Test log',
    });
    expect(result.id).toBe(mockLogResponse.id);
  });

  it('harus memanggil findByDate dengan userId dan date', async () => {
    const result = await controller.findByDate(mockUser, {
      date: '2026-11-01',
    });
    expect(mockLogsService.findByDate).toHaveBeenCalledWith(
      mockUser.userId,
      '2026-11-01',
    );
    expect(result.date).toBe('2026-11-01');
  });

  it('harus memanggil findAll dengan userId dan query filter', async () => {
    const query = { page: 1, limit: 20, search: 'test' };
    const result = await controller.findAll(mockUser, query);
    expect(mockLogsService.findAll).toHaveBeenCalledWith(
      mockUser.userId,
      query,
    );
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('harus memanggil update dengan userId, id, dan dto', async () => {
    const result = await controller.update(mockUser, mockLogResponse.id, {
      description: 'Updated',
    });
    expect(mockLogsService.update).toHaveBeenCalledWith(
      mockUser.userId,
      mockLogResponse.id,
      {
        description: 'Updated',
      },
    );
    expect(result.id).toBe(mockLogResponse.id);
  });

  it('harus memanggil remove dengan userId dan id', async () => {
    await controller.remove(mockUser, mockLogResponse.id);
    expect(mockLogsService.remove).toHaveBeenCalledWith(
      mockUser.userId,
      mockLogResponse.id,
    );
  });
});
