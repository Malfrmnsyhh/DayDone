import {
  BadRequestException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { DomainException } from '../common/errors/domain.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { DriveStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../storage/storage.interface.js';
import type {
  AttachmentResponse,
  AttachmentUrlResponse,
} from './dto/attachment.types.js';
import {
  ImageProcessorService,
  type ProcessedImageResult,
} from './image-processor.service.js';
import { SignedUrlService } from './signed-url.service.js';

export interface UploadedFileDto {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imageProcessor: ImageProcessorService,
    private readonly signedUrlService: SignedUrlService,
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
  ) {}

  /**
   * Mengunggah 1–5 file foto ke logbook tertentu:
   * Alur all-or-nothing:
   * a. Cek logbook dan driveStatus di awal (NOT_CONNECTED / NEEDS_RECONNECT)
   * b. Cek batas jumlah lampiran (existing + new <= 5)
   * c. Proses SEMUA file dengan ImageProcessor (bila gagal -> 415 tanpa menyentuh Drive)
   * d. Unggah ke Google Drive (bila gagal -> kompensasi trash semua file yang sudah terunggah)
   * e. Simpan ke database dalam satu transaksi (bila gagal -> trash semua file)
   */
  async uploadAttachments(
    userId: string,
    logId: string,
    files: UploadedFileDto[],
  ): Promise<AttachmentResponse[]> {
    // 1. Verifikasi kepemilikan logbook
    const log = await this.prisma.logEntry.findFirst({
      where: { id: logId, userId },
      include: {
        attachments: {
          orderBy: { position: 'asc' },
        },
        user: true,
      },
    });

    if (!log) {
      throw new NotFoundException('Logbook tidak ditemukan');
    }

    // 2. Cek driveStatus di awal sebelum memproses file
    const user = log.user;
    if (user.driveStatus === DriveStatus.NOT_CONNECTED) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'Izin akses Google Drive belum diberikan oleh pengguna',
        ErrorCode.DRIVE_NOT_CONNECTED,
      );
    }

    if (
      user.driveStatus === DriveStatus.NEEDS_RECONNECT ||
      !user.googleRefreshToken
    ) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'Akses Google Drive perlu dihubungkan ulang',
        ErrorCode.DRIVE_RECONNECT_REQUIRED,
      );
    }

    // 3. Validasi keberadaan file dan batas jumlah lampiran (maksimal 5)
    if (!files || files.length === 0) {
      throw new BadRequestException('Tidak ada file gambar yang diunggah');
    }

    const existingCount = log.attachments.length;
    if (existingCount + files.length > 5) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        `Jumlah lampiran melebihi batas. Logbook sudah memiliki ${existingCount} lampiran, maksimal 5 lampiran per logbook`,
        ErrorCode.ATTACHMENT_LIMIT_REACHED,
      );
    }

    // 4. Proses SEMUA file dengan ImageProcessor (tanpa menyentuh Drive bila ada yang gagal)
    const processedFiles: ProcessedImageResult[] = [];
    for (const file of files) {
      const processed = await this.imageProcessor.process(file.buffer);
      processedFiles.push(processed);
    }

    // 5. Unggah ke Google Drive dengan pelacakan kompensasi (all-or-nothing)
    const dateStr = log.date.toISOString().slice(0, 10);
    const maxPosition = log.attachments.reduce(
      (max, a) => Math.max(max, a.position),
      -1,
    );
    let nextPosition = maxPosition + 1;

    interface UploadedRecord {
      id: string;
      fileId: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      width: number;
      height: number;
      position: number;
    }

    const uploadedRecords: UploadedRecord[] = [];

    try {
      for (const processed of processedFiles) {
        const attachmentId = randomUUID();
        const ext = processed.mimeType === 'image/png' ? 'png' : 'jpg';
        const fileName = `${dateStr}_${attachmentId.slice(0, 8)}.${ext}`;

        const uploadResult = await this.storageProvider.upload(userId, {
          name: fileName,
          mimeType: processed.mimeType,
          body: processed.buffer,
        });

        uploadedRecords.push({
          id: attachmentId,
          fileId: uploadResult.fileId,
          fileName,
          mimeType: processed.mimeType,
          sizeBytes: uploadResult.sizeBytes,
          width: processed.width,
          height: processed.height,
          position: nextPosition++,
        });
      }
    } catch (uploadError: unknown) {
      // Kompensasi: pindahkan seluruh file yang sudah terunggah ke Trash
      this.logger.warn(
        `Unggah lampiran gagal di tengah jalan untuk log ${logId}, membatalkan ${uploadedRecords.length} file di Drive`,
      );
      await Promise.allSettled(
        uploadedRecords.map((r) =>
          this.storageProvider.trash(userId, r.fileId),
        ),
      );
      throw uploadError;
    }

    // 6. Simpan seluruh lampiran ke database dalam transaksi Prisma dengan row-locking
    try {
      const createdAttachments = await this.prisma.$transaction(async (tx) => {
        // Kunci baris logbook secara eksklusif agar request upload paralel menunggu giliran
        await tx.$queryRaw`SELECT id FROM "log_entries" WHERE id = ${logId}::uuid AND "userId" = ${userId}::uuid FOR UPDATE;`;

        // Cek ulang jumlah lampiran saat ini di bawah lock transaksi
        const currentCount = await tx.attachment.count({
          where: { logEntryId: logId },
        });

        if (currentCount + uploadedRecords.length > 5) {
          throw new DomainException(
            HttpStatus.CONFLICT,
            `Jumlah lampiran melebihi batas. Logbook sudah memiliki ${currentCount} lampiran, maksimal 5 lampiran per logbook`,
            ErrorCode.ATTACHMENT_LIMIT_REACHED,
          );
        }

        // Tentukan posisi urutan terbaru
        const existingAttachments = await tx.attachment.findMany({
          where: { logEntryId: logId },
          select: { position: true },
          orderBy: { position: 'asc' },
        });
        const currentMax = existingAttachments.reduce(
          (max, a) => Math.max(max, a.position),
          -1,
        );
        let currPos = currentMax + 1;

        const results = [];
        for (const rec of uploadedRecords) {
          const created = await tx.attachment.create({
            data: {
              id: rec.id,
              logEntryId: logId,
              driveFileId: rec.fileId,
              fileName: rec.fileName,
              mimeType: rec.mimeType,
              sizeBytes: rec.sizeBytes,
              width: rec.width,
              height: rec.height,
              position: currPos++,
            },
          });
          results.push(created);
        }

        return results;
      });

      return createdAttachments.map((att) => {
        const { url, expiresAt } = this.signedUrlService.generateUrl(
          att.id,
          userId,
        );
        return {
          id: att.id,
          fileName: att.fileName,
          mimeType: att.mimeType,
          sizeBytes: att.sizeBytes,
          width: att.width,
          height: att.height,
          position: att.position,
          url,
          urlExpiresAt: expiresAt.toISOString(),
        };
      });
    } catch (dbError: unknown) {
      // Kompensasi: jika penyimpanan DB gagal atau kuota terlampaui, trash semua file yang sudah terunggah
      this.logger.error(
        `Insert DB lampiran gagal untuk log ${logId}, melakukan kompensasi trash file di Drive`,
      );
      await Promise.allSettled(
        uploadedRecords.map((r) =>
          this.storageProvider.trash(userId, r.fileId),
        ),
      );
      throw dbError;
    }
  }

  /**
   * Menghasilkan signed URL baru berumur 5 menit untuk lampiran tertentu.
   */
  async getAttachmentUrl(
    userId: string,
    attachmentId: string,
  ): Promise<AttachmentUrlResponse> {
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        logEntry: { userId },
      },
      include: {
        logEntry: {
          include: { user: true },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Lampiran tidak ditemukan');
    }

    if (attachment.logEntry.user.driveStatus === DriveStatus.NEEDS_RECONNECT) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'Akses Google Drive perlu dihubungkan ulang',
        ErrorCode.DRIVE_RECONNECT_REQUIRED,
      );
    }

    const { url, expiresAt } = this.signedUrlService.generateUrl(
      attachmentId,
      userId,
    );

    return {
      url,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Mengalirkan isi gambar lampiran dari Google Drive berdasarkan signed URL token.
   */
  async getAttachmentContent(
    attachmentId: string,
    token: string,
  ): Promise<{ stream: Readable; mimeType: string; sizeBytes: number }> {
    const payload = this.signedUrlService.verifyToken(token);
    if (!payload || payload.attachmentId !== attachmentId) {
      throw new UnauthorizedException(
        'Token akses lampiran tidak valid atau telah kedaluwarsa',
      );
    }

    // Verifikasi di database: lampiran masih ada dan milik userId di token
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        logEntry: { userId: payload.userId },
      },
      include: {
        logEntry: {
          include: { user: true },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Lampiran tidak ditemukan');
    }

    if (attachment.logEntry.user.driveStatus === DriveStatus.NEEDS_RECONNECT) {
      throw new DomainException(
        HttpStatus.CONFLICT,
        'Akses Google Drive perlu dihubungkan ulang',
        ErrorCode.DRIVE_RECONNECT_REQUIRED,
      );
    }

    const stream = await this.storageProvider.download(
      payload.userId,
      attachment.driveFileId,
    );

    return {
      stream,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    };
  }

  /**
   * Menghapus lampiran tunggal, merapatkan ulang nomor posisi, dan memindahkan file ke Trash Drive.
   */
  async deleteAttachment(userId: string, attachmentId: string): Promise<void> {
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        logEntry: { userId },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Lampiran tidak ditemukan');
    }

    // Hapus dan rapatkan ulang posisi dalam transaksi
    await this.prisma.$transaction(async (tx) => {
      await tx.attachment.delete({
        where: { id: attachmentId },
      });

      const remainingAttachments = await tx.attachment.findMany({
        where: { logEntryId: attachment.logEntryId },
        orderBy: { position: 'asc' },
      });

      for (let i = 0; i < remainingAttachments.length; i++) {
        if (remainingAttachments[i].position !== i) {
          await tx.attachment.update({
            where: { id: remainingAttachments[i].id },
            data: { position: i },
          });
        }
      }
    });

    // Pindahkan ke Trash di Drive (best-effort)
    try {
      await this.storageProvider.trash(userId, attachment.driveFileId);
    } catch (err: unknown) {
      this.logger.warn(
        `Gagal memindahkan file lampiran ${attachment.driveFileId} ke trash: ${String((err as Error)?.message)}`,
      );
    }
  }

  /**
   * Helper untuk LogsService: memindahkan seluruh file lampiran milik logbook yang dihapus ke Trash.
   */
  async trashAttachmentsForLog(
    userId: string,
    attachments: Array<{ driveFileId: string }>,
  ): Promise<void> {
    await Promise.allSettled(
      attachments.map((att) =>
        this.storageProvider.trash(userId, att.driveFileId),
      ),
    );
  }

  /**
   * Helper untuk mapper logbook: membuat URL bertanda tangan untuk lampiran.
   */
  buildAttachmentUrl(
    attachmentId: string,
    userId: string,
  ): { url: string; urlExpiresAt: string } {
    const { url, expiresAt } = this.signedUrlService.generateUrl(
      attachmentId,
      userId,
    );
    return {
      url,
      urlExpiresAt: expiresAt.toISOString(),
    };
  }
}
