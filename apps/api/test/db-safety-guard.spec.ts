import { describe, expect, it } from 'vitest';
import { assertLocalDatabaseOnly } from './db-safety-guard.js';

describe('assertLocalDatabaseOnly', () => {
  it('menerima database URL lokal (localhost:5433)', () => {
    expect(() =>
      assertLocalDatabaseOnly(
        'postgresql://postgres:postgres@localhost:5433/daydone_test?schema=public',
      ),
    ).not.toThrow();

    expect(() =>
      assertLocalDatabaseOnly(
        'postgresql://postgres:postgres@127.0.0.1:5433/daydone_test?schema=public',
      ),
    ).not.toThrow();
  });

  it('menolak keras jika URL mengarah ke Supabase', () => {
    expect(() =>
      assertLocalDatabaseOnly(
        'postgresql://postgres.xxx:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
      ),
    ).toThrow('[KESELAMATAN DATABASE TERLANGGAR]');
  });

  it('menolak keras jika URL mengarah ke remote host selain localhost/127.0.0.1', () => {
    expect(() =>
      assertLocalDatabaseOnly('postgresql://user:pass@192.168.1.100:5432/db'),
    ).toThrow('[KESELAMATAN DATABASE TERLANGGAR]');
  });
});

