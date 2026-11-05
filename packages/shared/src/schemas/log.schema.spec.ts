import { describe, expect, it } from 'vitest';
import {
  createLogSchema,
  getMaxAllowedDate,
  listLogsQuerySchema,
  updateLogSchema,
} from './log.schema.js';

describe('Log Schemas (@daydone/shared)', () => {
  describe('createLogSchema', () => {
    it('menerima payload yang valid', () => {
      const data = {
        date: '2026-06-15',
        description: 'Mengerjakan fitur login',
      };
      const result = createLogSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('menolak deskripsi kosong', () => {
      const data = {
        date: '2026-06-15',
        description: '   ',
      };
      const result = createLogSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('menolak tanggal lebih dari 1 hari di masa depan', () => {
      const future = new Date();
      future.setUTCDate(future.getUTCDate() + 5);
      const futureStr = future.toISOString().slice(0, 10);

      const result = createLogSchema.safeParse({
        date: futureStr,
        description: 'Kegiatan masa depan',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateLogSchema', () => {
    it('menerima update hanya deskripsi', () => {
      const result = updateLogSchema.safeParse({
        description: 'Deskripsi baru',
      });
      expect(result.success).toBe(true);
    });

    it('menolak object kosong', () => {
      const result = updateLogSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('listLogsQuerySchema', () => {
    it('menerima nilai default', () => {
      const result = listLogsQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('menolak from > to', () => {
      const result = listLogsQuerySchema.safeParse({
        from: '2026-06-20',
        to: '2026-06-10',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('getMaxAllowedDate', () => {
    it('mengembalikan string tanggal format YYYY-MM-DD', () => {
      const maxDate = getMaxAllowedDate();
      expect(maxDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});

