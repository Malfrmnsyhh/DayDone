import { describe, expect, it } from 'vitest';
import {
  formatDateIndonesian,
  formatShortDateIndonesian,
  getCurrentLocalMonthString,
  getMissingWeekdays,
  getTodayLocalDateString,
  parseLocalDate,
} from './date.js';

describe('Date Utilities (apps/web)', () => {
  it('menghasilkan tanggal hari ini lokal berformat YYYY-MM-DD', () => {
    const today = getTodayLocalDateString();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const now = new Date();
    const [y, m, d] = today.split('-').map(Number);
    expect(y).toBe(now.getFullYear());
    expect(m).toBe(now.getMonth() + 1);
    expect(d).toBe(now.getDate());
  });

  it('parseLocalDate tidak bergeser zona waktu pada tanggal batas', () => {
    const date1 = parseLocalDate('2026-01-01');
    expect(date1.getFullYear()).toBe(2026);
    expect(date1.getMonth()).toBe(0);
    expect(date1.getDate()).toBe(1);

    const date2 = parseLocalDate('2026-12-31');
    expect(date2.getFullYear()).toBe(2026);
    expect(date2.getMonth()).toBe(11);
    expect(date2.getDate()).toBe(31);

    const leap = parseLocalDate('2024-02-29');
    expect(leap.getFullYear()).toBe(2024);
    expect(leap.getMonth()).toBe(1);
    expect(leap.getDate()).toBe(29);
  });

  it('formatDateIndonesian memformat tanggal dalam bahasa Indonesia', () => {
    const formatted = formatDateIndonesian('2026-11-05');
    expect(formatted.toLowerCase()).toContain('november');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('5');
  });

  it('formatShortDateIndonesian memformat tanggal dengan ringkas', () => {
    const formatted = formatShortDateIndonesian('2026-11-05');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('5');
  });
});

describe('getMissingWeekdays (FR-13)', () => {
  // November 2026: tanggal 1 = Minggu, 2 = Senin, 7–8 = Sabtu–Minggu

  it('hari ini Senin di awal bulan: hanya hari Senin itu yang dihitung (Minggu dilewati)', () => {
    expect(getMissingWeekdays('2026-11', [], '2026-11-02')).toEqual([
      '2026-11-02',
    ]);
  });

  it('melewati Sabtu/Minggu dan tanggal yang sudah punya logbook', () => {
    const missing = getMissingWeekdays(
      '2026-11',
      ['2026-11-02', '2026-11-04'],
      '2026-11-09',
    );
    expect(missing).toEqual([
      '2026-11-03',
      '2026-11-05',
      '2026-11-06',
      '2026-11-09',
    ]);
  });

  it('bulan yang sudah lewat (pergantian bulan) dihitung sampai akhir bulan', () => {
    // Oktober 2026 punya 22 hari kerja; hari ini sudah November
    const missing = getMissingWeekdays('2026-10', [], '2026-11-02');
    expect(missing).toHaveLength(22);
    expect(missing[0]).toBe('2026-10-01');
    expect(missing.at(-1)).toBe('2026-10-30');
  });

  it('akhir tahun: Desember dihitung penuh saat hari ini sudah Januari', () => {
    const missing = getMissingWeekdays('2026-12', [], '2027-01-04');
    expect(missing.at(-1)).toBe('2026-12-31');
  });

  it('bulan mendatang menghasilkan daftar kosong', () => {
    expect(getMissingWeekdays('2026-12', [], '2026-11-14')).toEqual([]);
  });

  it('getCurrentLocalMonthString memotong YYYY-MM dari tanggal lokal', () => {
    expect(getCurrentLocalMonthString('2026-11-14')).toBe('2026-11');
  });
});
