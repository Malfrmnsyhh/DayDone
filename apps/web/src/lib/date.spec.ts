import { describe, expect, it } from 'vitest';
import {
  formatDateIndonesian,
  formatShortDateIndonesian,
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

