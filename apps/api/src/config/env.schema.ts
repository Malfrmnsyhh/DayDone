import { z } from 'zod';

/**
 * Schema validasi variabel lingkungan untuk DayDone API.
 * Variabel Google OAuth (M4), JWT (M4), enkripsi token (M4), dan
 * signed URL (M5) ditambahkan di milestone masing-masing.
 */
const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib diisi'),
    DIRECT_URL: z.string().min(1, 'DIRECT_URL wajib diisi'),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
    DEV_AUTH_ENABLED: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .default(false)
      .transform((val) => val === true || val === 'true'),
  })
  .refine(
    (data) => !(data.DEV_AUTH_ENABLED && data.NODE_ENV === 'production'),
    {
      message: 'DEV_AUTH_ENABLED dilarang aktif di lingkungan production!',
      path: ['DEV_AUTH_ENABLED'],
    },
  );

export type Env = z.infer<typeof envSchema>;

/**
 * Fungsi validasi yang dipanggil oleh ConfigModule.forRoot({ validate }).
 * Melempar error deskriptif bila ada variabel wajib yang hilang atau
 * melanggar aturan keamanan lingkungan.
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
