import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLogSchema,
  listLogsQuerySchema,
  updateLogSchema,
} from './log.schema.js';

describe('Log Schema', () => {
  describe('createLogSchema & dynamic date limit', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Tetapkan waktu server ke 2026-11-03T10:00:00.000Z
      vi.setSystemTime(new Date('2026-11-03T10:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('mengizinkan tanggal hari ini dan hari esok (+1 hari UTC)', () => {
      const today = createLogSchema.safeParse({
        date: '2026-11-03',
        description: 'Hari ini',
      });
      expect(today.success).toBe(true);

      const tomorrow = createLogSchema.safeParse({
        date: '2026-11-04',
        description: 'Besok',
      });
      expect(tomorrow.success).toBe(true);
    });

    it('menolak tanggal lebih dari 1 hari di masa depan', () => {
      const lusa = createLogSchema.safeParse({
        date: '2026-11-05',
        description: 'Lusa',
      });
      expect(lusa.success).toBe(false);
      if (!lusa.success) {
        expect(lusa.error.issues[0]?.message).toContain(
          'lebih dari 1 hari setelah tanggal server',
        );
      }
    });

    it('menghitung batas dinamis saat jam server berubah (fake timers)', () => {
      // 2026-11-05 awalnya ditolak saat jam server 2026-11-03
      expect(
        createLogSchema.safeParse({
          date: '2026-11-05',
          description: 'Test',
        }).success,
      ).toBe(false);

      // Ubah jam server maju ke 2026-11-04T12:00:00.000Z
      vi.setSystemTime(new Date('2026-11-04T12:00:00.000Z'));

      // Sekarang 2026-11-05 (+1 hari dari 4 Nov) harus diterima
      expect(
        createLogSchema.safeParse({
          date: '2026-11-05',
          description: 'Test',
        }).success,
      ).toBe(true);

      // Tapi 2026-11-06 ditolak
      expect(
        createLogSchema.safeParse({
          date: '2026-11-06',
          description: 'Test',
        }).success,
      ).toBe(false);
    });
  });

  describe('updateLogSchema', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-03T10:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('menolak body kosong', () => {
      const res = updateLogSchema.safeParse({});
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toBe(
          'Minimal satu field harus diisi',
        );
      }
    });

    it('menolak jika tanggal baru lebih dari 1 hari ke depan', () => {
      const res = updateLogSchema.safeParse({ date: '2026-11-06' });
      expect(res.success).toBe(false);
    });

    it('menerima pembaruan valid', () => {
      const res = updateLogSchema.safeParse({ description: 'Update deskripsi' });
      expect(res.success).toBe(true);
    });
  });

  describe('listLogsQuerySchema', () => {
    it('memberikan nilai default page=1 dan limit=20 jika tidak diisi', () => {
      const parsed = listLogsQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
    });

    it('melakukan type coercion untuk string page dan limit', () => {
      const parsed = listLogsQuerySchema.parse({ page: '2', limit: '50' });
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(50);
    });

    it('menerima rentang tanggal from <= to', () => {
      const parsed = listLogsQuerySchema.safeParse({
        from: '2026-11-01',
        to: '2026-11-03',
      });
      expect(parsed.success).toBe(true);
    });

    it('menolak bila from > to', () => {
      const parsed = listLogsQuerySchema.safeParse({
        from: '2026-11-05',
        to: '2026-11-02',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain(
          'Tanggal from harus lebih kecil atau sama dengan to',
        );
      }
    });
  });
});

