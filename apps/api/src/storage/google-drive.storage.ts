import {
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drive, type drive_v3 } from '@googleapis/drive';
import { OAuth2Client } from 'google-auth-library';
import { Readable } from 'node:stream';
import { EncryptionService } from '../common/crypto/encryption.service.js';
import { DomainException } from '../common/errors/domain.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { DriveStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
} from './storage.interface.js';

@Injectable()
export class GoogleDriveStorage implements StorageProvider {
  private readonly logger = new Logger(GoogleDriveStorage.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Mengambil instance client Google Drive v3 untuk user tertentu.
   * Mendekripsi refresh token Google dari database secara aman.
   */
  private async getDriveClient(userId: string): Promise<{
    drive: drive_v3.Drive;
    auth: OAuth2Client;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        driveStatus: true,
        googleRefreshToken: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }

    if (user.driveStatus === DriveStatus.NOT_CONNECTED) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'Izin akses Google Drive belum diberikan oleh pengguna',
        ErrorCode.DRIVE_NOT_CONNECTED,
      );
    }

    if (!user.googleRefreshToken) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'Akses Google Drive perlu dihubungkan ulang',
        ErrorCode.DRIVE_RECONNECT_REQUIRED,
      );
    }

    let decryptedRefreshToken: string;
    try {
      decryptedRefreshToken = this.encryptionService.decrypt(
        user.googleRefreshToken,
      );
    } catch {
      this.logger.warn(
        `Gagal mendekripsi Google refresh token milik user ${userId}, menandai NEEDS_RECONNECT`,
      );

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          driveStatus: DriveStatus.NEEDS_RECONNECT,
          googleRefreshToken: null,
        },
      });

      throw new DomainException(
        HttpStatus.CONFLICT,
        'Akses Google Drive perlu dihubungkan ulang',
        ErrorCode.DRIVE_RECONNECT_REQUIRED,
      );
    }

    const auth = new OAuth2Client({
      clientId: this.configService.getOrThrow<string>('GOOGLE_WEB_CLIENT_ID'),
      clientSecret: this.configService.getOrThrow<string>(
        'GOOGLE_WEB_CLIENT_SECRET',
      ),
    });

    auth.setCredentials({ refresh_token: decryptedRefreshToken });

    return {
      drive: drive({ version: 'v3', auth }),
      auth,
    };
  }

  /**
   * Helper retry backoff eksponensial untuk kode status 429 dan 5xx (maks. 2 kali).
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 2,
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        const error = err as Record<string, unknown>;
        const status = (error.status ??
          (error.response as Record<string, unknown>)?.status) as
          number | undefined;

        const isRetryable =
          status === 429 ||
          (typeof status === 'number' && status >= 500 && status < 600);

        if (isRetryable && attempt < maxRetries) {
          const delayMs = 200 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        throw err;
      }
    }

    throw new Error('Unreachable retry loop');
  }

  /**
   * Memetakan error Google Drive API ke DomainException DayDone yang aman.
   */
  private async handleDriveError(err: unknown, userId: string): Promise<never> {
    if (err instanceof DomainException || err instanceof NotFoundException) {
      throw err;
    }

    const error = err as Record<string, unknown>;
    const status = (error.status ??
      (error.response as Record<string, unknown>)?.status) as
      number | undefined;
    const message = typeof error.message === 'string' ? error.message : '';
    const responseData = (error.response as Record<string, unknown>)?.data as
      Record<string, unknown> | undefined;
    const errorData = (responseData?.error as Record<string, unknown>) || {};
    const errorCodeString =
      typeof errorData.error === 'string'
        ? errorData.error
        : typeof error.error === 'string'
          ? error.error
          : '';
    const errorDataMessage =
      typeof errorData.message === 'string' ? errorData.message : '';

    // 1. invalid_grant (token kedaluwarsa atau dicabut di Google)
    if (
      message.includes('invalid_grant') ||
      errorCodeString === 'invalid_grant' ||
      errorDataMessage.includes('invalid_grant')
    ) {
      this.logger.warn(
        `Google Drive invalid_grant untuk user ${userId}, menandai NEEDS_RECONNECT`,
      );

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          driveStatus: DriveStatus.NEEDS_RECONNECT,
          googleRefreshToken: null,
        },
      });

      throw new DomainException(
        HttpStatus.CONFLICT,
        'Akses Google Drive perlu dihubungkan ulang',
        ErrorCode.DRIVE_RECONNECT_REQUIRED,
      );
    }

    // 2. storageQuotaExceeded (Drive user penuh)
    const errorsList = errorData.errors;
    const isQuotaExceeded =
      status === 403 &&
      Array.isArray(errorsList) &&
      errorsList.some(
        (e: Record<string, unknown>) => e.reason === 'storageQuotaExceeded',
      );

    if (isQuotaExceeded || message.includes('storageQuotaExceeded')) {
      throw new DomainException(
        HttpStatus.INSUFFICIENT_STORAGE,
        'Kapasitas penyimpanan Google Drive pengguna telah penuh',
        ErrorCode.DRIVE_STORAGE_FULL,
      );
    }

    // 3. 404 Not Found
    if (status === 404) {
      throw new NotFoundException(
        'File atau folder tidak ditemukan di Google Drive',
      );
    }

    // 4. Default: 502 DRIVE_UNAVAILABLE
    this.logger.error(
      `Error Google Drive tidak terduga untuk user ${userId}: ${message}`,
    );
    throw new DomainException(
      HttpStatus.BAD_GATEWAY,
      'Layanan Google Drive sementara tidak tersedia',
      ErrorCode.DRIVE_UNAVAILABLE,
    );
  }

  /**
   * Memastikan folder aplikasi "DayDone" ada di Google Drive.
   * Dipanggil saat login bila driveGranted, dan sebelum unggah pertama bila driveFolderId null.
   * Aman dari race condition paralel dengan updateMany kondisional.
   */
  async ensureAppFolder(userId: string): Promise<string> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, driveFolderId: true },
      });

      if (!user) {
        throw new NotFoundException('Pengguna tidak ditemukan');
      }

      const { drive: driveClient } = await this.getDriveClient(userId);

      // Bila driveFolderId sudah ada di database, verifikasi folder tersebut masih ada dan TIDAK di Trash
      if (user.driveFolderId) {
        try {
          const checkRes = await this.executeWithRetry(() =>
            driveClient.files.get({
              fileId: user.driveFolderId!,
              fields: 'id,trashed',
            }),
          );

          if (!checkRes.data.trashed) {
            return user.driveFolderId;
          }

          this.logger.warn(
            `Folder Drive ${user.driveFolderId} milik user ${userId} berada di Trash, membuat folder baru`,
          );
        } catch (checkErr: unknown) {
          const status = (checkErr as Record<string, unknown>).status;
          if (status === 404) {
            this.logger.warn(
              `Folder Drive ${user.driveFolderId} milik user ${userId} tidak ditemukan (404), membuat folder baru`,
            );
          } else {
            throw checkErr;
          }
        }
      }

      // Buat folder "DayDone" di Drive pengguna
      const folderRes = await this.executeWithRetry(() =>
        driveClient.files.create({
          requestBody: {
            name: 'DayDone',
            mimeType: 'application/vnd.google-apps.folder',
          },
          fields: 'id',
        }),
      );

      const createdFolderId = folderRes.data.id;
      if (!createdFolderId) {
        throw new Error('Gagal mendapatkan id folder baru dari Google Drive');
      }

      // Update kondisional: hanya jika driveFolderId masih sama dengan nilai di awal (null atau id lama yang trashed/404)
      const updated = await this.prisma.user.updateMany({
        where: { id: userId, driveFolderId: user.driveFolderId },
        data: { driveFolderId: createdFolderId },
      });

      if (updated.count === 0) {
        // Request paralel lain sudah lebih dulu berhasil menyimpan folder
        // Pindahkan folder baru yang berlebih ke Trash (best-effort)
        try {
          await driveClient.files.update({
            fileId: createdFolderId,
            requestBody: { trashed: true },
          });
        } catch {
          // Abaikan kegagalan trash folder ekstra
        }

        const freshUser = await this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { driveFolderId: true },
        });

        return freshUser.driveFolderId!;
      }

      return createdFolderId;
    } catch (err: unknown) {
      return this.handleDriveError(err, userId);
    }
  }

  /**
   * Mengunggah file ke Google Drive ke dalam folder DayDone pengguna.
   * Bila folder DayDone mendapat 404 (dihapus pengguna di Google Drive),
   * otomatis dibuat ulang dan unggah diulangi sekali.
   */
  async upload(
    userId: string,
    input: StorageUploadInput,
  ): Promise<StorageUploadResult> {
    try {
      let folderId = await this.ensureAppFolder(userId);
      const { drive: driveClient } = await this.getDriveClient(userId);

      const doUpload = async (targetFolderId: string) => {
        return this.executeWithRetry(() =>
          driveClient.files.create({
            requestBody: {
              name: input.name,
              parents: [targetFolderId],
            },
            media: {
              mimeType: input.mimeType,
              body: Readable.from(input.body),
            },
            fields: 'id,size',
          }),
        );
      };

      let res;
      try {
        res = await doUpload(folderId);
      } catch (uploadErr: unknown) {
        const error = uploadErr as Record<string, unknown>;
        const status = (error.status ??
          (error.response as Record<string, unknown>)?.status) as
          number | undefined;

        // Folder 404 di Drive -> buat ulang folder lalu ulangi sekali
        if (status === 404) {
          this.logger.warn(
            `Folder Drive ${folderId} hilang (404), membuat ulang untuk user ${userId}`,
          );
          await this.prisma.user.update({
            where: { id: userId },
            data: { driveFolderId: null },
          });

          folderId = await this.ensureAppFolder(userId);
          res = await doUpload(folderId);
        } else {
          throw uploadErr;
        }
      }

      const fileId = res.data.id;
      if (!fileId) {
        throw new Error('Google Drive tidak mengembalikan file id');
      }

      const sizeBytes = Number(res.data.size) || input.body.length;

      return {
        fileId,
        sizeBytes,
      };
    } catch (err: unknown) {
      return this.handleDriveError(err, userId);
    }
  }

  /**
   * Mengunduh file dari Drive sebagai stream.
   */
  async download(userId: string, driveFileId: string): Promise<Readable> {
    try {
      const { drive: driveClient } = await this.getDriveClient(userId);

      const res = await this.executeWithRetry(() =>
        driveClient.files.get(
          { fileId: driveFileId, alt: 'media' },
          { responseType: 'stream' },
        ),
      );

      return res.data as unknown as Readable;
    } catch (err: unknown) {
      return this.handleDriveError(err, userId);
    }
  }

  /**
   * Memindahkan file ke Trash Google Drive (soft-delete).
   */
  async trash(userId: string, driveFileId: string): Promise<void> {
    try {
      const { drive: driveClient } = await this.getDriveClient(userId);

      await this.executeWithRetry(() =>
        driveClient.files.update({
          fileId: driveFileId,
          requestBody: { trashed: true },
        }),
      );
    } catch (err: unknown) {
      const error = err as Record<string, unknown>;
      const status = (error.status ??
        (error.response as Record<string, unknown>)?.status) as
        number | undefined;

      // Bila file sudah 404 di Drive, tidak perlu lempar error
      if (status === 404) {
        return;
      }

      const trashErrorMsg =
        typeof error.message === 'string' ? error.message : '';
      this.logger.warn(
        `Gagal memindahkan file ${driveFileId} ke trash di Drive: ${trashErrorMsg}`,
      );
      // Hapus/trash file berstatus best-effort, tidak menggagalkan alur utama
    }
  }
}
