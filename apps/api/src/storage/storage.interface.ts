import type { Readable } from 'node:stream';

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface StorageUploadInput {
  name: string;
  mimeType: string;
  body: Buffer;
}

export interface StorageUploadResult {
  fileId: string;
  sizeBytes: number;
}

export interface StorageProvider {
  /**
   * Memastikan folder aplikasi "DayDone" ada di root Drive pengguna.
   * Mengembalikan id folder Drive yang tersimpan.
   */
  ensureAppFolder(userId: string): Promise<string>;

  /**
   * Mengunggah file ke dalam folder DayDone pengguna di Drive.
   */
  upload(
    userId: string,
    input: StorageUploadInput,
  ): Promise<StorageUploadResult>;

  /**
   * Mengambil file dari Drive sebagai Node.js Readable stream untuk streaming HTTP.
   */
  download(userId: string, driveFileId: string): Promise<Readable>;

  /**
   * Memindahkan file ke Trash Google Drive (soft-delete).
   */
  trash(userId: string, driveFileId: string): Promise<void>;
}
