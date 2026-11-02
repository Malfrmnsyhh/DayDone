import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { LogsService } from './logs.service.js';

describe('LogsService', () => {
  let service: LogsService;

  beforeEach(() => {
    service = new LogsService();
  });

  describe('create', () => {
    it('harus berhasil membuat logbook baru', () => {
      const log = service.create({
        date: '2026-11-01',
        description: 'Mengerjakan fitur auth',
      });

      expect(log.id).toBeDefined();
      expect(log.date).toBe('2026-11-01');
      expect(log.description).toBe('Mengerjakan fitur auth');
      expect(log.createdAt).toBeDefined();
      expect(log.updatedAt).toBeDefined();
    });

    it('harus melempar ConflictException jika tanggal sudah ada', () => {
      service.create({
        date: '2026-11-01',
        description: 'Log hari pertama',
      });

      expect(() =>
        service.create({
          date: '2026-11-01',
          description: 'Log duplikat tanggal',
        }),
      ).toThrow(ConflictException);
    });
  });

  describe('findOne & findByDate', () => {
    it('harus mengembalikan log sesuai id', () => {
      const created = service.create({
        date: '2026-11-01',
        description: 'Belajar NestJS',
      });

      const found = service.findOne(created.id);
      expect(found).toEqual(created);
    });

    it('harus melempar NotFoundException jika id tidak ditemukan', () => {
      expect(() => service.findOne('non-existent-id')).toThrow(
        NotFoundException,
      );
    });

    it('harus mengembalikan log sesuai tanggal', () => {
      const created = service.create({
        date: '2026-11-02',
        description: 'Belajar Vitest',
      });

      const found = service.findByDate('2026-11-02');
      expect(found).toEqual(created);
    });

    it('harus melempar NotFoundException jika tanggal belum ada logbook', () => {
      expect(() => service.findByDate('2026-11-03')).toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('harus berhasil memperbarui deskripsi logbook', () => {
      const created = service.create({
        date: '2026-11-01',
        description: 'Deskripsi lama',
      });

      const updated = service.update(created.id, {
        description: 'Deskripsi baru',
      });

      expect(updated.description).toBe('Deskripsi baru');
      expect(updated.date).toBe('2026-11-01');
    });

    it('harus berhasil memperbarui tanggal jika tanggal baru belum terpakai', () => {
      const created = service.create({
        date: '2026-11-01',
        description: 'Deskripsi log',
      });

      const updated = service.update(created.id, {
        date: '2026-11-02',
      });

      expect(updated.date).toBe('2026-11-02');
    });

    it('harus melempar ConflictException jika mengubah tanggal ke tanggal yang sudah ada di log lain', () => {
      service.create({
        date: '2026-11-01',
        description: 'Log 1',
      });
      const log2 = service.create({
        date: '2026-11-02',
        description: 'Log 2',
      });

      expect(() =>
        service.update(log2.id, {
          date: '2026-11-01',
        }),
      ).toThrow(ConflictException);
    });

    it('tidak boleh melempar ConflictException jika tanggal yang diupdate sama dengan tanggal saat ini', () => {
      const created = service.create({
        date: '2026-11-01',
        description: 'Log awal',
      });

      expect(() =>
        service.update(created.id, {
          date: '2026-11-01',
          description: 'Log awal diperbarui',
        }),
      ).not.toThrow();
    });

    it('harus melempar NotFoundException jika id tidak ditemukan saat update', () => {
      expect(() =>
        service.update('random-id', { description: 'Baru' }),
      ).toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('harus berhasil menghapus logbook', () => {
      const created = service.create({
        date: '2026-11-01',
        description: 'Log akan dihapus',
      });

      service.remove(created.id);

      expect(() => service.findOne(created.id)).toThrow(NotFoundException);
    });

    it('harus melempar NotFoundException jika id yang akan dihapus tidak ada', () => {
      expect(() => service.remove('non-existent-id')).toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      service.create({
        date: '2026-11-01',
        description: 'Setup database PostgreSQL',
      });
      service.create({
        date: '2026-11-02',
        description: 'Implementasi API endpoint logbook',
      });
      service.create({
        date: '2026-11-03',
        description: 'Menulis unit test dengan Vitest',
      });
    });

    it('harus mengembalikan semua log terurut tanggal menurun (terbaru di atas)', () => {
      const logs = service.findAll({});
      expect(logs).toHaveLength(3);
      expect(logs[0].date).toBe('2026-11-03');
      expect(logs[1].date).toBe('2026-11-02');
      expect(logs[2].date).toBe('2026-11-01');
    });

    it('harus memfilter berdasarkan parameter from', () => {
      const logs = service.findAll({ from: '2026-11-02' });
      expect(logs).toHaveLength(2);
      expect(logs.map((l) => l.date)).toEqual(['2026-11-03', '2026-11-02']);
    });

    it('harus memfilter berdasarkan parameter to', () => {
      const logs = service.findAll({ to: '2026-11-02' });
      expect(logs).toHaveLength(2);
      expect(logs.map((l) => l.date)).toEqual(['2026-11-02', '2026-11-01']);
    });

    it('harus memfilter berdasarkan rentang from dan to', () => {
      const logs = service.findAll({
        from: '2026-11-02',
        to: '2026-11-02',
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].date).toBe('2026-11-02');
    });

    it('harus memfilter berdasarkan search secara case-insensitive', () => {
      const logsUpper = service.findAll({ search: 'DATABASE' });
      expect(logsUpper).toHaveLength(1);
      expect(logsUpper[0].date).toBe('2026-11-01');

      const logsLower = service.findAll({ search: 'vitest' });
      expect(logsLower).toHaveLength(1);
      expect(logsLower[0].date).toBe('2026-11-03');

      const logsPartial = service.findAll({ search: 'endpoint' });
      expect(logsPartial).toHaveLength(1);
      expect(logsPartial[0].date).toBe('2026-11-02');
    });
  });
});
