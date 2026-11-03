import { HttpStatus } from '@nestjs/common';
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import { DomainException } from '../common/errors/domain.exception.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { ImageProcessorService } from './image-processor.service.js';

describe('ImageProcessorService', () => {
  let service: ImageProcessorService;

  beforeEach(() => {
    service = new ImageProcessorService();
  });

  it('me-resize gambar 4000x3000 menjadi 2048x1536 (fit inside, aspek rasio terjaga)', async () => {
    // Buat buffer gambar 4000x3000
    const rawImage = await sharp({
      create: {
        width: 4000,
        height: 3000,
        channels: 3,
        background: { r: 100, g: 150, b: 200 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await service.process(rawImage);

    expect(result.width).toBe(2048);
    expect(result.height).toBe(1536);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it('tidak memperbesar gambar yang sudah lebih kecil dari 2048 (withoutEnlargement)', async () => {
    const rawImage = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await service.process(rawImage);

    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it('menghapus metadata EXIF termasuk koordinat GPS demi privasi', async () => {
    // Buat gambar dengan metadata EXIF tiruan
    const imageWithExif = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 0, g: 255, b: 0 },
      },
    })
      .jpeg()
      .withExif({
        IFD0: {
          Make: 'DayDoneCamera',
          Model: 'TestModel',
        },
      })
      .toBuffer();

    // Verifikasi bahwa gambar input memang punya exif
    const inputMeta = await sharp(imageWithExif).metadata();
    expect(inputMeta.exif).toBeDefined();

    // Jalankan pemrosesan
    const result = await service.process(imageWithExif);

    // Verifikasi bahwa output TIDAK lagi memiliki exif
    const outputMeta = await sharp(result.buffer).metadata();
    expect(outputMeta.exif).toBeUndefined();
  });

  it('mempertahankan format PNG bila gambar memiliki channel alpha (transparansi)', async () => {
    const transparentPng = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();

    const result = await service.process(transparentPng);

    expect(result.mimeType).toBe('image/png');
  });

  it('menolak file teks atau data corrupt dengan 415 UNSUPPORTED_FILE_TYPE', async () => {
    const fakeTextFile = Buffer.from('This is not an image at all!');

    try {
      await service.process(fakeTextFile);
      expect.unreachable();
    } catch (err: any) {
      expect(err).toBeInstanceOf(DomainException);
      expect(err.getStatus()).toBe(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
      expect(err.code).toBe(ErrorCode.UNSUPPORTED_FILE_TYPE);
    }
  });

  it('menerapkan orientasi auto-rotate dari EXIF', async () => {
    // Buat gambar dengan orientation EXIF 6 (rotasi 90 derajat searah jarum jam)
    const orientedImage = await sharp({
      create: {
        width: 600,
        height: 400,
        channels: 3,
        background: { r: 120, g: 120, b: 120 },
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const result = await service.process(orientedImage);

    // Karena di-rotate 90 derajat, lebar dan tingginya bertukar: 600x400 -> 400x600
    expect(result.width).toBe(400);
    expect(result.height).toBe(600);
  });
});
