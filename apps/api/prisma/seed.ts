import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { toDbDate } from '../src/common/date.js';
import { DriveStatus, PrismaClient } from '../src/generated/prisma/client.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Seed dilarang dijalankan di lingkungan production!');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL belum diatur di environment!');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Menyiapkan data seed development...');

  // User dev-a
  const userA = await prisma.user.upsert({
    where: { email: 'dev-a@daydone.local' },
    update: {},
    create: {
      email: 'dev-a@daydone.local',
      googleId: 'google-dev-a-id',
      name: 'Dev User A',
      avatarUrl: 'https://lh3.googleusercontent.com/dev-a',
      driveStatus: DriveStatus.NOT_CONNECTED,
    },
  });

  // User dev-b
  await prisma.user.upsert({
    where: { email: 'dev-b@daydone.local' },
    update: {},
    create: {
      email: 'dev-b@daydone.local',
      googleId: 'google-dev-b-id',
      name: 'Dev User B',
      avatarUrl: 'https://lh3.googleusercontent.com/dev-b',
      driveStatus: DriveStatus.NOT_CONNECTED,
    },
  });

  // 10 logbook berurutan untuk dev-a
  const sampleDescriptions = [
    'Menyiapkan monorepo dan konfigurasi pnpm workspace.',
    'Membangun bootstrap REST API dengan NestJS dan Vitest.',
    'Menambahkan modul health check dan routing prefix.',
    'Mengimplementasikan schema validasi Zod untuk logbook.',
    'Membuat in-memory CRUD service untuk modul logbook.',
    'Menambahkan fitur pencarian deskripsi case-insensitive.',
    'Mengonfigurasi Prisma 7 dan adapter PostgreSQL.',
    'Membuat helper tanggal UTC dan unit test batas kalender.',
    'Menyiapkan service container PostgreSQL lokal dengan Docker.',
    'Menulis script seeder data development untuk pengujian.',
  ];

  for (let i = 0; i < 10; i++) {
    const day = String(i + 1).padStart(2, '0');
    const isoDate = `2026-11-${day}`;
    const date = toDbDate(isoDate);

    await prisma.logEntry.upsert({
      where: {
        userId_date: {
          userId: userA.id,
          date,
        },
      },
      update: {
        description: sampleDescriptions[i],
      },
      create: {
        userId: userA.id,
        date,
        description: sampleDescriptions[i],
      },
    });
  }

  console.log(
    `Seeder selesai: 2 user dev (${userA.email}, dev-b@daydone.local) dan 10 logbook telah disiapkan.`,
  );
}

main()
  .catch((e) => {
    console.error('Seeder gagal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

