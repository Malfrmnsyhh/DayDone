# Progress

> Diperbarui oleh agent atau pemilik setiap selesai task. Kode di repo adalah sumber kebenaran; bila berbeda dengan catatan ini, perbaiki catatan ini.

**Terakhir diperbarui:** 2 November 2026 (penyelesaian M0 dan M1)

## Status per milestone

| Milestone | Status |
|---|---|
| M0 Fondasi monorepo | Selesai |
| M1 CRUD logbook di memori | Selesai |
| M2 – M9 | Belum dimulai |

## Detail

### M0
- [x] M0-1 Monorepo pnpm (`pnpm-workspace.yaml`, `apps/`, `packages/`, `.gitignore`)
- [x] M0-2 NestJS di `apps/api` (ESM + Vitest, terlihat dari `vitest.config.ts`)
- [x] M0-3 Prefix `api/v1` + CORS — *terverifikasi di `main.ts`*
- [x] M0-4 `GET /api/v1/health` — *diimplementasikan via `HealthModule` (`{ status: "ok", timestamp }`)*
- [x] M0-5 Script root: `dev`, `build`, `lint`, `test`, `format` meneruskan ke paket (`pnpm -r`)

Catatan: repo sudah terhubung ke `github.com/Malfrmnsyh/DayDone`. Proyek kemungkinan sudah di-link ke NestJS Observe saat pembuatan (project `DayDone`, application `api`); bila ya, kuncinya ada di `apps/api/.env`. Observe bersifat opsional.

### M1
- [x] M1-1 `LogsModule` in-memory dengan Zod — *CRUD lengkap, deskripsi 1–5000 karakter, 409 tanggal duplikat, 404, DELETE 204, ParseUUIDPipe pada `:id`, StandardSchemaValidationPipe global*
- [x] M1-2 Filter `search` (case-insensitive pada deskripsi) dan endpoint `GET /logs/by-date/:date`

## Task berikutnya untuk agent

1. Mulai **M2 (Konfigurasi dan database)**.
2. Siapkan task M2 yang tidak bergantung kredensial Supabase terlebih dahulu:
   - **M2-1**: `@nestjs/config` + validasi env Zod (`src/config/env.schema.ts`), `.env.example`.
   - **M2-4**: Helper `src/common/date.ts` + unit test.
   - **M2-7**: `docker-compose.yml` Postgres lokal untuk test & development offline.
3. Setelah kredensial Supabase diberikan oleh pemilik, lanjutkan **M2-2** (Prisma 7 setup & migrasi) dan **M2-3** (`PrismaModule` global).

## Kredensial dan akses yang dibutuhkan dari pemilik

| Kebutuhan | Untuk | Status |
|---|---|---|
| Connection string Supabase | M2 | Belum diberikan |
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

## Catatan untuk pemilik (hal yang perlu dipelajari dari task yang dikerjakan agent)

1. **`HealthModule` dan Pemisahan Endpoint Health (`apps/api/src/health/`)**:
   - NestJS mendorong arsitektur modular. Endpoint kesehatan sistem dipisahkan ke dalam modul mandiri (`HealthModule` dan `HealthController`), bukan ditumpuk di `AppController`.
   - Karena `app.setGlobalPrefix('api/v1')` aktif, endpoint `@Controller('health')` otomatis diakses di `GET /api/v1/health`.

2. **Zod Standard Schema & `StandardSchemaValidationPipe` (`apps/api/src/logs/dto/log.schema.ts`)**:
   - NestJS v12 mendukung *Standard Schema V1*, memungkinkan schema Zod dipasang langsung di decorator `@Body({ schema: ... })`, `@Query({ schema: ... })`, dan `@Param({ schema: ... })`.
   - Validasi berjalan otomatis secara deklaratif tanpa memerlukan dependensi decorator lama seperti `class-validator` / `class-transformer`.

3. **Urutan Route di NestJS/Express (`apps/api/src/logs/logs.controller.ts`)**:
   - Route `@Get('by-date/:date')` didaftarkan sebelum `@Get(':id')`. Jika `@Get(':id')` diletakkan lebih atas, Express akan menganggap kata `"by-date"` sebagai parameter `:id`, yang akan memicu error `400 Bad Request` dari `ParseUUIDPipe` karena `"by-date"` bukan UUID yang valid.

4. **Testing Service & Controller dengan Vitest (`apps/api/src/logs/*.spec.ts`)**:
   - `LogsService` diuji sebagai unit murni (`new LogsService()`), mencakup skenario pembuatan data, deteksi tanggal duplikat (`toThrow(ConflictException)`), penghapusan, filter tanggal, dan pencarian case-insensitive.
   - `LogsController` diuji menggunakan `Test.createTestingModule` untuk memverifikasi Dependency Injection NestJS bekerja dengan benar.

5. **Monorepo Task Delegation (`package.json`)**:
   - Perintah `pnpm -r run <script>` di root mendelegasikan eksekusi perintah build, lint, test, dan format ke seluruh sub-paket di dalam workspace monorepo.
