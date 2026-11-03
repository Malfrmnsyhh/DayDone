# Progress

> Diperbarui oleh agent atau pemilik setiap selesai task. Kode di repo adalah sumber kebenaran; bila berbeda dengan catatan ini, perbaiki catatan ini.

**Terakhir diperbarui:** 3 November 2026 (penyelesaian Milestone M2)

## Status per milestone

| Milestone | Status |
|---|---|
| M0 Fondasi monorepo | Selesai |
| M1 CRUD logbook di memori | Selesai |
| M2 Konfigurasi dan database | Selesai |
| M3 – M9 | Belum dimulai |

## Detail

### M0
- [x] M0-1 Monorepo pnpm (`pnpm-workspace.yaml`, `apps/`, `packages/`, `.gitignore`)
- [x] M0-2 NestJS di `apps/api` (ESM + Vitest, terlihat dari `vitest.config.ts`)
- [x] M0-3 Prefix `api/v1` + CORS — *terverifikasi di `main.ts`*
- [x] M0-4 `GET /api/v1/health` — *diimplementasikan via `HealthModule`*
- [x] M0-5 Script root: `dev`, `build`, `lint`, `test`, `format` meneruskan ke paket (`pnpm -r`)

### M1
- [x] M1-1 `LogsModule` in-memory dengan Zod — *CRUD lengkap, deskripsi 1–5000 karakter, 409 tanggal duplikat, 404, DELETE 204, ParseUUIDPipe pada `:id`, StandardSchemaValidationPipe global*
- [x] M1-2 Filter `search` (case-insensitive pada deskripsi) dan endpoint `GET /logs/by-date/:date`

### M2
- [x] M2-1 `@nestjs/config` global + validasi env dengan Zod di `src/config/env.schema.ts`, template `apps/api/.env.example`
- [x] M2-2 Setup Prisma 7: `prisma.config.ts`, `schema.prisma` sesuai `docs/03-data-model.md`, driver adapter `@prisma/adapter-pg`, generator ke `src/generated/prisma`. Migrasi `init` dan `enable_rls` sukses diterapkan ke Supabase.
- [x] M2-3 `PrismaModule` (@Global) + `PrismaService` dengan PrismaPg adapter membaca `DATABASE_URL` dari `ConfigService`
- [x] M2-4 Helper `src/common/date.ts` (`toDbDate`, `fromDbDate`) + unit test tanggal batas (1 Jan, 31 Des, 29 Feb kabisat, bukti tidak bergeser zona waktu)
- [x] M2-5 Health check memeriksa database (`SELECT 1`), mengembalikan 503 dengan `"database": "down"` bila gagal + unit test mock
- [x] M2-6 Seed user dev (2 user dev: `dev-a`, `dev-b`) dan 10 logbook (`prisma db seed` berhasil dan terverifikasi)
- [x] M2-7 `docker-compose.yml` di root dengan service `postgres-test` (port 5433)

## Task berikutnya untuk agent

1. Mulai **M3 (Logbook di database)**:
   - **M3-1**: `DevAuthGuard` sementara + decorator `@CurrentUser()`.
   - **M3-2**: Refactor `LogsService` dari in-memory ke Prisma, di-scoped dengan `userId` dari request.
   - **M3-3**: Paginasi (`page`, `limit`) + `meta`, validasi `from <= to`, batas tanggal masa depan.
   - **M3-4**: Endpoint `GET /logs/by-date/:date` via Prisma.
   - **M3-5**: `DomainException`, daftar `ErrorCode`, filter error Prisma global (duplikat tanggal -> 409 `LOG_DATE_CONFLICT` + `existingLogId`).
   - **M3-6**: Response mapper (tanggal sebagai string `YYYY-MM-DD`, tanpa field internal).
   - **M3-7**: Unit test & E2E test Logs lengkap (termasuk isolasi lintas pengguna dengan `dev-a` dan `dev-b`).

## Kredensial dan akses yang dibutuhkan dari pemilik

