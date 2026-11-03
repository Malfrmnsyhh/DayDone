/**
 * Memastikan perintah database berbahaya (reset, truncate, delete massal)
 * HANYA berjalan ke database PostgreSQL lokal (localhost:5433).
 * Membatalkan proses dengan error keras bila URL mengarah ke Supabase atau remote host.
 */
export function assertLocalDatabaseOnly(
  databaseUrl: string,
  directUrl?: string,
): void {
  const urls = [databaseUrl, directUrl].filter(Boolean) as string[];

  for (const url of urls) {
    const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
    const isSupabase = url.toLowerCase().includes('supabase');

    if (!isLocalhost || isSupabase) {
      throw new Error(
        `[KESELAMATAN DATABASE TERLANGGAR]: Operasi test/reset DITOLAK! URL database bukan localhost atau mengarah ke Supabase. Perintah ini hanya diizinkan untuk database lokal!`,
      );
    }
  }
}

