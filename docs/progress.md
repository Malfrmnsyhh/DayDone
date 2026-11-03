# Progress

> Diperbarui oleh agent atau pemilik setiap selesai task. Kode di repo adalah sumber kebenaran; bila berbeda dengan catatan ini, perbaiki catatan ini.

**Terakhir diperbarui:** 3 November 2026 (penyelesaian Milestone M4)

## Status per milestone

| Milestone | Status |
|---|---|
| M0 Fondasi monorepo | Selesai |
| M1 CRUD logbook di memori | Selesai |
| M2 Konfigurasi dan database | Selesai |
| M3 Logbook di database | Selesai |
| M4 Autentikasi Google + sesi | Selesai |
| M5 – M9 | Belum dimulai |

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
- [x] M3-1 `DevAuthGuard` sementara (`X-Dev-User-Email`) aktif hanya saat `DEV_AUTH_ENABLED=true` di lingkungan development & test.
- [x] M3-2 Refaktor `LogsService` dari in-memory ke database via Prisma. Semua operasi wajib menerima `userId` dan di-scope ketat. Menggunakan `findFirst({ where: { id, userId } })`, data milik user lain dibalas `404 Not Found`.
- [x] M3-3 Paginasi `page` (default 1) dan `limit` (1–100, default 20) dengan penghitungan `totalPages` di database via `$transaction([count, findMany])`. Filter `from`, `to` (validasi `from <= to`), dan `search` deskripsi case-insensitive. Validasi tanggal tolak lebih dari 1 hari di masa depan (+1 hari UTC server).
- [x] M3-4 Endpoint `GET /logs/by-date/:date` via Prisma memanfaatkan unique composite key `userId_date`.
- [x] M3-5 `DomainException` dan enum `ErrorCode` lengkap (`docs/04-api-spec.md`). `PrismaExceptionFilter` global.
- [x] M3-6 Response mapper `toLogResponse` dan `toLogListItemResponse`: memformat tanggal menjadi `YYYY-MM-DD`, menyembunyikan ID internal `userId`, dan menyertakan `attachmentCount`.
- [x] M3-7 Unit test lengkap (52 tests) dan E2E test (19 tests) dengan isolasi database lokal Docker (`localhost:5433`) yang diverifikasi oleh `db-safety-guard.ts`.

### M4
- [x] M4-1 `EncryptionService` AES-256-GCM di `src/common/crypto/` dengan format tersimpan `v1.<iv>.<tag>.<ciphertext>` base64url dan IV 12-byte acak tiap enkripsi.
- [x] M4-2 `GoogleOAuthService` di balik token injeksi `GOOGLE_OAUTH_SERVICE` dan `FakeGoogleOAuthService` untuk pengujian deterministik.
- [x] M4-3 `SessionsService` dengan token acak 32-byte (hash SHA-256 tersimpan di DB), rotasi atomik di dalam `$transaction`, dan deteksi pemakaian ulang (reuse detection) yang mencabut seluruh sesi aktif user.
- [x] M4-4 `AuthService` dan `AuthController`:
  - `POST /auth/google`: tukar code, upsert user by `googleId` (tidak menimpa refresh token lama bila Google tidak mengirim token baru), penentuan `driveStatus` (`NOT_CONNECTED`, `NEEDS_RECONNECT`, `CONNECTED`). Platform WEB menyimpan cookie `daydone_rt` (`HttpOnly`, `Path=/api/v1/auth`), platform MOBILE mengembalikan di body.
  - `POST /auth/refresh`: rotasi sesi dan pembaruan cookie web atau body mobile. Proteksi CSRF via header wajib `X-Requested-With: daydone-web`.
  - `POST /auth/logout`: `@Public()` diidentifikasi via refresh token (tetap bisa logout saat access token kedaluwarsa), membersihkan cookie dengan atribut path/sameSite/secure yang identik.
  - `GET /auth/me`: mengembalikan profil pengguna terautentikasi.
- [x] M4-5 `JwtAuthGuard` global (`APP_GUARD`) dengan algoritma `HS256` eksplisit dan verifikasi sesi aktif di database. Decorator `@CurrentUser()` mengembalikan `{ userId, sessionId }`. `DevAuthGuard` dihapus total.
- [x] M4-6 Halaman uji interaktif di `apps/api/tools/google-login-test/index.html` menggunakan Google Identity Services (GIS popup) untuk verifikasi login, me, refresh, dan logout secara nyata.
- [x] M4-7 Rate limiting `@nestjs/throttler` (global 100/menit, `/auth/*` 10/menit) dengan `AppThrottlerGuard` yang fleksibel untuk pengujian. Unit test (89 tests) dan E2E test (32 tests) lolos 100%.

## Task berikutnya untuk agent

