# Progress

> Diperbarui oleh agent atau pemilik setiap selesai task. Kode di repo adalah sumber kebenaran; bila berbeda dengan catatan ini, perbaiki catatan ini.

**Terakhir diperbarui:** 5 November 2026 (penyelesaian Milestone M7 - Fase B)

## Status per milestone

| Milestone | Status |
|---|---|
| M0 Fondasi monorepo | Selesai |
| M1 CRUD logbook di memori | Selesai |
| M2 Konfigurasi dan database | Selesai |
| M3 Logbook di database | Selesai |
| M4 Autentikasi Google + sesi | Selesai |
| M5 Google Drive dan lampiran | Selesai |
| M6 Pengerasan backend | Selesai sebagian — M6-1 s.d. M6-5 selesai, M6-6 ditunda ke M9 |
| M7 Paket shared dan web dashboard | Sedang berjalan — Fase B selesai |
| M8 Aplikasi mobile | Belum dimulai |
| M9 Rilis & Deploy produksi | Belum dimulai |

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
- [x] M4-6 Halaman uji interaktif di `apps/api/tools/google-login-test/index.html` menggunakan Google Identity Services (GIS popup) diverifikasi langsung oleh pemilik menggunakan akun Google sungguhan (login Google popup, inspeksi profil `/auth/me`, rotasi token cookie `/auth/refresh`, pencabutan seluruh sesi pada deteksi reuse, dan logout membersihkan cookie terkonfirmasi sukses).
- [x] M4-7 Rate limiting `@nestjs/throttler` (global 100/menit, `/auth/*` 10/menit) dengan `AppThrottlerGuard` yang fleksibel untuk pengujian. Unit test (91 tests) dan E2E test (33 tests) lolos 100%.
- [x] M4-Refinements (Penyelarasan Kontrak & Uji Manual):   
  - Penyelarasan status HTTP `POST /auth/google` dan `POST /auth/refresh` ke `200 OK` (`@HttpCode(HttpStatus.OK)`) sesuai `docs/04-api-spec.md`.
  - Penambahan field standar `error` (e.g. `"Conflict"`, `"Unauthorized"`) pada `DomainException` sesuai format error `docs/04-api-spec.md` + unit test.
  - Sentralisasi opsi Set-Cookie `daydone_rt` (`path: '/api/v1/auth'`, `httpOnly`, `sameSite`, `secure`, `maxAge`) via helper `getCookieOptions()` untuk memastikan pergantian cookie konsisten di browser tanpa duplikasi.
  - Pengujian E2E refresh berturut-turut pada web (`login -> refresh -> refresh lagi dengan cookie yang baru dirotasi -> keduanya 200`).

