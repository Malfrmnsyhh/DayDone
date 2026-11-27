import { describe, expect, it } from 'vitest';
import { getDriveStatusInfo } from './drive-status';

describe('getDriveStatusInfo', () => {
  it('mengembalikan tone connected saat status CONNECTED', () => {
    const info = getDriveStatusInfo('CONNECTED');

    expect(info.tone).toBe('connected');
    expect(info.title).toContain('Terhubung');
    expect(info.description).toContain('DayDone');
  });

  it('mengembalikan tone warning saat status NEEDS_RECONNECT', () => {
    const info = getDriveStatusInfo('NEEDS_RECONNECT');

    expect(info.tone).toBe('warning');
    expect(info.title).toContain('Hubungkan Ulang');
    expect(info.description).toContain('kedaluwarsa');
  });

  it('mengembalikan tone neutral saat status NOT_CONNECTED atau undefined', () => {
    const notConnected = getDriveStatusInfo('NOT_CONNECTED');
    const fallback = getDriveStatusInfo(undefined);

    expect(notConnected.tone).toBe('neutral');
    expect(notConnected.title).toContain('Belum Terhubung');
    expect(fallback).toEqual(notConnected);
  });
});