1. Mulai **M5 (Integrasi Google Drive & Lampiran)**:
   - **M5-1**: Setup storage abstraction (`StorageProvider` interface) & Google Drive API client wrapper.
   - **M5-2**: `ensureAppFolder` untuk membuat folder aplikasi `DayDone` di Drive user saat pertama kali terhubung.
   - **M5-3**: Pemrosesan gambar dengan `sharp`: autorotate EXIF, resize max 2048px, strip metadata, kompres JPEG kualitas 82.
   - **M5-4**: Endpoint `POST /logs/:id/attachments` (upload multipart/form-data, max 5 foto per logbook, validasi MIME/magic bytes).
   - **M5-5**: Endpoint `GET /attachments/:id/content` dengan signed URL HMAC-SHA256 berumur 5 menit.
   - **M5-6**: Soft-delete foto (pindah ke Trash Google Drive).

## Kredensial dan akses yang dibutuhkan dari pemilik

| Kebutuhan | Untuk | Status |
|---|---|---|
| Connection string Supabase | M2 | Sudah diberikan (aktif & terverifikasi) |
| OAuth client Web (ID + secret) dari Google Cloud | M4 | Sudah diisi pemilik di `.env` lokal |
| Kunci rahasia JWT & Enkripsi token | M4 | Sudah diisi pemilik di `.env` lokal |
| Akun Google penguji terdaftar sebagai test user | M4–M5 | Tersedia di Google Cloud Console |
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
- 2026-11-03 — Deteksi pemakaian ulang refresh token (token reuse) dilakukan secara atomik menggunakan update kondisional `updateMany({ where: { id, revokedAt: null } })`. Bila `count === 0`, server langsung mencabut seluruh sesi aktif user di database untuk memitigasi pencurian sesi saat terjadi race condition.
- 2026-11-03 — Endpoint `POST /auth/logout` dijadikan `@Public()` dan diidentifikasi via refresh token (cookie atau body) agar pengguna tetap bisa logout dengan aman meskipun token akses JWT telah kedaluwarsa.
- 2026-11-03 — Enkripsi refresh token Google menggunakan format `v1.<iv>.<tag>.<ciphertext>` dengan AES-256-GCM diletakkan pada `src/common/crypto/` agar dapat digunakan bersama oleh modul Storage di M5.
- 2026-11-03 — Throttler rate limiting pada testing dinonaktifkan secara selektif via `AppThrottlerGuard.shouldSkip()` kecuali pada test khusus yang memverifikasi respon 429 (`THROTTLER_FORCE_ENABLED=true`), menjaga suite e2e tetap deterministik tanpa jeda waktu buatan.

## Catatan untuk pemilik (hal yang perlu dipelajari dari task yang dikerjakan agent)

1. **OAuth 2.0 Authorization Code Flow di Backend (`src/auth/google/real-google-oauth.service.ts`)**:
   - Berbeda dari login biasa di mana frontend mengirim token mentah, DayDone menggunakan *authorization code flow*. Frontend hanya menerima kode otorisasi sementara dari popup Google, lalu backend menukarkannya langsung ke Google server-to-server. Dengan cara ini, `client_secret` tetap aman di server dan refresh token Google yang berumur panjang tidak pernah lewat di browser pengguna.

2. **Manajemen Sesi Opaque & Hash SHA-256 (`src/auth/sessions/sessions.service.ts`)**:
   - Refresh token sesi adalah string acak 32-byte (256-bit entropy). Server **tidak pernah menyimpan token asli di database**, melainkan hanya nilai hash SHA-256-nya (mirip dengan hashing password). Jika database bocor, penyerang tidak dapat menggunakan hash tersebut untuk membuat sesi baru.
   - Rotasi token mengimplementasikan *reuse detection*: jika ada pihak yang mencoba memakai token yang sudah terotasi (`replacedById` tidak kosong), sistem langsung mencabut seluruh sesi aktif user tersebut.

3. **Enkripsi Simetris AES-256-GCM (`src/common/crypto/encryption.service.ts`)**:
   - AES-256-GCM adalah enkripsi terotentikasi (*Authenticated Encryption with Associated Data* / AEAD). Format `v1.<iv>.<tag>.<ciphertext>` menjamin bahwa data tidak hanya terenkripsi tetapi juga terlindungi dari modifikasi/tampering (jika ciphertext atau auth tag diubah 1 bit saja, proses dekripsi akan menolaknya).

4. **Proteksi CSRF Header & Cookie HttpOnly (`src/auth/auth.controller.ts`)**:
   - Web menyimpan refresh token di cookie `daydone_rt` dengan flag `HttpOnly` (tidak bisa dibaca oleh JavaScript jahat via XSS).
   - Untuk mencegah serangan CSRF pada endpoint sensitif (`/refresh` dan `/logout`), controller mewajibkan header kustom `X-Requested-With: daydone-web`. Browser melarang situs pihak ketiga mengirim header kustom tanpa izin preflight CORS.

5. **Penggantian Guard Global ke `JwtAuthGuard` (`src/auth/guards/jwt-auth.guard.ts`)**:
   - `DevAuthGuard` sementara kini telah digantikan oleh `JwtAuthGuard` resmi. Setiap request yang masuk ke endpoint terlindungi memverifikasi tanda tangan kriptografis JWT sekaligus memastikan status sesi di database masih aktif (`revokedAt === null`).