### M5
- [x] M5-1 Interface `StorageProvider` (`src/storage/storage.interface.ts`) + `InMemoryStorageProvider` untuk pengujian unit & E2E tanpa ketergantungan Google API.
- [x] M5-2 `GoogleDriveStorage` (`src/storage/google-drive.storage.ts`): autentikasi per user menggunakan refresh token yang didekripsi AES-256-GCM, retry backoff eksponensial (429/5xx), dan pemetaan error aman (`invalid_grant` -> 409 `DRIVE_RECONNECT_REQUIRED`, kuota penuh -> 507 `DRIVE_STORAGE_FULL`, fallback -> 502 `DRIVE_UNAVAILABLE`).
- [x] M5-3 `ensureAppFolder`: pembuatan folder aplikasi "DayDone" otomatis saat login pertama dan sebelum unggah. Aman terhadap race condition paralel via update kondisional (`updateMany({ where: { id, driveFolderId } })`). Jika folder di Drive dipindah ke Trash (`files.get` trashed: true) atau 404, sistem otomatis membuat folder baru.
- [x] M5-4 `ImageProcessorService` (`src/attachments/image-processor.service.ts`): konkurensi dibatasi `pLimit(2)`, auto-rotate EXIF orientation, resize batas dalam 2048x2048 px (`withoutEnlargement: true`), stripping seluruh EXIF metadata (termasuk koordinat GPS demi privasi), serta konversi pintar (PNG dipertahankan hanya bila memiliki transparansi `!isOpaque`, PNG opak dikonversi ke JPEG mozjpeg q82).
- [x] M5-5 Signed URL HMAC-SHA256 (`src/attachments/signed-url.service.ts`): URL bertanda tangan dengan verifikasi `timingSafeEqual` yang dilindungi oleh masa aktif pendek (5 menit; URL dapat dipakai ulang selama masa berlaku belum habis).
- [x] M5-6 `POST /logs/:id/attachments` (`src/attachments/attachments.service.ts`): alur all-or-nothing (validasi driveStatus -> validasi batas total <= 5 foto -> proses semua file via Sharp -> unggah Drive -> simpan DB dalam transaksi; kompensasi trash otomatis di Drive bila ada kegagalan).
- [x] M5-7 Endpoint konten publik bertanda tangan `GET /attachments/:id/content?token=...` (`StreamableFile`, `Cache-Control: private, max-age=300`, `X-Content-Type-Options: nosniff`) dan `GET /attachments/:id/url`.
- [x] M5-8 `DELETE /attachments/:id`: hapus lampiran dari database, rapikan kembali urutan nomor posisi (`position`), dan pindahkan file ke Trash Google Drive. Penghapusan logbook (`DELETE /logs/:id`) otomatis memindahkan seluruh file lampirannya ke Trash.
- [x] M5-9 `DELETE /users/me`: hapus akun pengguna permanen dengan konfirmasi `{ confirm: "HAPUS" }`, cabut token Google best-effort, cascade delete di database, dan hapus cookie sesi web tanpa menghapus file di Google Drive.
- [x] M5-Uji Manual Fase B (Verifikasi langsung oleh pemilik proyek dengan Google Drive sungguhan):
  - a. Foto kamera HP (resize + GPS hilang): OK
  - b. URL setelah 5 menit -> 401 Unauthorized: OK
  - c. Hapus foto -> file berpindah ke Trash Google Drive: OK
  - d. Cabut akses di Google -> 409 `DRIVE_RECONNECT_REQUIRED` -> login ulang memulihkan sesi: OK
  - e1. Folder dipindah ke Trash -> terdeteksi `files.get` id,trashed -> folder baru otomatis dibuat: OK
  - e2. Folder dihapus permanen -> 404 -> folder otomatis dibuat ulang saat unggah: OK
  - f. Validasi file (file ke-6 tolak 409 / file > 10 MB tolak 413 / bukan gambar tolak 415): OK
  - g. Hapus logbook berfoto -> seluruh file terkait di Google Drive berpindah ke Trash: OK
  - h. Hapus akun penguji (`DELETE /users/me`): OK

- [x] M6-1 Keamanan HTTP: `helmet` (`crossOriginResourcePolicy: { policy: 'cross-origin' }`, CSP false), konfigurasi `trust proxy` via env `TRUST_PROXY` (default 0), CORS dari `CORS_ORIGINS`, `app.enableShutdownHooks()`, serta e2e test throttler yang membedakan IP via `X-Forwarded-For` saat trust proxy aktif.
- [x] M6-2 OpenAPI / Swagger: terpasang `@nestjs/swagger`, rute interaktif di `/api/docs` dan spesifikasi JSON di `/api/docs-json`, dikontrol via `SWAGGER_ENABLED` (default true di non-prod). Seluruh endpoint didekorasi lengkap dengan skema autentikasi (Bearer JWT, Cookie `daydone_rt`), header `X-Requested-With`, multipart upload, dan kode error `ErrorCode` sesuai `docs/04-api-spec.md`.
- [x] M6-3 Structured Logging: terpasang `nestjs-pino`, `pino-http`, dan `pino-pretty` (dev). Request ID tracing (`X-Request-Id` otomatis dibuatkan UUID bila tidak ada dan dikembalikan di header response). Redaksi data sensitif otomatis untuk header (`authorization`, `cookie`, `set-cookie`), body request (`code`, `refreshToken`, `confirm`), dan custom URL serializer untuk query parameter `token` pada URL streaming lampiran (`token=[REDACTED]`).
- [x] M6-4 CI GitHub Actions (`.github/workflows/ci.yml`): otomatis terpicu pada push/PR ke `main`, menggunakan Node.js 24, pnpm 12.16.1, caching store, service container Postgres 17, `pnpm install --frozen-lockfile`, `prisma migrate deploy`, lint, build, unit test, e2e test, dan `pnpm audit --audit-level high`. Kerentanan transitif pada `undici` dan `tmp` diatasi dengan override root.
- [x] M6-5 Multi-stage Dockerfile: berbasis `node:24-slim`, 4-stage (`base`, `builder`, `deployer`, `runner`), menggunakan corepack pnpm, isolasi dependensi via `pnpm deploy --prod`, container berjalan sebagai user non-root `node`, script `start:prod` (`prisma migrate deploy && node dist/main.js`), dan `.dockerignore` ketat tanpa kebocoran secret atau artifact lokal.
- [ ] M6-6 Deploy API staging (Render / Railway) — *ditunda ke M9 sebagai M9-0*.

