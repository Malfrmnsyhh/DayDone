import { describe, expect, it, vi } from 'vitest';
import {
  ErrorCode,
  MAX_ATTACHMENTS,
  MAX_FILE_SIZE_BYTES,
  type Attachment,
} from '@daydone/shared';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import { ApiError } from './api-client';
import {
  deriveUploadFileName,
  getAttachmentUploadErrorMessage,
  resolveImageMimeType,
  runSequentialUploadQueue,
  type UploadQueueItem,
  validateSelectedImages,
} from './attachments-api';

describe('attachments-api helpers (mobile)', () => {
  describe('resolveImageMimeType', () => {
    it('menerima MIME JPEG, PNG, WebP dan menormalisasi image/jpg', () => {
      expect(resolveImageMimeType('image/jpeg')).toBe('image/jpeg');
      expect(resolveImageMimeType('image/jpg')).toBe('image/jpeg');
      expect(resolveImageMimeType('IMAGE/PNG')).toBe('image/png');
      expect(resolveImageMimeType('image/webp')).toBe('image/webp');
    });

    it('jatuh kembali ke ekstensi fileName atau URI bila mimeType Android kosong', () => {
      expect(resolveImageMimeType(null, 'IMG_001.JPG')).toBe('image/jpeg');
      expect(resolveImageMimeType(undefined, null, 'file:///cache/photo.png')).toBe(
        'image/png',
      );
      expect(
        resolveImageMimeType('', null, 'file:///cache/doc.webp?v=1'),
      ).toBe('image/webp');
    });

    it('menolak format yang tidak didukung', () => {
      expect(resolveImageMimeType('image/gif')).toBeNull();
      expect(resolveImageMimeType('application/pdf')).toBeNull();
      expect(resolveImageMimeType(null, 'animasi.gif')).toBeNull();
      expect(resolveImageMimeType(null, 'foto.heic')).toBeNull();
    });
  });

  describe('deriveUploadFileName', () => {
    it('mengutamakan fileName, lalu basename URI, lalu nama fallback sesuai MIME', () => {
      expect(
        deriveUploadFileName(
          { uri: 'file:///a/b.jpg', fileName: 'kegiatan.jpg' },
          'image/jpeg',
          0,
        ),
      ).toBe('kegiatan.jpg');

      expect(
        deriveUploadFileName({ uri: 'file:///cache/IMG_99.png' }, 'image/png', 0),
      ).toBe('IMG_99.png');

      expect(
        deriveUploadFileName({ uri: 'content://media/external/1234' }, 'image/webp', 2),
      ).toBe('foto-3.webp');
    });
  });

  describe('validateSelectedImages', () => {
    it('menerima file valid dan membatasi sesuai sisa kuota', () => {
      const files = [
        { uri: 'file:///1.jpg', fileName: '1.jpg', mimeType: 'image/jpeg', fileSize: 500_000 },
        { uri: 'file:///2.png', fileName: '2.png', mimeType: null, fileSize: 800_000 },
        { uri: 'file:///3.webp', fileName: '3.webp', mimeType: 'image/webp', fileSize: 100_000 },
      ];

      // Sudah ada 3 foto -> sisa kuota 2 foto
      const result = validateSelectedImages(files, 3);
      expect(result.remainingQuota).toBe(2);
      expect(result.accepted).toHaveLength(2);
      expect(result.accepted[0].type).toBe('image/jpeg');
      expect(result.accepted[1].type).toBe('image/png');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('2 foto');
    });

    it('menolak file > 10 MB dan format tidak didukung', () => {
      const result = validateSelectedImages(
        [
          {
            uri: 'file:///big.jpg',
            fileName: 'big.jpg',
            mimeType: 'image/jpeg',
            fileSize: MAX_FILE_SIZE_BYTES + 1,
          },
          {
            uri: 'file:///bad.gif',
            fileName: 'bad.gif',
            mimeType: 'image/gif',
            fileSize: 1000,
          },
        ],
        0,
      );

      expect(result.accepted).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('10 MB');
      expect(result.errors[1]).toContain('Format tidak didukung');
    });

    it('langsung menolak semua bila kuota 5/5 sudah penuh', () => {
      const result = validateSelectedImages(
        [{ uri: 'file:///1.jpg', fileName: '1.jpg', mimeType: 'image/jpeg' }],
        MAX_ATTACHMENTS,
      );

      expect(result.remainingQuota).toBe(0);
      expect(result.accepted).toHaveLength(0);
      expect(result.errors[0]).toContain(String(MAX_ATTACHMENTS));
    });
  });

  describe('getAttachmentUploadErrorMessage', () => {
    it('memetakan kode domain dan status HTTP ke pesan bahasa Indonesia', () => {
      expect(
        getAttachmentUploadErrorMessage(
          new ApiError({
            statusCode: 409,
            code: ErrorCode.ATTACHMENT_LIMIT_REACHED,
          }),
        ),
      ).toContain('5');

      expect(
        getAttachmentUploadErrorMessage(
          new ApiError({
            statusCode: 409,
            code: ErrorCode.DRIVE_RECONNECT_REQUIRED,
          }),
        ),
      ).toContain('Google Drive');

      expect(
        getAttachmentUploadErrorMessage(
          new ApiError({ statusCode: 413, message: 'Payload Too Large' }),
        ),
      ).toContain('10 MB');

      expect(
        getAttachmentUploadErrorMessage(
          new ApiError({ statusCode: 415, message: 'Unsupported' }),
        ),
      ).toContain('Format');
    });
  });

  describe('runSequentialUploadQueue', () => {
    const makeItem = (id: string): UploadQueueItem => ({
      id,
      fileName: `${id}.jpg`,
      file: { uri: `file:///${id}.jpg`, name: `${id}.jpg`, type: 'image/jpeg' },
      status: 'pending',
      progress: 0,
    });

    const dummyAttachment: Attachment = {
      id: 'att-1',
      fileName: '1.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1234,
      width: 800,
      height: 600,
      position: 0,
      url: 'http://localhost:3000/api/v1/attachments/att-1/content?token=abc',
      urlExpiresAt: '2026-11-28T10:00:00.000Z',
    };

    it('mengunggah file secara berurutan (sequential) dan memanggil onAnySuccess', async () => {
      const events: string[] = [];
      const onItemUpdate = vi.fn();
      const onAnySuccess = vi.fn();

      const summary = await runSequentialUploadQueue({
        items: [makeItem('a'), makeItem('b')],
        uploadFn: async (file, onProgress) => {
          events.push(`start:${file.name}`);
          onProgress(50);
          await new Promise((r) => setTimeout(r, 5));
          events.push(`end:${file.name}`);
          return dummyAttachment;
        },
        onItemUpdate,
        onAnySuccess,
      });

      expect(summary).toEqual({ succeededCount: 2, failedCount: 0 });
      expect(events).toEqual([
        'start:a.jpg',
        'end:a.jpg',
        'start:b.jpg',
        'end:b.jpg',
      ]);
      expect(onAnySuccess).toHaveBeenCalledTimes(1);
    });

    it('menghentikan antrean berikutnya secara cepat saat error fatal DRIVE_RECONNECT_REQUIRED', async () => {
      const uploadFn = vi.fn().mockRejectedValueOnce(
        new ApiError({
          statusCode: 409,
          code: ErrorCode.DRIVE_RECONNECT_REQUIRED,
        }),
      );
      const updates: Array<{ id: string; status?: string }> = [];

      const summary = await runSequentialUploadQueue({
        items: [makeItem('a'), makeItem('b')],
        uploadFn,
        onItemUpdate: (id, patch) => {
          if (patch.status) updates.push({ id, status: patch.status });
        },
      });

      expect(summary).toEqual({ succeededCount: 0, failedCount: 2 });
      expect(uploadFn).toHaveBeenCalledTimes(1);
      expect(updates).toEqual([
        { id: 'a', status: 'uploading' },
        { id: 'a', status: 'error' },
        { id: 'b', status: 'error' },
      ]);
    });
  });
});
