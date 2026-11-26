import { describe, expect, it } from 'vitest';
import {
  formatDateIndonesian,
  formatShortDateIndonesian,
  getTodayLocalDateString,
  parseLocalDate,
} from './date';

describe('mobile date helpers', () => {
  it('getTodayLocalDateString mengembalikan YYYY-MM-DD sesuai kalender lokal tanpa pergeseran UTC', () => {
    const earlyMorningLocal = new Date(2026, 10, 26, 0, 30, 0); // 26 Nov 2026 00:30 lokal
    const lateNightLocal = new Date(2026, 0, 1, 23, 59, 59); // 1 Jan 2026 23:59 lokal

    expect(getTodayLocalDateString(earlyMorningLocal)).toBe('2026-11-26');
    expect(getTodayLocalDateString(lateNightLocal)).toBe('2026-01-01');
  });

  it('parseLocalDate menjaga tanggal batas (1 Jan, 31 Des, 29 Feb kabisat) pada jam 00:00 lokal', () => {
    const jan1 = parseLocalDate('2026-01-01');
    expect(jan1.getFullYear()).toBe(2026);
    expect(jan1.getMonth()).toBe(0);
    expect(jan1.getDate()).toBe(1);
    expect(jan1.getHours()).toBe(0);

    const dec31 = parseLocalDate('2026-12-31');
    expect(dec31.getFullYear()).toBe(2026);
    expect(dec31.getMonth()).toBe(11);
    expect(dec31.getDate()).toBe(31);

    const leapDay = parseLocalDate('2024-02-29');
    expect(leapDay.getFullYear()).toBe(2024);
    expect(leapDay.getMonth()).toBe(1);
    expect(leapDay.getDate()).toBe(29);
  });

  it('formatDateIndonesian menampilkan format lengkap bahasa Indonesia', () => {
    expect(formatDateIndonesian('2026-11-26')).toBe('Kamis, 26 November 2026');
  });

  it('formatShortDateIndonesian menampilkan format ringkas bahasa Indonesia', () => {
    expect(formatShortDateIndonesian('2026-11-26')).toBe('26 Nov 2026');
  });
});