### M7 (Fase A — Fondasi Shared & Web)
- [x] M7-1 Inisialisasi `packages/shared` (`@daydone/shared`):
  - Skema Zod request dipindahkan dari `apps/api` (`log`, `auth`, `delete-user`).
  - Tipe domain dan response (`User`, `UserProfileResponse`, `DriveStatus`, `Log`, `LogListItem`, `Attachment`, `Paginated<T>`, `ApiError`).
  - Enum `ErrorCode` dan peta terpusat pesan bahasa Indonesia `ERROR_MESSAGES` + helper `getErrorMessage`.
  - Konstanta domain (`MAX_ATTACHMENTS = 5`, `MAX_FILE_SIZE_BYTES = 10 MB`, `MAX_DESCRIPTION_LENGTH = 5000`, MIME type, nama cookie, durasi signed URL).
  - Build ESM via `tsc` menghasilkan `dist/` dan deklarasi tipe `.d.ts`. Satu versi Zod untuk monorepo.
  - `apps/api` mengimpor dari `@daydone/shared` via `workspace:*`, menghilangkan duplikasi kode.
- [x] M7-2 Scaffold `apps/web`:
  - Vite + React 19 + TypeScript strict + Tailwind CSS v4 + React Router v7 + TanStack Query v5 + Lucide Icons.
  - Konfigurasi dev server port 5173 dengan `strictPort: true` (origin Google OAuth).
  - Setup pengujian unit & komponen via Vitest + Testing Library.
  - Template environment `.env.example` (`VITE_API_URL`, `VITE_GOOGLE_WEB_CLIENT_ID`).
- [x] M7-3 API Client (`apps/web/src/api/`):
  - Klien fetch terpusat dengan base URL dari env.
  - Penyimpanan token akses **HANYA di memori** (`accessToken` dan `currentUser`), dilarang localStorage/sessionStorage.
  - Header otomatis `Authorization: Bearer <token>` dan `credentials: 'include'`.
  - Header proteksi CSRF `X-Requested-With: daydone-web` untuk rute autentikasi (`/auth/refresh`, `/auth/logout`).
  - Single-flight refresh token: promise refresh bersama di tingkat modul. Menangani multiple concurrent 401s dan bootstrap ganda (misal React StrictMode) hanya dengan 1 panggilan ke server.
  - Penanganan error terstruktur via subclass `ApiError` dengan pemetaan pesan ramah bahasa Indonesia.
- [x] M7-4 Autentikasi Web & Routing:
  - Bootstrap otomatis saat aplikasi dibuka: memanggil `/auth/refresh` lalu `/auth/me` untuk memulihkan sesi dari cookie HttpOnly, disertai layar loading (`LoadingScreen`).
  - Halaman login (`/login`): tombol "Masuk dengan Google" memanfaatkan Google Identity Services (GIS popup `initCodeClient`) dengan scope `openid email profile drive.file`, platform `WEB`, redirectUri `postmessage`.
  - Protected routes (`ProtectedRoute`) dan public-only routes (`PublicRoute`).
  - Aksi logout (`POST /auth/logout`) yang membersihkan sesi di memori dan mengarahkan kembali ke `/login`.
- [x] M7-5 Pembaruan Build & Dockerfile:
  - Dockerfile multi-stage diperbarui untuk menyertakan `packages/shared` dan mem-build-nya sebelum `apps/api`.
  - `pnpm build`, `pnpm lint`, dan `pnpm test` lolos 100% di seluruh paket monorepo.

### M7 (Fase B — Fitur Logbook Web Dashboard)
- [x] M7-6 Helper Tanggal Lokal & Format Indonesia (`apps/web/src/lib/date.ts`):
  - `getTodayLocalDateString()` menghitung tanggal lokal `YYYY-MM-DD` perangkat tanpa offset UTC.
  - `parseLocalDate()` mencegah pergeseran zona waktu saat parsing `YYYY-MM-DD`.
  - Format Indonesia berbasis `Intl.DateTimeFormat('id-ID')`.
- [x] M7-7 TanStack Query Hooks (`apps/web/src/api/logs.ts`):
  - `useLogsList`, `useLogByDate`, `useLogDetail`, `useCreateLog`, `useUpdateLog`, `useDeleteLog` dengan invalidasi otomatis.
- [x] M7-8 Layout Responsif & Header (`apps/web/src/components/layout/app-layout.tsx`):
  - Sticky header dengan `UserAvatar` (fallback inisial), badge status Drive, dan tombol Logout.
- [x] M7-9 Kartu "Hari Ini" (`apps/web/src/components/dashboard/today-card.tsx`):
  - Deteksi logbook hari ini (`GET /logs/by-date/:today`), menampilkan ajakan menulis bila belum ada atau tautan detail bila sudah dibuat.
