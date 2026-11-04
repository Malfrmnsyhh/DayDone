import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

// Saat perintah migrasi/database dijalankan, database URL wajib ada
const isMigrationCommand = process.argv.some(
  (arg) => arg.includes('migrate') || arg.includes('db'),
);

if (isMigrationCommand && !dbUrl) {
  throw new Error(
    'Variabel lingkungan DIRECT_URL atau DATABASE_URL belum diatur! ' +
      'Pastikan Anda telah mengisi DATABASE_URL dan DIRECT_URL di tab Variables pada dashboard Railway.',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // CLI (migrate, studio) memakai koneksi langsung / session pooler
    url: dbUrl || 'postgresql://placeholder:5432/placeholder',
  },
});
