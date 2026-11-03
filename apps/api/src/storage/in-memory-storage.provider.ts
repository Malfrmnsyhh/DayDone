import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { DomainException } from '../common/errors/domain.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import type {
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
} from './storage.interface.js';

export interface StoredInMemoryFile {
  fileId: string;
  userId: string;
  name: string;
  mimeType: string;
  buffer: Buffer;
  trashed: boolean;
  createdAt: Date;
}

@Injectable()
export class InMemoryStorageProvider implements StorageProvider {
  private files = new Map<string, StoredInMemoryFile>();
  private userFolders = new Map<string, string>();

  // Flag simulasi error untuk kebutuhan pengujian
  private simulateReconnectRequired = new Set<string>();
  private simulateStorageFull = new Set<string>();
  private simulateUnavailable = new Set<string>();
  private simulateFolderTrashed = new Set<string>();
  private folderNotFoundCountdown = new Map<string, number>();

  // Counter untuk pengujian konkurensi folder
  public ensureFolderCallCount = 0;

  /**
   * Reset seluruh penyimpanan in-memory dan flag error.
   */
  public reset(): void {
    this.files.clear();
    this.userFolders.clear();
    this.simulateReconnectRequired.clear();
    this.simulateStorageFull.clear();
    this.simulateUnavailable.clear();
    this.simulateFolderTrashed.clear();
    this.folderNotFoundCountdown.clear();
    this.ensureFolderCallCount = 0;
  }

  public setSimulateReconnectRequired(userId: string, enabled: boolean): void {
    if (enabled) this.simulateReconnectRequired.add(userId);
    else this.simulateReconnectRequired.delete(userId);
  }

  public setSimulateStorageFull(userId: string, enabled: boolean): void {
    if (enabled) this.simulateStorageFull.add(userId);
    else this.simulateStorageFull.delete(userId);
  }

  public setSimulateUnavailable(userId: string, enabled: boolean): void {
    if (enabled) this.simulateUnavailable.add(userId);
    else this.simulateUnavailable.delete(userId);
  }

  public setSimulateFolderTrashed(userId: string, trashed: boolean): void {
    if (trashed) this.simulateFolderTrashed.add(userId);
    else this.simulateFolderTrashed.delete(userId);
  }

  public setSimulateFolderNotFound(userId: string, times: number): void {
    this.folderNotFoundCountdown.set(userId, times);
  }

  public getFilesByUser(userId: string): StoredInMemoryFile[] {
    return Array.from(this.files.values()).filter(
      (f) => f.userId === userId && !f.trashed,
    );
  }

  public getTrashedFilesByUser(userId: string): StoredInMemoryFile[] {
    return Array.from(this.files.values()).filter(
      (f) => f.userId === userId && f.trashed,
    );
  }

  public getFile(fileId: string): StoredInMemoryFile | undefined {
    return this.files.get(fileId);
  }

  async ensureAppFolder(userId: string): Promise<string> {
    this.ensureFolderCallCount++;
    this.checkSimulatedErrors(userId);

    const existing = this.userFolders.get(userId);
    if (existing) {
      if (this.simulateFolderTrashed.has(userId)) {
        // Simulasi folder berada di Trash: buat folder baru
        this.simulateFolderTrashed.delete(userId);
        this.userFolders.delete(userId);
      } else {
        return existing;
      }
    }

    const folderId = `fake-folder-${userId}-${randomUUID().slice(0, 8)}`;
    this.userFolders.set(userId, folderId);
    return folderId;
  }

  async upload(userId: string, input: StorageUploadInput): Promise<StorageUploadResult> {
    this.checkSimulatedErrors(userId);

    // Cek simulasi folder 404 (misal folder dihapus user di Google Drive)
    const countdown = this.folderNotFoundCountdown.get(userId) ?? 0;
    if (countdown > 0) {
      this.folderNotFoundCountdown.set(userId, countdown - 1);
      // Hapus folder yang tersimpan agar upload berikutnya memicu pembuatan ulang
      this.userFolders.delete(userId);
      const notFoundError = new Error('File not found: folder');
      ((notFoundError as unknown) as Record<string, unknown>).status = 404;
      throw notFoundError;
    }

    const fileId = `fake-drive-${randomUUID()}`;
    const file: StoredInMemoryFile = {
      fileId,
      userId,
      name: input.name,
      mimeType: input.mimeType,
      buffer: input.body,
      trashed: false,
      createdAt: new Date(),
    };

    this.files.set(fileId, file);

    return {
      fileId,
      sizeBytes: input.body.length,
    };
  }

  async download(userId: string, driveFileId: string): Promise<Readable> {
    this.checkSimulatedErrors(userId);

    const file = this.files.get(driveFileId);
    if (!file || file.trashed || file.userId !== userId) {
      throw new NotFoundException('File tidak ditemukan di Google Drive');
    }

    return Readable.from(file.buffer);
  }

  async trash(userId: string, driveFileId: string): Promise<void> {
    this.checkSimulatedErrors(userId);

    const file = this.files.get(driveFileId);
    if (file && file.userId === userId) {
      file.trashed = true;
    }
  }

  private checkSimulatedErrors(userId: string): void {
    if (this.simulateReconnectRequired.has(userId)) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'Akses Google Drive perlu dihubungkan ulang',
        ErrorCode.DRIVE_RECONNECT_REQUIRED,
      );
    }

    if (this.simulateStorageFull.has(userId)) {
      throw new DomainException(
        HttpStatus.INSUFFICIENT_STORAGE,
        'Penyimpanan Google Drive pengguna penuh',
        ErrorCode.DRIVE_STORAGE_FULL,
      );
    }

    if (this.simulateUnavailable.has(userId)) {
      throw new DomainException(
        HttpStatus.BAD_GATEWAY,
        'Layanan Google Drive sementara tidak tersedia',
        ErrorCode.DRIVE_UNAVAILABLE,
      );
    }
  }
}

