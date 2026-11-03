import { z } from 'zod';

/**
 * Schema validasi variabel lingkungan untuk DayDone API.
 * Menjamin semua konfigurasi krusial untuk database, Google OAuth,
 * JWT sesi, dan enkripsi token tervalidasi saat aplikasi dimulai.
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

    // Google OAuth (M4)
    GOOGLE_WEB_CLIENT_ID: z
      .string()
      .min(1, 'GOOGLE_WEB_CLIENT_ID wajib diisi'),
    GOOGLE_WEB_CLIENT_SECRET: z
      .string()
      .min(1, 'GOOGLE_WEB_CLIENT_SECRET wajib diisi'),

    // JWT Access Token (M4)
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET minimal 32 karakter'),
    JWT_ACCESS_TTL: z.string().default('15m'),

    // Sesi DayDone (M4)
    REFRESH_TOKEN_TTL_DAYS: z.coerce
      .number()
      .int()
      .positive()
      .default(30),

    // Enkripsi Token Google (M4)
    TOKEN_ENCRYPTION_KEY: z
      .string()
      .min(1, 'TOKEN_ENCRYPTION_KEY wajib diisi')
      .refine(
        (val) => {
          try {
            const buf = Buffer.from(val, 'base64');
            return buf.length === 32;
          } catch {
            return false;
          }
        },
        {
          message:
            'TOKEN_ENCRYPTION_KEY harus berupa string base64 yang menghasilkan tepat 32 byte',
        },
      ),

    // Konfigurasi Cookie Web (M4)
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_SECURE: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .default(true)
      .transform((val) => val === true || val === 'true'),
  })
  .refine(
    (data) => !(data.NODE_ENV === 'production' && data.COOKIE_SECURE === false),
    {
      message: 'COOKIE_SECURE tidak boleh false di lingkungan production!',
      path: ['COOKIE_SECURE'],
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