- [x] M7-10 Daftar Logbook, Filter & Paginasi (`apps/web/src/pages/dashboard-page.tsx`):
  - Input pencarian (debounce 300ms) + filter tanggal `from` dan `to` (max = hari ini).
  - State filter dan nomor halaman tersimpan di URL search params (`useSearchParams`) sehingga tombol Back mempertahankan kondisi filter sebelumnya; perubahan filter otomatis mereset halaman ke 1.
  - `LogCard` menampilkan tanggal lokal, snippet deskripsi, jumlah foto, dan thumbnail foto pertama dengan fallback placeholder.
  - State `EmptyState` (untuk daftar kosong atau pencarian nihil), `ErrorState` (dengan tombol "Coba Lagi"), dan `ListSkeleton`.
- [x] M7-11 Form Buat & Ubah Logbook (`apps/web/src/pages/log-form-page.tsx`):
  - Validasi Zod DTO dari `@daydone/shared` via custom `zodResolver` kompatibel Zod 4.
  - Tanggal TIDAK di-disable pada mode ubah (mendukung US-07).
  - Input tanggal dibatasi `max = hari ini` lokal.
  - Counter karakter deskripsi (`X / 5000`).
  - Penanganan error 409 `LOG_DATE_CONFLICT` pada mode buat maupun ubah dengan pesan jelas dan tautan "Buka logbook tanggal itu" (`existingLogId`).
  - Tombol Simpan disabled saat mutasi berjalan untuk mencegah klik ganda.
  - Konfirmasi unsaved changes via `useBlocker` React Router dan event `beforeunload`.
- [x] M7-12 Detail Logbook & Hapus (`apps/web/src/pages/log-detail-page.tsx`):
  - Deskripsi disajikan sebagai teks murni (`whitespace-pre-wrap`), dilarang `dangerouslySetInnerHTML`.
  - Halaman 404 ramah pengguna (`NotFoundState`) saat logbook tidak ditemukan.
  - Dialog konfirmasi hapus modal (`ConfirmModal`) sebelum mutasi `DELETE /logs/:id`.
- [x] M7-Fase B Verifikasi Manual (Dikonfirmasi oleh pemilik):
  - Buat logbook baru & sinkronisasi navigasi: OK
  - Detail logbook menampilkan tanggal dan deskripsi: OK
  - Ubah logbook & Hapus logbook: OK
  - Penyelarasan kontrak response logbook tunggal (objek `Log` langsung tanpa wrapper `data`): OK

## Task berikutnya untuk agent

1. Tunggu persetujuan/instruksi dari pemilik untuk memulai **Milestone M7 Fase C — Foto, Google Drive & Pengaturan Akun**:
   - Transaksi penguncian baris logbook `SELECT ... FOR UPDATE` di backend `AttachmentsService` untuk mencegah race condition kuota 5 foto.
   - Unggah foto (US-09): drag-and-drop / file picker, validasi klien (ukuran, kuota, MIME), unggah satu per satu dengan XMLHttpRequest progress bar.
   - Galeri foto penuh + lightbox, hapus foto (US-10).
   - Penanganan signed URL kedaluwarsa: refetch detail bila `<img>` gagal dimuat (staleTime < 5 menit).
   - Banner Google Drive (US-11): NOT_CONNECTED -> hubungkan, NEEDS_RECONNECT -> modal instruksi & hubungkan ulang.
   - Halaman pengaturan & hapus akun permanen (US-12).

## Kredensial dan akses yang dibutuhkan dari pemilik

| Kebutuhan | Untuk | Status |
|---|---|---|
| Connection string Supabase | M2 | Sudah diberikan (aktif & terverifikasi) |
| OAuth client Web (ID + secret) dari Google Cloud | M4 | Sudah diisi pemilik di `.env` lokal |
| Kunci rahasia JWT & Enkripsi token | M4 | Sudah diisi pemilik di `.env` lokal |
| Akun Google penguji terdaftar sebagai test user | M4–M5 | Tersedia di Google Cloud Console |
| Akun Render | M6 | Ditunda ke M9 |
| Akun Vercel | M7 | Ada (terlihat di bookmark) |
| Akun Expo | M8 | Belum dipastikan |

## Keputusan kecil selama pengembangan

Catat di sini keputusan yang tidak cukup besar untuk ADR (format: tanggal — keputusan — alasan).

