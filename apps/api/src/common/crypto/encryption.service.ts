import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const keyBase64 = this.configService.getOrThrow<string>(
      'TOKEN_ENCRYPTION_KEY',
    );
    this.key = Buffer.from(keyBase64, 'base64');

    if (this.key.length !== 32) {
      throw new Error('Kunci enkripsi harus berukuran tepat 32 byte');
    }
  }

  /**
   * Mengenkripsi string menggunakan algoritma AES-256-GCM.
   * Format keluaran: v1.<iv>.<authTag>.<ciphertext> (base64url).
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `v1.${iv.toString('base64url')}.${authTag.toString('base64url')}.${ciphertext.toString('base64url')}`;
  }

  /**
   * Mendekripsi string berformat v1.<iv>.<authTag>.<ciphertext> menggunakan kunci simetris.
   * Melempar error bila format tidak valid, ciphertext termodifikasi, atau kunci salah.
   */
  decrypt(encryptedText: string): string {
    const parts = encryptedText.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new Error('Format cipher text tidak valid');
    }

    const [, ivB64, tagB64, cipherB64] = parts;
    if (!ivB64 || !tagB64 || !cipherB64) {
      throw new Error('Bagian cipher text tidak lengkap');
    }

    const iv = Buffer.from(ivB64, 'base64url');
    const authTag = Buffer.from(tagB64, 'base64url');
    const ciphertext = Buffer.from(cipherB64, 'base64url');

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
