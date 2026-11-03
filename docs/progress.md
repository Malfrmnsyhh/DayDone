# Progress

> Diperbarui oleh agent atau pemilik setiap selesai task. Kode di repo adalah sumber kebenaran; bila berbeda dengan catatan ini, perbaiki catatan ini.

**Terakhir diperbarui:** 3 November 2026 (penyelesaian Milestone M3)

## Status per milestone

| Milestone | Status |
|---|---|
| M0 Fondasi monorepo | Selesai |
| M1 CRUD logbook di memori | Selesai |
| M2 Konfigurasi dan database | Selesai |
| M3 Logbook di database | Selesai |
| M4 – M9 | Belum dimulai |

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

### M3
- [x] M3-1 `DevAuthGuard` sementara (`X-Dev-User-Email`) aktif hanya saat `DEV_AUTH_ENABLED=true` di lingkungan development & test. Decorator `@Public()` untuk bypass autentikasi pada endpoint publik, decorator `@CurrentUser()` untuk injeksi user ke controller.
- [x] M3-2 Refaktor `LogsService` dari in-memory ke database via Prisma. Semua operasi wajib menerima `userId` dan di-scope ketat. Menggunakan `findFirst({ where: { id, userId } })`, data milik user lain dibalas `404 Not Found`.
- [x] M3-3 Paginasi `page` (default 1) dan `limit` (1–100, default 20) dengan penghitungan `totalPages` di database via `$transaction([count, findMany])`. Filter `from`, `to` (validasi `from <= to`), dan `search` deskripsi case-insensitive. Validasi tanggal tolak lebih dari 1 hari di masa depan (+1 hari UTC server).
- [x] M3-4 Endpoint `GET /logs/by-date/:date` via Prisma memanfaatkan unique composite key `userId_date`.
- [x] M3-5 `DomainException` dan enum `ErrorCode` lengkap (`docs/04-api-spec.md`). `PrismaExceptionFilter` global (P2002 -> 409 generik, P2025 -> 404). Duplikasi tanggal logbook ditangani khusus di `LogsService` dengan mengembalikan error code `LOG_DATE_CONFLICT` dan field `existingLogId`.
- [x] M3-6 Response mapper `toLogResponse` dan `toLogListItemResponse`: memformat tanggal menjadi `YYYY-MM-DD`, menyembunyikan ID internal `userId`, dan menyertakan `attachmentCount`.
- [x] M3-7 Unit test lengkap (52 tests) dan E2E test (19 tests) dengan isolasi database lokal Docker (`localhost:5433`) yang diverifikasi oleh `db-safety-guard.ts`.

## Task berikutnya untuk agent

1. Mulai **M4 (Autentikasi Google OAuth & Sesi)**:
   - **M4-1**: `EncryptionService` (AES-256-GCM) untuk mengenkripsi refresh token Google sebelum disimpan di database.
   - **M4-2**: Setup Google OAuth client & token verification di backend.
   - **M4-3**: Endpoint `POST /auth/google` (tukar Google code dengan access token JWT + refresh token sesi).
   - **M4-4**: Endpoint `POST /auth/refresh` (rotasi refresh token sesi).
   - **M4-5**: Endpoint `POST /auth/logout` dan `GET /auth/me`.
   - **M4-6**: Penggantian `DevAuthGuard` dengan `JwtAuthGuard` resmi.

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
- 2026-11-03 — Penanganan P2002 untuk duplikat tanggal ditangani khusus di `LogsService` (bukan filter global biasa), sehingga API dapat mengembalikan `code: "LOG_DATE_CONFLICT"` beserta payload `"existingLogId"` yang spesifik sesuai kontrak `docs/04-api-spec.md`.
- 2026-11-03 — Batas toleransi tanggal logbook masa depan dihitung dinamis di dalam `.refine()` pada saat validasi dieksekusi (bukan konstanta tingkat modul) untuk menjamin akurasi waktu server dan toleransi zona waktu UTC + 1 hari.
- 2026-11-03 — Guard keselamatan database lokal (`db-safety-guard.ts`): seluruh skrip tes E2E dan operasi reset diproteksi keras dari eksekusi ke database non-localhost atau host Supabase untuk mencegah insiden penghapusan data produksi.

## Catatan untuk pemilik (hal yang perlu dipelajari dari task yang dikerjakan agent)

1. **Guard Global dan Decorator Kustom (`src/auth/dev-auth.guard.ts`)**:
   - `APP_GUARD` di daftarkan pada `AppModule` sebagai penyaring request global. Untuk mengecualikan endpoint publik seperti `/health`, kita membuat metadata kustom `@Public()` menggunakan `SetMetadata` dan dibaca oleh Guard via `Reflector`.
   - Decorator `@CurrentUser()` dibuat menggunakan `createParamDecorator` untuk mengekstrak objek user yang telah divalidasi dan ditempelkan pada `request.user` oleh Guard, sehingga controller tidak perlu membaca `req` mentah secara langsung.

2. **Hierarki Penanganan Error (`src/common/errors/` & `src/common/filters/`)**:
   - NestJS membedakan exception bawaan framework (`NotFoundException`, `ConflictException`) dengan exception domain aplikasi (`DomainException`).
   - `PrismaExceptionFilter` didaftarkan sebagai `APP_FILTER` untuk menangkap error Prisma (`P2002` duplicate key, `P2025` record not found) secara global dan memetakannya ke status HTTP yang sesuai tanpa mengekspos detail internal query ke client.

3. **Data Scoping & Isolasi Antar-Pengguna di Database**:
   - Pada aplikasi multi-tenant / multi-user, keamanan data pengguna ditentukan di query layer. Seluruh query `findFirst`, `findMany`, dan compound index `userId_date` selalu menyertakan `userId` dari token pengguna.
   - Jika pengguna meminta ID data yang bukan miliknya, server membalas dengan `404 Not Found` (bukan `403 Forbidden`). Ini adalah praktik keamanan terbaik agar penyerang tidak dapat melakukan enumerasi / mendeteksi keberadaan resource pengguna lain (*resource existence leakage*).

4. **Testing E2E Terisolasi dengan Docker PostgreSQL**:
   - Pengujian E2E (`apps/api/test/logs.e2e-spec.ts`) berjalan langsung ke instance PostgreSQL nyata di Docker port 5433 menggunakan `dotenv-cli` (`.env.test`).
   - Menguji aplikasi secara end-to-end melalui HTTP Supertest membuktikan bahwa seluruh rantai request — mulai dari Middleware, Guard, Validation Pipe, Controller, Service, hingga Constraint Unik Database PostgreSQL — berfungsi harmonis sesuai spesifikasi API.