- 2026-11-02 — Satu logbook per hari (`@@unique([userId, date])`) — kebutuhan umum logbook magang; dapat ditinjau ulang (PRD Q2).
- 2026-11-02 — Upload foto lewat API untuk MVP — lebih sederhana; API tidak di Vercel jadi tidak terkena batas body 4,5 MB.
- 2026-11-02 — Route `by-date/:date` diletakkan sebelum `:id` di `LogsController` — secara teknis NestJS dapat membedakannya karena jumlah segmen path berbeda (`/logs/by-date/:date` 2 segmen vs `/logs/:id` 1 segmen), namun urutan ini tetap dipertahankan demi keterbacaan kode dan konsistensi struktur rute.
- 2026-11-03 — RLS diaktifkan tanpa policy pada tabel (`users`, `sessions`, `log_entries`, `attachments`) — memblokir akses langsung PostgREST publik Supabase dengan anon key; Prisma tetap jalan karena terhubung sebagai role superuser/owner `postgres`.
- 2026-11-03 — Perintah seeder di Prisma 7 dikonfigurasi pada `prisma.config.ts` di bawah properti `migrations.seed` menggunakan runner `tsx prisma/seed.ts` agar import ESM `.js` terpetakan secara otomatis ke file TypeScript.
- 2026-11-03 — Penanganan P2002 untuk duplikat tanggal ditangani khusus di `LogsService` (bukan filter global biasa), sehingga API dapat mengembalikan `code: "LOG_DATE_CONFLICT"` beserta payload `"existingLogId"` yang spesifik sesuai kontrak `docs/04-api-spec.md`.
- 2026-11-03 — Batas toleransi tanggal logbook masa depan dihitung dinamis di dalam `.refine()` pada saat validasi dieksekusi (bukan konstanta tingkat modul) untuk menjamin akurasi waktu server dan toleransi zona waktu UTC + 1 hari.
- 2026-11-03 — Guard keselamatan database lokal (`db-safety-guard.ts`): seluruh skrip tes E2E dan operasi reset diproteksi keras dari eksekusi ke database non-localhost atau host Supabase untuk mencegah insiden penghapusan data produksi.
- 2026-11-03 — Deteksi pemakaian ulang refresh token (token reuse) dilakukan secara atomik menggunakan update kondisional `updateMany({ where: { id, revokedAt: null } })`. Bila `count === 0`, server langsung mencabut seluruh sesi aktif user di database untuk memitigasi pencurian sesi saat terjadi race condition.
- 2026-11-03 — Endpoint `POST /auth/logout` dijadikan `@Public()` dan diidentifikasi via refresh token (cookie atau body) agar pengguna tetap bisa logout dengan aman meskipun token akses JWT telah kedaluwarsa.
- 2026-11-03 — Enkripsi refresh token Google menggunakan format `v1.<iv>.<tag>.<ciphertext>` dengan AES-256-GCM diletakkan pada `src/common/crypto/` agar dapat digunakan bersama oleh modul Storage di M5.
- 2026-11-03 — Throttler rate limiting pada testing dinonaktifkan secara selektif via `AppThrottlerGuard.shouldSkip()` kecuali pada test khusus yang memverifikasi respon 429 (`THROTTLER_FORCE_ENABLED=true`), menjaga suite e2e tetap deterministik tanpa jeda waktu buatan.
- 2026-11-03 — Penyelarasan status response Auth ke 200 OK dan ekstraksi helper cookie `getCookieOptions()` — memastikan atribut Set-Cookie identik pada saat login dan refresh sehingga browser me-replace cookie secara bersih, serta memenuhi kontrak `docs/04-api-spec.md`.
- 2026-11-03 — Penyertaan field `error` pada `DomainException` — menyelaraskan struktur payload JSON error domain dengan format resmi HttpException NestJS dan `docs/04-api-spec.md`.
- 2026-11-03 — Pemrosesan PNG di `ImageProcessorService`: format PNG dipertahankan hanya bila gambar benar-benar memiliki piksel transparan (`!stats.isOpaque`). PNG opak (RGBA dengan 100% opacity) dikonversi ke JPEG mozjpeg kualitas 82 demi penghematan ukuran file dan kuota Google Drive.
- 2026-11-03 — Verifikasi folder Google Drive sebelum unggah: memeriksa bahwa folder aplikasi ada dan tidak berstatus trashed (`files.get` fields `id,trashed`). Bila trashed atau 404, dibuat folder baru otomatis dengan pembaruan bersyarat untuk menghindari konflik konkurensi.
- 2026-11-03 — Penyeragaman DTO `AttachmentResponse`: menghilangkan properti `createdAt` dari response `POST /logs/:id/attachments` agar bentuknya konsisten 100% dengan objek lampiran pada `GET /logs` dan `GET /logs/:id` sesuai kontrak `docs/04-api-spec.md`.
- 2026-11-04 — Kebijakan Helmet CORP cross-origin dan CSP false: memungkinkan elemen `<img>` web frontend lintas origin memuat gambar lampiran dan Swagger UI dapat menyajikan static assets tanpa hambatan.
- 2026-11-04 — Pengendalian Trust Proxy melalui `TRUST_PROXY`: Express hanya memercayai hop proxy terpercaya (misal 1 di Render) sehingga `req.ip` membaca client IP asli dan mencegah IP spoofing atau shared throttling lockout.
- 2026-11-04 — Failsafe dekripsi Google refresh token: menghindari unhandled crash 500 jika encryption key berganti atau ciphertext rusak; sistem otomatis menandai `NEEDS_RECONNECT`, menghapus token rusak, dan mengembalikan 409 `DRIVE_RECONNECT_REQUIRED`.
- 2026-11-04 — Redaksi otomatis token HMAC pada query URL logging: serializer Pino mendeteksi parameter `token` pada `/attachments/:id/content?token=...` dan menggantinya menjadi `[REDACTED]` agar secret HMAC tidak tersimpan di log server.
- 2026-11-04 — Override pnpm untuk `undici` dan `tmp`: konfigurasi `overrides` di root `package.json` dan `pnpm-workspace.yaml` mengeliminasi 8 kerentanan keamanan tingkat high pada dependensi transitif `@nestjs/mau`.
- 2026-11-05 — Deploy staging API ditunda ke M9 — kendala kartu kredit (Render) dan healthcheck gagal (Railway); pengembangan web (M7) dan mobile (M8) memakai API lokal (`http://localhost:3000`).
- 2026-11-05 — Catatan dugaan penyebab gagal di Railway untuk M9 — image produksi Docker dibuat dengan `pnpm --filter api deploy --prod` sehingga binary CLI `prisma` (`devDependencies`) kemungkinan tidak disertakan ke `/prod/api`, menyebabkan `start:prod` (`prisma migrate deploy && node dist/main.js`) gagal saat kontainer runtime menyala. Hipotesis ini belum diverifikasi; cek Deploy Logs saat mencoba deployment kembali di M9.
- 2026-11-05 — Akses token web hanya di memori — `localStorage` dan `sessionStorage` tidak dipakai demi memitigasi risiko pencurian token melalui celah XSS.
- 2026-11-05 — Single-flight refresh di API client web — promise refresh bersama di tingkat modul mencegah race condition dan kegagalan rotasi refresh token akibat request paralel atau React StrictMode.
- 2026-11-05 — Pemakaian Google Identity Services (GIS) `initCodeClient` langsung tanpa library wrapper — menghindari konflik peer-dependency React 19 dan menjaga integrasi popup tetap transparan serta konsisten dengan uji M4.
- 2026-11-05 — Serialisasi refresh token lintas tab dengan Web Locks API — membungkus pemanggilan `/auth/refresh` dengan `navigator.locks.request('daydone-refresh', ...)` agar refresh dari beberapa tab berjalan bergantian; tab yang menunggu secara otomatis menggunakan cookie hasil rotasi tab sebelumnya, dengan fallback graceful bila API tidak didukung browser.
- 2026-11-05 — Parameter filter logbook disimpan di URL search params (`useSearchParams`) — memastikan tombol browser Back mengembalikan state daftar yang sama persis dan memudahkan pembagian link.
- 2026-11-05 — Tanggal logbook dapat diubah pada mode edit — mematuhi US-07 dan kemampuan endpoint PATCH /logs/:id, dengan penanganan konflik 409 yang identik dengan mode buat.
- 2026-11-05 — Custom Zod resolver untuk react-hook-form — mengatasi ketidakcocokan format error internal antara Zod v4 (issues) dan @hookform/resolvers/zod v3 (errors).
- 2026-11-05 — Penyelarasan kontrak API entitas Log tunggal di web client — endpoint log tunggal (GET /logs/:id, GET /logs/by-date/:date, POST /logs, PATCH /logs/:id) mengembalikan objek Log langsung tanpa pembungkus { data: Log }, berbeda dari paginated list (GET /logs) yang memiliki wrapper { data, meta }.

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