| Kebutuhan | Untuk | Status |
|---|---|---|
| Connection string Supabase | M2 | Sudah diberikan (aktif & terverifikasi) |
| OAuth client Web (ID + secret) dari Google Cloud | M4 | Belum dibuat |
| Akun Google penguji terdaftar sebagai test user | M4–M5 | Belum |
| Akun Render/Railway | M6 | Belum |
| Akun Vercel | M7 | Ada (terlihat di bookmark) |
| Akun Expo | M8 | Belum dipastikan |

## Keputusan kecil selama pengembangan

Catat di sini keputusan yang tidak cukup besar untuk ADR (format: tanggal — keputusan — alasan).

- 2026-11-02 — Satu logbook per hari (`@@unique([userId, date])`) — kebutuhan umum logbook magang; dapat ditinjau ulang (PRD Q2).
- 2026-11-02 — Upload foto lewat API untuk MVP — lebih sederhana; API tidak di Vercel jadi tidak terkena batas body 4,5 MB.
- 2026-11-02 — Route `by-date/:date` diletakkan sebelum `:id` di `LogsController` — mencegah path static 'by-date' ditangkap oleh route parameter `:id` yang divalidasi `ParseUUIDPipe`.
- 2026-11-03 — RLS diaktifkan tanpa policy pada tabel (`users`, `sessions`, `log_entries`, `attachments`) — memblokir akses langsung PostgREST publik Supabase dengan anon key; Prisma tetap jalan karena terhubung sebagai role superuser/owner `postgres`.
- 2026-11-03 — Perintah seeder di Prisma 7 dikonfigurasi pada `prisma.config.ts` di bawah properti `migrations.seed` menggunakan runner `tsx prisma/seed.ts` agar import ESM `.js` terpetakan secara otomatis ke file TypeScript.

## Catatan untuk pemilik (hal yang perlu dipelajari dari task yang dikerjakan agent)

1. **`ConfigModule` dan Validasi Lingkungan Terpusat (`src/config/env.schema.ts`)**:
   - NestJS `@nestjs/config` memuat variabel dari `.env`. Dengan menambahkan validator berbasis Zod (`validateEnv`), aplikasi akan *fail-fast* (langsung berhenti saat start) jika variabel penting seperti `DATABASE_URL` atau `DIRECT_URL` tidak ada atau salah format, sehingga mencegah runtime error tersembunyi.

2. **Prisma 7 dengan Driver Adapter (`src/prisma/prisma.service.ts`)**:
   - Berbeda dari Prisma 5/6, Prisma 7 menggunakan konfigurasi modern `prisma.config.ts` dan adapter PostgreSQL resmi (`@prisma/adapter-pg`). `PrismaClient` di-generate ke folder internal (`src/generated/prisma`) dan di-extend oleh `PrismaService` dengan `connectionString` dinamis dari `ConfigService`.

3. **Alur Migrasi Database (`prisma/migrations/`)**:
   - `prisma migrate dev --name init`: Membaca `schema.prisma`, membandingkannya dengan database Supabase, menghasilkan file SQL di `prisma/migrations/<timestamp>_init/migration.sql`, dan menerapkannya.
   - `prisma migrate dev --create-only --name enable_rls`: Membuat file migrasi SQL kosong tanpa langsung mengeksekusinya, memungkinkan kita menulis SQL kustom (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) lalu menerapkannya dengan `prisma migrate dev`.

4. **Seeding Idempoten (`prisma/seed.ts`)**:
   - Seeder menggunakan metode `.upsert({ where, update, create })` sehingga script aman dijalankan berulang kali tanpa membuat duplikasi data. Seeder juga dilengkapi pengecekan `NODE_ENV === 'production'` untuk mencegah kecelakaan penimpaan data di lingkungan produksi.

5. **Health Check Terintegrasi Database (`src/health/health.controller.ts`)**:
   - Endpoint `GET /api/v1/health` kini mengeksekusi `SELECT 1` lewat `prisma.$queryRaw`. Bila database aktif, respons HTTP 200 `{ status: "ok", database: "up" }`. Jika koneksi terputus, controller melempar `ServiceUnavailableException` (HTTP 503) dengan payload `{ status: "error", database: "down" }`.
