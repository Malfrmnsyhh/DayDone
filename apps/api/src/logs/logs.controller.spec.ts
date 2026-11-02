import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { LogsController } from './logs.controller.js';
import { LogsService } from './logs.service.js';

describe('LogsController', () => {
  let controller: LogsController;
  let service: LogsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LogsController],
      providers: [LogsService],
    }).compile();

    controller = module.get<LogsController>(LogsController);
    service = module.get<LogsService>(LogsService);
  });

  it('harus memanggil create dan mengembalikan log baru', () => {
    const log = controller.create({
      date: '2026-11-01',
      description: 'Test log',
    });
    expect(log.id).toBeDefined();
    expect(log.date).toBe('2026-11-01');
  });

  it('harus memanggil findByDate dan mengembalikan log', () => {
    const created = service.create({
      date: '2026-11-02',
      description: 'Log per tanggal',
    });

    const result = controller.findByDate({ date: '2026-11-02' });
    expect(result.id).toBe(created.id);
  });

  it('harus memanggil findAll dengan query filter', () => {
    service.create({ date: '2026-11-01', description: 'Alpha' });
    service.create({ date: '2026-11-02', description: 'Beta' });

    const results = controller.findAll({ search: 'alpha' });
    expect(results).toHaveLength(1);
    expect(results[0].description).toBe('Alpha');
  });

  it('harus memanggil update dan mengembalikan log terupdate', () => {
    const created = service.create({ date: '2026-11-01', description: 'Old' });
    const updated = controller.update(created.id, { description: 'New' });
    expect(updated.description).toBe('New');
  });

  it('harus memanggil remove untuk menghapus log', () => {
    const created = service.create({
      date: '2026-11-01',
      description: 'To delete',
    });
    expect(() => controller.remove(created.id)).not.toThrow();
  });
});
