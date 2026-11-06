import { describe, expect, beforeEach, it } from 'vitest';
import { InMemoryStorageProvider } from './in-memory-storage.provider.js';
import { DomainException } from '../common/errors/domain.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';

describe('InMemoryStorageProvider', () => {
  let provider: InMemoryStorageProvider;

  beforeEach(() => {
    provider = new InMemoryStorageProvider();
  });

  it('berhasil membuat dan mengembalikan folder pengguna', async () => {
    const folderId1 = await provider.ensureAppFolder('user-1');
    expect(folderId1).toContain('fake-folder-user-1');

    const folderId2 = await provider.ensureAppFolder('user-1');
    expect(folderId2).toBe(folderId1);
  });

  it('mensimulasikan folder yang ada di trash: membuat folder baru saat ensureAppFolder dipanggil kembali', async () => {
    const folder1 = await provider.ensureAppFolder('user-1');
    provider.setSimulateFolderTrashed('user-1', true);
    const folder2 = await provider.ensureAppFolder('user-1');
    expect(folder2).not.toBe(folder1);
    expect(folder2).toContain('fake-folder-user-1');
  });

  it('berhasil mengunggah file dan mengalirkannya kembali', async () => {
    const content = Buffer.from('hello-image-data');
    const result = await provider.upload('user-1', {
      name: '2026-11-03_test.jpg',
      mimeType: 'image/jpeg',
      body: content,
    });

    expect(result.fileId).toBeDefined();
    expect(result.sizeBytes).toBe(content.length);

    const stream = await provider.download('user-1', result.fileId);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks)).toEqual(content);
  });

  it('memindahkan file ke trash dan menolak download setelah di-trash', async () => {
    const result = await provider.upload('user-1', {
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      body: Buffer.from('content'),
    });

    await provider.trash('user-1', result.fileId);

    const files = provider.getFilesByUser('user-1');
    expect(files).toHaveLength(0);

    const trashed = provider.getTrashedFilesByUser('user-1');
    expect(trashed).toHaveLength(1);

    await expect(provider.download('user-1', result.fileId)).rejects.toThrow();
  });

  it('mensimulasikan DRIVE_RECONNECT_REQUIRED saat flag aktif', async () => {
    provider.setSimulateReconnectRequired('user-1', true);

    await expect(provider.ensureAppFolder('user-1')).rejects.toThrow(
      DomainException,
    );
    try {
      await provider.ensureAppFolder('user-1');
    } catch (err: any) {
      expect(err.code).toBe(ErrorCode.DRIVE_RECONNECT_REQUIRED);
    }
  });

  it('mensimulasikan DRIVE_STORAGE_FULL saat flag aktif', async () => {
    provider.setSimulateStorageFull('user-1', true);

    await expect(
      provider.upload('user-1', {
        name: 'test.jpg',
        mimeType: 'image/jpeg',
        body: Buffer.from('abc'),
      }),
    ).rejects.toThrow(DomainException);
  });
});
