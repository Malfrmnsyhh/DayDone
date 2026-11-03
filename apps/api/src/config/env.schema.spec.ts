import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema.js';

describe('validateEnv', () => {
  // 32-byte key base64 (contoh: 32 karakter 'a' = 32 bytes)
  const valid32ByteBase64Key = Buffer.alloc(32, 1).toString('base64');
  const validSecret32Chars = 'super-secret-jwt-key-min-32-characters-long!';

  const validConfig = {
    NODE_ENV: 'development',
    PORT: '3000',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    DIRECT_URL: 'postgresql://user:pass@localhost:5432/db',
    CORS_ORIGINS: 'http://localhost:5173',
    GOOGLE_WEB_CLIENT_ID: 'google-client-id-123',
    GOOGLE_WEB_CLIENT_SECRET: 'google-client-secret-123',
    JWT_ACCESS_SECRET: validSecret32Chars,
    TOKEN_ENCRYPTION_KEY: valid32ByteBase64Key,
    ATTACHMENT_URL_SECRET: validSecret32Chars,
  };

  it('berhasil memvalidasi konfigurasi yang lengkap dengan nilai default', () => {
    const env = validateEnv(validConfig);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.JWT_ACCESS_TTL).toBe('15m');
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(30);
    expect(env.COOKIE_SAMESITE).toBe('lax');
    expect(env.COOKIE_SECURE).toBe(true);
  });

  it('menolak bila JWT_ACCESS_SECRET kurang dari 32 karakter', () => {
    expect(() =>
      validateEnv({
        ...validConfig,
        JWT_ACCESS_SECRET: 'short-secret',
      }),
    ).toThrow('JWT_ACCESS_SECRET minimal 32 karakter');
  });

  it('menolak bila ATTACHMENT_URL_SECRET kurang dari 32 karakter', () => {
    expect(() =>
      validateEnv({
        ...validConfig,
        ATTACHMENT_URL_SECRET: 'short-attachment-secret',
      }),
    ).toThrow('ATTACHMENT_URL_SECRET minimal 32 karakter');
  });

  it('menolak bila TOKEN_ENCRYPTION_KEY bukan 32 byte base64', () => {
    expect(() =>
      validateEnv({
        ...validConfig,
        TOKEN_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64'),
      }),
    ).toThrow('TOKEN_ENCRYPTION_KEY harus berupa string base64');
  });

  it('menolak bila COOKIE_SECURE bernilai false di lingkungan production', () => {
    expect(() =>
      validateEnv({
        ...validConfig,
        NODE_ENV: 'production',
        COOKIE_SECURE: 'false',
      }),
    ).toThrow('COOKIE_SECURE tidak boleh false di lingkungan production');
  });

  it('mengizinkan COOKIE_SECURE false di development', () => {
    const env = validateEnv({
      ...validConfig,
      NODE_ENV: 'development',
      COOKIE_SECURE: 'false',
    });
    expect(env.COOKIE_SECURE).toBe(false);
  });
});
