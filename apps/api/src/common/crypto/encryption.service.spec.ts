import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { EncryptionService } from './encryption.service.js';

describe('EncryptionService', () => {
  const keyA = Buffer.alloc(32, 'a').toString('base64');
  const keyB = Buffer.alloc(32, 'b').toString('base64');

  const createService = (key: string) => {
    const mockConfig = {
      getOrThrow: () => key,
    } as unknown as ConfigService;
    return new EncryptionService(mockConfig);
  };

  const service = createService(keyA);

  it('berhasil melakukan enkripsi dan dekripsi bolak-balik (roundtrip)', () => {
    const secretText = 'google-refresh-token-1/XYZ1234567890';
    const encrypted = service.encrypt(secretText);

    expect(encrypted.startsWith('v1.')).toBe(true);
    expect(encrypted.split('.')).toHaveLength(4);

    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(secretText);
  });

  it('menghasilkan IV dan ciphertext berbeda setiap enkripsi (non-deterministik)', () => {
    const text = 'test-token';
    const enc1 = service.encrypt(text);
    const enc2 = service.encrypt(text);

    expect(enc1).not.toBe(enc2);
    expect(service.decrypt(enc1)).toBe(text);
    expect(service.decrypt(enc2)).toBe(text);
  });

  it('menolak dekripsi bila ciphertext dimanipulasi/tampered', () => {
    const encrypted = service.encrypt('sensitive-data');
    const parts = encrypted.split('.');
    // Ubah satu karakter di ciphertext
    const tamperedCipher = `${parts[3]}tampered`;
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]}.${tamperedCipher}`;

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('menolak dekripsi bila auth tag dimanipulasi', () => {
    const encrypted = service.encrypt('sensitive-data');
    const parts = encrypted.split('.');
    const tamperedTag = `A${parts[2]?.slice(1)}`;
    const tampered = `${parts[0]}.${parts[1]}.${tamperedTag}.${parts[3]}`;

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('menolak format yang bukan v1 atau bagian tidak lengkap', () => {
    expect(() => service.decrypt('v2.aaa.bbb.ccc')).toThrow(
      'Format cipher text tidak valid',
    );
    expect(() => service.decrypt('v1.aaa.bbb')).toThrow(
      'Format cipher text tidak valid',
    );
  });

  it('menolak dekripsi bila kunci dekripsi berbeda', () => {
    const serviceB = createService(keyB);
    const encryptedWithA = service.encrypt('secret-for-a');

    expect(() => serviceB.decrypt(encryptedWithA)).toThrow();
  });
});
