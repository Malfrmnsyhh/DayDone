# 09 — Roadmap dan Daftar Task

Setiap task punya ID, deskripsi, dan acceptance criteria (AC). Kerjakan berurutan kecuali disebutkan bisa paralel. Status terkini dicatat di `docs/progress.md`, bukan di sini.

---

## M0 — Fondasi monorepo

| ID | Task | Acceptance criteria |
|---|---|---|
| M0-1 | Inisialisasi monorepo pnpm (`pnpm-workspace.yaml`, `apps/`, `packages/`, `.gitignore` root) | `pnpm install` di root berhasil; `.env` dan `node_modules` diabaikan git |
| M0-2 | Generate NestJS di `apps/api` (ESM, Vitest, strict) | `pnpm start:dev` berjalan |
| M0-3 | Prefix `api/v1`, CORS | `GET /api/v1` merespons |
| M0-4 | Endpoint `GET /health` (sementara tanpa cek database) | Mengembalikan `{ status, timestamp }` |
| M0-5 | Script root: `dev`, `build`, `lint`, `test` yang meneruskan ke paket (`pnpm -r`) | Bisa dijalankan dari root |

## M1 — CRUD logbook di memori (tahap belajar)

| ID | Task | Acceptance criteria |
|---|---|---|
| M1-1 | `LogsModule` dengan schema Zod dan `StandardSchemaValidationPipe` global | Semua skenario tabel uji di sesi belajar lolos |
| M1-2 | Filter `search` di `GET /logs` | Pencarian tidak peka huruf besar/kecil |

M1 adalah tahap belajar pemilik proyek. Bila sudah selesai, kode ini menjadi dasar M3 (penyimpanan diganti Prisma, controller tetap).

## M2 — Konfigurasi dan database

| ID | Task | Acceptance criteria |
|---|---|---|
| M2-1 | `@nestjs/config` + validasi env dengan Zod (`src/config/env.schema.ts`), `.env.example` | App gagal start dengan pesan jelas bila env wajib hilang |
| M2-2 | Setup Prisma 7: `prisma.config.ts`, schema sesuai `docs/03-data-model.md`, adapter-pg, output `src/generated/prisma` | `prisma migrate dev --name init` sukses ke Supabase; tabel terlihat di dashboard Supabase |
| M2-3 | `PrismaModule` global + `PrismaService` | Bisa di-inject di service mana pun |
| M2-4 | Helper `src/common/date.ts` + unit test | Test tanggal batas lolos |
| M2-5 | Health check memeriksa database (`SELECT 1`) | `503` bila DB mati |
| M2-6 | Seed user dev + 10 logbook | `prisma db seed` berhasil di development |
| M2-7 | `docker-compose.yml` Postgres lokal untuk test | E2E bisa memakai DB lokal |

## M3 — Logbook di database

| ID | Task | Acceptance criteria |
|---|---|---|
| M3-1 | `DevAuthGuard` sementara + decorator `@CurrentUser()` | Hanya aktif di development dengan flag; app menolak start bila flag aktif di produksi |
| M3-2 | `LogsService` memakai Prisma, scoped `userId` | Semua endpoint Logs sesuai API spec |
| M3-3 | Paginasi + `meta`, validasi `from ≤ to`, batas tanggal masa depan | Sesuai API spec |
| M3-4 | `GET /logs/by-date/:date` | 200/404 sesuai spec |
| M3-5 | `DomainException`, daftar `ErrorCode`, filter error Prisma global | Duplikat tanggal → 409 `LOG_DATE_CONFLICT` + `existingLogId` |
| M3-6 | Mapper response (tanggal sebagai string, tanpa field internal) | Response sesuai spec |
| M3-7 | Unit + e2e test Logs (termasuk lintas pengguna dengan 2 user seed) | Matriks test Logs di `docs/08-testing.md` lolos |

## M4 — Autentikasi Google

Butuh: Google Cloud project dan OAuth client (lihat `docs/05-auth-and-storage.md` bagian 1). Bila belum ada, berhenti dan minta ke pemilik.

| ID | Task | Acceptance criteria |
|---|---|---|
| M4-1 | `EncryptionService` AES-256-GCM + test | Bolak-balik benar; ciphertext rusak ditolak |
| M4-2 | `GoogleOAuthService`: tukar code, verifikasi id_token, cek scope | Diuji dengan fake; pemeriksaan wajib di dokumen 05 terpenuhi |
| M4-3 | `SessionsService`: buat, rotasi, deteksi reuse, cabut | Test rotasi dan reuse lolos |
| M4-4 | `POST /auth/google`, `/auth/refresh`, `/auth/logout`, `GET /auth/me` | Sesuai spec, termasuk perilaku cookie web vs body mobile |
| M4-5 | `JwtAuthGuard` global + `@Public()`; hapus `DevAuthGuard` | Semua endpoint selain yang publik butuh token |
| M4-6 | Uji manual dengan halaman HTML sederhana (GIS popup) untuk mendapatkan code | Login sungguhan berhasil dan user tersimpan |
| M4-7 | Rate limit `/auth/*` | > 10/menit → 429 |

## M5 — Google Drive dan lampiran

