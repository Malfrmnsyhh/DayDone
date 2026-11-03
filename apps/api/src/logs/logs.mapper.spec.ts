import { describe, expect, it } from 'vitest';
import { toLogListItemResponse, toLogResponse } from './logs.mapper.js';

describe('Logs Mapper', () => {
  const dummyLog = {
    id: 'log-uuid-1',
    userId: 'user-uuid-1',
    date: new Date('2026-11-03T00:00:00.000Z'),
    description: 'Deskripsi logbook',
    createdAt: new Date('2026-11-03T10:00:00.000Z'),
    updatedAt: new Date('2026-11-03T10:00:00.000Z'),
    attachments: [
      {
        id: 'att-uuid-1',
        fileName: 'foto.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        width: 800,
        height: 600,
        position: 0,
      },
    ],
  };

  it('toLogResponse memetakan entitas dengan benar dan menyembunyikan userId', () => {
    const res = toLogResponse(dummyLog);

    expect(res.id).toBe('log-uuid-1');
    expect(res.date).toBe('2026-11-03');
    expect(res.description).toBe('Deskripsi logbook');
    expect(res.createdAt).toBe('2026-11-03T10:00:00.000Z');
    expect(res.updatedAt).toBe('2026-11-03T10:00:00.000Z');
    expect(res.attachments).toHaveLength(1);
    expect(res.attachments[0]?.fileName).toBe('foto.jpg');
    // Pastikan tidak ada properti userId
    expect((res as Record<string, unknown>).userId).toBeUndefined();
  });

  it('toLogListItemResponse menyertakan attachmentCount dari _count jika tersedia', () => {
    const res = toLogListItemResponse({
      ...dummyLog,
      _count: { attachments: 5 },
    });

    expect(res.attachmentCount).toBe(5);
  });

  it('toLogListItemResponse menghitung attachmentCount dari array attachments bila _count tidak ada', () => {
    const res = toLogListItemResponse(dummyLog);

    expect(res.attachmentCount).toBe(1);
  });
});

