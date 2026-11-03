import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SignedUrlPayload {
  attachmentId: string;
  userId: string;
  expiresAt: Date;
}

export interface GeneratedSignedUrl {
  url: string;
  expiresAt: Date;
}

@Injectable()
export class SignedUrlService {
  private readonly secret: string;
  private readonly publicApiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.getOrThrow<string>('ATTACHMENT_URL_SECRET');
    this.publicApiUrl = this.configService
      .getOrThrow<string>('PUBLIC_API_URL')
      .replace(/\/$/, '');
  }

  /**
   * Menghasilkan URL bertanda tangan HMAC-SHA256 yang berlaku selama 5 menit.
   * Format token: base64url(attachmentId.userId.expEpoch) + "." + base64url(HMAC)
   */
  generateUrl(
    attachmentId: string,
    userId: string,
    ttlSeconds = 5 * 60,
  ): GeneratedSignedUrl {
    const expiresAtEpoch = Math.floor(Date.now() / 1000) + ttlSeconds;
    const expiresAt = new Date(expiresAtEpoch * 1000);

    const payloadRaw = `${attachmentId}.${userId}.${expiresAtEpoch}`;
    const payloadPart = Buffer.from(payloadRaw, 'utf8').toString('base64url');

    const hmacBuffer = createHmac('sha256', this.secret)
      .update(payloadPart)
      .digest();
    const sigPart = hmacBuffer.toString('base64url');

    const token = `${payloadPart}.${sigPart}`;
    const url = `${this.publicApiUrl}/api/v1/attachments/${attachmentId}/content?token=${token}`;

    return {
      url,
      expiresAt,
    };
  }

  /**
   * Memverifikasi keabsahan dan masa berlaku signed URL token.
   * Menggunakan timingSafeEqual untuk mencegah serangan timing attack.
   */
  verifyToken(token: string): SignedUrlPayload | null {
    if (!token || typeof token !== 'string') {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return null;
    }

    const [payloadPart, sigPart] = parts;

    // 1. Verifikasi HMAC signature dengan timingSafeEqual (wajib cek panjang buffer dulu)
    const expectedHmac = createHmac('sha256', this.secret)
      .update(payloadPart)
      .digest();
    const providedHmac = Buffer.from(sigPart, 'base64url');

    if (
      expectedHmac.length !== providedHmac.length ||
      !timingSafeEqual(expectedHmac, providedHmac)
    ) {
      return null;
    }

    // 2. Parse payload
    let payloadRaw: string;
    try {
      payloadRaw = Buffer.from(payloadPart, 'base64url').toString('utf8');
    } catch {
      return null;
    }

    const payloadComponents = payloadRaw.split('.');
    if (payloadComponents.length !== 3) {
      return null;
    }

    const [attachmentId, userId, expEpochStr] = payloadComponents;
    const expEpoch = Number(expEpochStr);

    if (isNaN(expEpoch)) {
      return null;
    }

    // 3. Verifikasi masa berlaku (kedaluwarsa)
    const nowEpoch = Math.floor(Date.now() / 1000);
    if (nowEpoch > expEpoch) {
      return null;
    }

    return {
      attachmentId,
      userId,
      expiresAt: new Date(expEpoch * 1000),
    };
  }
}
