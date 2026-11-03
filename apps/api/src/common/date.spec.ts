import { describe, expect, it } from 'vitest';
import { fromDbDate, toDbDate } from './date.js';

describe('Date Helper (toDbDate & fromDbDate)', () => {
  describe('toDbDate', () => {
    it('harus menghasilkan objek Date tepat pada tengah malam UTC (00:00:00.000Z)', () => {
      const date = toDbDate('2026-06-15');

      expect(date.getUTCFullYear()).toBe(2026);
      expect(date.getUTCMonth()).toBe(5); // 0-indexed: 5 = Juni
      expect(date.getUTCDate()).toBe(15);
      expect(date.getUTCHours()).toBe(0);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
      expect(date.getUTCMilliseconds()).toBe(0);
      expect(date.toISOString()).toBe('2026-06-15T00:00:00.000Z');
    });

    it('harus menangani batas awal tahun (1 Jan)', () => {
      const date = toDbDate('2026-01-01');
      expect(date.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(fromDbDate(date)).toBe('2026-01-01');
    });

    it('harus menangani batas akhir tahun (31 Des)', () => {
      const date = toDbDate('2026-12-31');
      expect(date.toISOString()).toBe('2026-12-31T00:00:00.000Z');
      expect(fromDbDate(date)).toBe('2026-12-31');
    });

    it('harus menangani tahun kabisat (29 Feb 2028)', () => {
      const date = toDbDate('2028-02-29');
      expect(date.toISOString()).toBe('2028-02-29T00:00:00.000Z');
      expect(date.getUTCFullYear()).toBe(2028);
      expect(date.getUTCMonth()).toBe(1); // Februari
      expect(date.getUTCDate()).toBe(29);
      expect(fromDbDate(date)).toBe('2028-02-29');
    });
  });

  describe('fromDbDate & bukti tidak bergeser zona waktu', () => {
    it('harus selalu mengembalikan string YYYY-MM-DD berbasis UTC tanpa terpengaruh zona waktu lokal', () => {
      // Simulasikan Date dari Prisma (@db.Date dikembalikan sebagai tengah malam UTC)
      const prismaDate = new Date('2026-11-02T00:00:00.000Z');
      const formatted = fromDbDate(prismaDate);

      expect(formatted).toBe('2026-11-02');
      // toISOString().slice(0, 10) dijamin selalu menggunakan UTC
      expect(formatted).toBe(prismaDate.toISOString().slice(0, 10));
    });

    it('harus menjamin konsistensi bolak-balik (round-trip)', () => {
      const testDates = [
        '2026-01-01',
        '2026-02-28',
        '2028-02-29',
        '2026-07-04',
        '2026-12-31',
      ];

      for (const iso of testDates) {
        expect(fromDbDate(toDbDate(iso))).toBe(iso);
      }
    });
  });
});