| ID | Task | Acceptance criteria |
|---|---|---|
| M5-1 | Interface `StorageProvider` + `InMemoryStorageProvider` | Dipakai di test |
| M5-2 | `GoogleDriveStorage`: `ensureAppFolder`, `upload`, `download`, `trash`, pemetaan error | Folder `DayDone` dibuat saat login pertama |
| M5-3 | `ImageProcessor` (sharp) + batas konkurensi | Resize, rotate, strip EXIF terverifikasi test |
| M5-4 | `POST /logs/:id/attachments` | Batas jumlah/ukuran/tipe; kompensasi trash saat gagal |
| M5-5 | URL bertanda tangan + `GET /attachments/:id/content` + `GET /attachments/:id/url` | Token valid/rusak/kedaluwarsa diuji |
| M5-6 | URL lampiran disertakan di response Logs | Sesuai spec |
| M5-7 | `DELETE /attachments/:id` dan trash saat hapus logbook | File pindah ke Trash Drive |
| M5-8 | Alur `NEEDS_RECONNECT` | Uji manual dengan mencabut akses di akun Google |
| M5-9 | `DELETE /users/me` | Data terhapus, token dicabut |

## M6 — Pengerasan backend

| ID | Task | Acceptance criteria |
|---|---|---|
| M6-1 | `helmet`, throttler global, CORS dengan daftar origin dari env | Header keamanan muncul; origin lain ditolak |
| M6-2 | Swagger di `/api/docs` (non-produksi) | Semua endpoint terdokumentasi |
| M6-3 | Logging terstruktur dengan request id, redaksi data sensitif | Token tidak pernah muncul di log |
| M6-4 | CI GitHub Actions sesuai `docs/08-testing.md` | Pipeline hijau |
| M6-5 | Dockerfile API (multi-stage, `prisma generate` saat build, `migrate deploy` saat release) | Image berjalan lokal |
| M6-6 | Deploy API staging (Render/Railway, region Singapura) | `/health` hijau di URL publik |

## M7 — Paket shared dan web dashboard

| ID | Task | Acceptance criteria |
|---|---|---|
| M7-1 | `packages/shared` (`@daydone/shared`): schema Zod request, tipe response, konstanta; build dengan tsc/tsup ke ESM | API mengimpor schema dari paket ini; build API tetap lolos |
| M7-2 | Scaffold `apps/web` (Vite + React + TS, React Router, TanStack Query, Tailwind) | `pnpm dev` jalan di port 5173 |
| M7-3 | API client: access token di memori, auto-refresh sekali saat 401, `credentials: 'include'` | Sesi bertahan setelah reload halaman |
| M7-4 | Halaman login (Google auth-code popup) | Login sampai dashboard |
| M7-5 | Daftar logbook: filter tanggal, pencarian, paginasi, indikator jumlah foto | Sesuai US-05 |
| M7-6 | Form buat/ubah logbook (validasi dengan schema shared), tangani `LOG_DATE_CONFLICT` | Sesuai US-04, US-07 |
| M7-7 | Detail logbook + galeri foto + lightbox | Sesuai US-06 |
| M7-8 | Unggah foto dengan progres per file, kompresi di client (opsional), hapus foto | Sesuai US-09, US-10 |
| M7-9 | Banner hubungkan/hubungkan ulang Drive | Sesuai US-11 |
| M7-10 | Pengaturan: profil, logout, hapus akun | Sesuai US-02, US-03 |
| M7-11 | Deploy ke Vercel (rewrite SPA, `VITE_API_URL`) | Dapat diakses publik |

## M8 — Aplikasi mobile

Sebelum mulai: putuskan Q1 di PRD (React Native/Expo atau Flutter). Task di bawah untuk Expo.

| ID | Task | Acceptance criteria |
|---|---|---|
| M8-1 | Scaffold `apps/mobile` (Expo, expo-router, TS), konfigurasi monorepo (Metro) | Development build jalan di Android |
| M8-2 | Login Google native (`serverAuthCode`), simpan refresh token di SecureStore | Login sampai beranda |
| M8-3 | Beranda: status "hari ini sudah diisi?" (`/logs/by-date`), tombol tulis cepat | Sesuai G1 (≤ 30 detik) |
| M8-4 | Daftar + detail logbook (gambar dengan URL bertanda tangan) | Sesuai US-05, US-06 |
| M8-5 | Form logbook + ambil foto (kamera/galeri), konversi HEIC→JPEG dan resize via expo-image-manipulator sebelum unggah | Sesuai US-04, US-09 |
| M8-6 | Penanganan Drive reconnect, logout, hapus akun | Sesuai US-02, US-03, US-11 |
| M8-7 | EAS Build profile `preview` (APK) dan `production` (AAB); SHA-1 dari EAS didaftarkan di Google Cloud | APK bisa dipasang dan login berhasil |

## M9 — Rilis

| ID | Task | Acceptance criteria |
|---|---|---|
| M9-1 | Domain kustom (opsional tapi disarankan) untuk web dan API | Cookie refresh `SameSite=Lax` berfungsi |
| M9-2 | Halaman beranda + kebijakan privasi | Bisa diakses publik |
| M9-3 | Publikasikan aplikasi di Google Cloud consent screen | Pengguna di luar daftar test user bisa login |
| M9-4 | Checklist produksi di `docs/06-security.md` | Semua tercentang |
| M9-5 | Checklist uji manual di `docs/08-testing.md` | Semua tercentang |

---

## Setelah MVP

| ID | Fitur | Catatan desain awal |
|---|---|---|
| P-1 | Ekspor PDF per rentang tanggal | Job asynchronous; template mengikuti format kampus; foto diambil dari Drive saat render |
| P-2 | Akses pembimbing | Tautan baca-saja bertanda tangan atau akun pembimbing dengan undangan |
| P-3 | Pengingat harian | Expo push notification + scheduler di API |
| P-4 | Template deskripsi | Field terstruktur opsional (kegiatan, hasil, kendala, rencana) |
| P-5 | Offline mobile | Antrean lokal + sinkronisasi; butuh strategi konflik |
| P-6 | Direct upload ke Drive | Resumable session dari API, unggah dari client (ADR-0005) |
