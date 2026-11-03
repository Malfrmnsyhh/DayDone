import { z } from 'zod';

/**
 * Schema validasi variabel lingkungan yang dibutuhkan pada milestone M2.
 * Variabel Google OAuth (M4), JWT (M4), enkripsi token (M4), dan
 * signed URL (M5) ditambahkan di milestone masing-masing.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib diisi'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL wajib diisi'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Fungsi validasi yang dipanggil oleh ConfigModule.forRoot({ validate }).
 * Melempar error deskriptif bila ada variabel wajib yang hilang atau
 * tidak sesuai tipe.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Konfigurasi lingkungan tidak valid:\n${formatted}\n\nPastikan file .env sudah diisi sesuai .env.example.`,
    );
  }

  return result.data;
}
