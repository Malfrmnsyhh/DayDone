import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema.js';

describe('validateEnv', () => {
  const validBaseConfig = {
    NODE_ENV: 'development',
    PORT: '3000',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/daydone',
    DIRECT_URL: 'postgresql://postgres:postgres@localhost:5432/daydone',
  };

  it('harus berhasil memvalidasi konfigurasi yang benar', () => {
    const env = validateEnv(validBaseConfig);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.DEV_AUTH_ENABLED).toBe(false);
  });

  it('harus mengonversi DEV_AUTH_ENABLED dari string "true" ke boolean true', () => {
    const env = validateEnv({
      ...validBaseConfig,
      DEV_AUTH_ENABLED: 'true',
    });
    expect(env.DEV_AUTH_ENABLED).toBe(true);
  });

  it('harus menolak start bila DEV_AUTH_ENABLED=true di lingkungan production', () => {
    expect(() =>
      validateEnv({
        ...validBaseConfig,
        NODE_ENV: 'production',
        DEV_AUTH_ENABLED: 'true',
      }),
    ).toThrow('DEV_AUTH_ENABLED dilarang aktif di lingkungan production!');
  });

  it('harus menolak bila DATABASE_URL atau DIRECT_URL tidak ada', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
      }),
    ).toThrow('Konfigurasi lingkungan tidak valid');
  });
});