6. **File Interceptor & Multer Exception Filter (`src/logs/logs.controller.ts`, `src/common/filters/multer-exception.filter.ts`)**:
   - NestJS mengintegrasikan Multer melalui decorator `@UseInterceptors(FilesInterceptor('files', 5, { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))`.
   - File foto disimpan di memori RAM sebagai `Buffer` (bukan disk fisik server), menjadikan aplikasi stateless dan siap di-deploy ke container serverless.
   - Error bawaan Multer (seperti `LIMIT_FILE_SIZE` atau `LIMIT_FILE_COUNT`) otomatis ditangkap oleh filter global `MulterExceptionFilter` dan diubah menjadi response standar DayDone (`413 FILE_TOO_LARGE` atau `409 ATTACHMENT_LIMIT_REACHED`).

7. **StreamableFile & Streaming Media (`src/attachments/attachments.controller.ts`)**:
   - Saat browser memuat gambar melalui signed URL, API tidak membaca seluruh file ke memori Node.js sebelum mengirimkannya. Sebaliknya, API menggunakan `StreamableFile(Readable)` untuk mengalirkan (*pipe*) stream biner langsung dari Google Drive ke koneksi HTTP client.
   - Header keamanan ditambahkan secara otomatis: `Cache-Control: private, max-age=300` (cache privat 5 menit) dan `X-Content-Type-Options: nosniff` (mencegah browser mengeksekusi file sebagai script).

