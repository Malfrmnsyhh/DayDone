import { HttpStatus, Injectable } from '@nestjs/common';
import pLimit from 'p-limit';
import sharp from 'sharp';
import { DomainException } from '../common/errors/domain.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';

export interface ProcessedImageResult {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

@Injectable()
export class ImageProcessorService {
  // Batasi konkurensi pemrosesan gambar maksimum 2 proses sekaligus untuk menjaga RAM instance kecil
  private readonly limiter = pLimit(2);

  /**
   * Memproses buffer gambar:
   * 1. Dekode dan validasi format (JPEG, PNG, WebP)
   * 2. Auto-rotate berdasarkan EXIF orientation
   * 3. Resize fit inside maksimal 2048x2048 px (tanpa memperbesar gambar kecil)
   * 4. Strip seluruh metadata EXIF (termasuk koordinat GPS)
   * 5. Format ulang ke JPEG kualitas 82 (mozjpeg) atau pertahankan PNG bila memiliki transparansi (alpha)
   */
  async process(buffer: Buffer): Promise<ProcessedImageResult> {
    return this.limiter(async () => {
      try {
        const image = sharp(buffer, { failOn: 'error' });
        const metadata = await image.metadata();

        if (!metadata.format) {
          throw new DomainException(
            HttpStatus.UNSUPPORTED_MEDIA_TYPE,
            'Format file tidak didukung atau file gambar rusak',
            ErrorCode.UNSUPPORTED_FILE_TYPE,
          );
        }

        const allowedFormats = ['jpeg', 'jpg', 'png', 'webp'];
        if (!allowedFormats.includes(metadata.format)) {
          throw new DomainException(
            HttpStatus.UNSUPPORTED_MEDIA_TYPE,
            `Format gambar '${metadata.format}' tidak didukung. Harap gunakan format JPEG, PNG, atau WebP`,
            ErrorCode.UNSUPPORTED_FILE_TYPE,
          );
        }

        // Terapkan auto-rotate sesuai orientasi EXIF
        image.rotate();

        // Resize batas maksimal 2048x2048 px fit inside
        image.resize({
          width: 2048,
          height: 2048,
          fit: 'inside',
          withoutEnlargement: true,
        });

        // Tentukan output format:
        // PNG hanya dipertahankan sebagai PNG bila benar-benar memiliki piksel transparan (!isOpaque).
        // PNG opak atau format lain dikonversi menjadi JPEG dengan optimasi mozjpeg kualitas 82.
        let outputMimeType: string;
        let isTransparentPng = false;

        if (metadata.format === 'png') {
          const stats = await image.stats();
          if (!stats.isOpaque) {
            isTransparentPng = true;
          }
        }

        if (isTransparentPng) {
          image.png();
          outputMimeType = 'image/png';
        } else {
          image.jpeg({ quality: 82, mozjpeg: true });
          outputMimeType = 'image/jpeg';
        }

        // Sharp secara default TIDAK memanggil .withMetadata(), sehingga EXIF (GPS, kamera, tanggal)
        // terhapus secara otomatis dan aman demi privasi pengguna.
        const outputBuffer = await image.toBuffer();
        const outputMetadata = await sharp(outputBuffer).metadata();

        return {
          buffer: outputBuffer,
          mimeType: outputMimeType,
          width: outputMetadata.width ?? 0,
          height: outputMetadata.height ?? 0,
          sizeBytes: outputBuffer.length,
        };
      } catch (err: unknown) {
        if (err instanceof DomainException) {
          throw err;
        }

        throw new DomainException(
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          'File bukan gambar yang valid atau gagal didekode oleh sistem',
          ErrorCode.UNSUPPORTED_FILE_TYPE,
        );
      }
    });
  }
}