8. **Abstraksi Storage & Token Injeksi (`src/storage/storage.interface.ts`, `src/storage/storage.module.ts`)**:
   - Menerapkan prinsip *Dependency Inversion* (SOLID). Modul bisnis (`LogsModule` & `AttachmentsModule`) tidak memanggil library `@googleapis/drive` secara langsung, melainkan bergantung pada interface `StorageProvider` melalui token injeksi `STORAGE_PROVIDER`.
   - Hal ini memungkinkan sistem pengujian berjalan 100% deterministik dan super cepat menggunakan `InMemoryStorageProvider`, tanpa perlu koneksi internet atau akun Google Drive sungguhan.

9. **Signed URL HMAC-SHA256 Berumur Pendek (`src/attachments/signed-url.service.ts`)**:
   - Tag HTML `<img>` di browser tidak dapat mengirim header kustom `Authorization: Bearer <token>`.
   - Untuk mengamankan akses file tanpa membuat file menjadi publik, server membuat URL bertanda tangan kriptografis berumur 5 menit: `token = base64url(payload) + "." + base64url(HMAC)`.
   - Verifikasi token memvalidasi integritas HMAC menggunakan `crypto.timingSafeEqual` untuk mencegah *timing attack*, serta memastikan waktu kedaluwarsa belum lewat.

10. **Pola Kompensasi (All-or-Nothing Saga) (`src/attachments/attachments.service.ts`)**:
    - Operasi unggah melibatkan dua sistem terpisah: Google Drive dan PostgreSQL. Karena Google Drive tidak mendukung transaksi database ACID, kegagalan di tengah jalan (misal file ke-3 gagal diproses atau insert database error) ditangani dengan pola kompensasi: seluruh file yang sudah terlanjur terunggah ke Drive otomatis dipindahkan ke Trash (`storageProvider.trash()`), mencegah timbulnya file sampah yatim piatu (*orphan files*).

11. **Pembaruan Bersyarat untuk Menghindari Race Condition (`src/storage/google-drive.storage.ts`)**:
    - Saat membuat folder aplikasi pertama kali atau membuat ulang folder yang terhapus/di-trash, beberapa request paralel dapat berjalan bersamaan.
    - Masalah ini diatasi menggunakan pembaruan bersyarat Prisma: `updateMany({ where: { id: userId, driveFolderId: oldFolderId }, data: { driveFolderId: newFolderId } })`.
    - Hanya request yang memenangkan balapan yang mendapat `count === 1`. Request lain yang mendapat `count === 0` langsung memindahkan folder buatannya ke Trash dan memakai folder yang sudah tersimpan di database.

12. **Helmet & Header Keamanan Web Modern (`apps/api/src/main.ts`)**:
    - Helmet memasang header HTTP standar untuk melindungi aplikasi dari kerentanan umum (seperti MIME sniffing dengan `X-Content-Type-Options: nosniff` dan clickjacking).
    - Pengaturan `crossOriginResourcePolicy: { policy: 'cross-origin' }` krusial agar gambar yang disajikan endpoint DayDone dapat dimuat oleh tag `<img>` di browser pada origin yang berbeda (misalnya domain frontend web).
    - `contentSecurityPolicy: false` dipilih pada tingkat REST API agar aset script & style Swagger UI tidak terblokir oleh browser.

13. **Reverse Proxy Trust & Throttler Accuracy (`TRUST_PROXY`)**:
    - Di lingkungan produksi (seperti Render atau cloud hosting lain), aplikasi berjalan di balik reverse proxy / load balancer.
    - Tanpa setting `trust proxy`, Express membaca semua request seolah-olah berasal dari IP internal reverse proxy. Akibatnya, satu pengguna yang memicu rate limit dapat memblokir semua pengguna lainnya!
    - Dengan menyetel `TRUST_PROXY=1`, Express membaca header `X-Forwarded-For` secara aman dari 1 hop terpercaya, sehingga Throttler membatasi request per IP pengguna asli.

14. **Logging Terstruktur dengan Redaksi Data Sensitif (`src/config/logger.config.ts`)**:
    - `nestjs-pino` menghasilkan log berformat JSON terstruktur di production/staging dan tampilan berwarna yang mudah dibaca (`pino-pretty`) di development.
    - Setiap baris log diberi pelacak `reqId` (menggunakan header `X-Request-Id` jika ada, atau generate UUID otomatis) dan header tersebut dikirim kembali ke client untuk memudahkan troubleshooting end-to-end.
    - Redaksi otomatis (`redact.paths` dan custom serializer) menjamin data sensitif seperti password, authorization header, token sesi cookie, payload autentikasi, serta query token URL gambar disensor menjadi `[REDACTED]`.

15. **OpenAPI / Swagger Tanpa Class-Validator (`src/**/*.controller.ts`)**:
    - DayDone menggunakan Zod untuk validasi input (bukan `class-validator`).
    - Dokumentasi Swagger dibuat menggunakan decorator `@nestjs/swagger` di controller (`@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth`, `@ApiCookieAuth`) serta skema OpenAPI manual pada payload kompleks.
    - Ini menghasilkan dokumentasi interaktif di `/api/docs` dan spesifikasi JSON di `/api/docs-json` tanpa perlu mengubah arsitektur validasi Zod.

16. **Multi-stage Dockerfile dengan Isolasi `pnpm deploy` (`Dockerfile`)**:
    - Image Docker akhir hanya berukuran minimal dan bersih dari secret atau file pengembangan (`.env*`, file test, source code TypeScript mentah).
    - Menggunakan fitur `pnpm --filter api deploy --prod /prod/api` untuk menyalin hanya dependensi produksi (tanpa `devDependencies` seperti test runner atau linters).
    - Menjalankan kontainer sebagai user non-root `node` untuk mematuhi prinsip least privilege dan mengurangi risiko keamanan kontainer.

17. **Single-Flight Promise untuk Token Refresh di Frontend (`apps/web/src/api/client.ts`)**:
    - Saat browser mengirim beberapa request API bersamaan dan access token telah habis, seluruh request akan menerima status `401 Unauthorized` serentak.
    - Jika masing-masing request memanggil `/auth/refresh` sendiri-sendiri, refresh token pertama akan merotasi cookie sesi, sedangkan request kedua akan mengirim token yang baru saja hangus sehingga memicu *reuse detection* (yang mencabut seluruh sesi pengguna di server!).
    - Pola *single-flight*: kita menyimpan variabel `refreshPromise` bersama di tingkat modul API client. Request pertama membuat promise refresh; request ke-2, ke-3, dst hanya ikut menunggu promise yang sama (`await refreshPromise`). Setelah selesai, promise di-reset ke `null` dan seluruh request diulang dengan token baru yang diperoleh.

18. **Penyimpanan Token Akses di Memori vs LocalStorage (`apps/web/src/api/client.ts`)**:
    - `localStorage` dan `sessionStorage` rentan dibaca oleh script apa pun yang dieksekusi di browser (misalnya celah XSS atau library pihak ketiga yang disusupi).
    - Dengan menyimpan access token hanya di variabel JavaScript (RAM browser), token tidak dapat diekstrak via storage inspector dan otomatis bersih saat tab browser ditutup.
    - Pemulihan sesi antar reload/buka tab baru dilakukan secara aman melalui cookie `daydone_rt` bertipe `HttpOnly`, `Path=/api/v1/auth`, dan `SameSite=Lax`. JavaScript tidak memiliki akses ke cookie ini, dan browser menyertakannya secara otomatis hanya saat memanggil rute autentikasi.

19. **Penyimpanan State Filter di URL Search Params (`apps/web/src/components/dashboard/log-filter-bar.tsx`)**:
    - Alih-alih menyimpan `search`, `from`, `to`, dan `page` hanya di React `useState`, menyimpannya di URL (`useSearchParams`) memberikan UX standar web: riwayat navigasi browser bekerja alami, tombol "Back" dari halaman detail tidak menghilangkan hasil pencarian, dan tautan halaman tertentu dapat di-bookmark atau dibagikan.

20. **Proteksi Form Kotor dengan `useBlocker` dan `beforeunload` (`apps/web/src/pages/log-form-page.tsx`)**:
    - SPA memiliki dua jenis navigasi: navigasi internal (SPA routing) dan navigasi browser (tutup tab / refresh / ketik URL baru).
    - `useBlocker` dari React Router data router memotong navigasi internal saat form berstatus `isDirty`, menampilkan modal dialog konfirmasi tanpa memicu reload halaman.
    - Event browser `window.addEventListener('beforeunload', ...)` melindungi saat pengguna tidak sengaja menutup tab atau menekan F5, sehingga draf catatan tidak hilang sia-sia.
