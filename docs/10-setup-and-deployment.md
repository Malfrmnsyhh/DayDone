# 10 — Setup Lingkungan dan Deployment

## 1. Prasyarat

- Node.js versi LTS terbaru, pnpm, Git.
- Docker (untuk Postgres test lokal).
- Akun: Supabase, Google Cloud, GitHub, platform deploy API (Render atau Railway), Vercel, Expo.

## 2. Variabel lingkungan

### `apps/api/.env`

| Variabel | Contoh | Keterangan |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT` | `3000` | |
| `DATABASE_URL` | `postgresql://postgres.<ref>:<pw>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres` | Runtime (adapter-pg). Gunakan Supavisor **session mode** |
| `DIRECT_URL` | sama dengan di atas | Dipakai `prisma.config.ts` untuk migrasi |
| `PUBLIC_API_URL` | `http://localhost:3000` | Untuk membentuk URL lampiran bertanda tangan |
| `CORS_ORIGINS` | `http://localhost:5173` | Dipisah koma |
| `JWT_ACCESS_SECRET` | hasil `openssl rand -base64 48` | |
| `JWT_ACCESS_TTL` | `15m` | |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | |
| `TOKEN_ENCRYPTION_KEY` | hasil `openssl rand -base64 32` | Harus 32 byte setelah decode |
| `ATTACHMENT_URL_SECRET` | hasil `openssl rand -base64 48` | |
| `GOOGLE_WEB_CLIENT_ID` | `xxxx.apps.googleusercontent.com` | |
| `GOOGLE_WEB_CLIENT_SECRET` | `GOCSPX-...` | |
| `COOKIE_SAMESITE` | `lax` | `none` bila web dan API beda domain induk |
| `DEV_AUTH_ENABLED` | `true` | Hanya development, sampai M4 selesai |
| Kunci NestJS Observe | (ditulis otomatis oleh `observe link`) | Opsional |

Buat `apps/api/.env.example` dengan semua nama variabel di atas tanpa nilai rahasia, dan commit file itu.

### `apps/web/.env`

| Variabel | Keterangan |
|---|---|
| `VITE_API_URL` | Contoh `http://localhost:3000/api/v1` |
| `VITE_GOOGLE_WEB_CLIENT_ID` | Client ID Web (bukan rahasia) |

### `apps/mobile/.env`

| Variabel | Keterangan |
|---|---|
| `EXPO_PUBLIC_API_URL` | Emulator Android: `http://10.0.2.2:3000/api/v1`; HP fisik: `http://<IP-LAN-laptop>:3000/api/v1` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Client ID Web, dipakai sebagai `webClientId` |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Bila iOS dibangun |

Variabel `VITE_*` dan `EXPO_PUBLIC_*` ikut ter-bundle ke aplikasi, jadi jangan pernah menaruh rahasia di sana.

## 3. Setup Supabase

1. Buat project baru, region **Southeast Asia (Singapore)**. Simpan password database.
2. Buka **Connect** di dashboard dan salin connection string **Session pooler**. API berjalan sebagai server yang hidup terus (bukan serverless), sehingga session mode cocok untuk runtime dan migrasi. Koneksi langsung (`db.<ref>.supabase.co`) umumnya hanya IPv6, dan banyak platform deploy belum mendukungnya.
3. Isi `DATABASE_URL` dan `DIRECT_URL`.
4. Fitur Supabase Auth dan Storage tidak dipakai. Karena Prisma terhubung sebagai role `postgres`, Row Level Security tidak melindungi query API; perlindungan ada di scoping `userId` di kode. Aktifkan RLS pada tabel tanpa policy agar tabel tidak bisa diakses lewat API publik Supabase (PostgREST) dengan anon key.

## 4. Setup Google Cloud

Ikuti `docs/05-auth-and-storage.md` bagian 1.

## 5. Menjalankan lokal

```bash
pnpm install
cd apps/api
cp .env.example .env            # lalu isi
pnpm exec prisma migrate dev
pnpm exec prisma db seed
pnpm start:dev
```

Test e2e:

```bash
docker compose up -d postgres-test
pnpm test:e2e
```

## 6. Deploy API

Rekomendasi: Render atau Railway, region Singapura, memakai Dockerfile dari M6-5. Cek kebijakan free tier terbaru saat deploy, karena sering berubah. Free tier biasanya "tidur" saat tidak dipakai sehingga request pertama lambat.

Konfigurasi:

- Build: Dockerfile (`pnpm install --frozen-lockfile`, `prisma generate`, `pnpm build`).
- Release/pre-deploy command: `pnpm exec prisma migrate deploy`.
- Start: `node dist/main.js`.
- Health check path: `/api/v1/health`.
- Semua env var produksi diisi di dashboard platform, dengan secret yang **berbeda** dari development.

## 7. Deploy web (Vercel)

- Root directory: `apps/web`. Framework preset: Vite.
- Env: `VITE_API_URL`, `VITE_GOOGLE_WEB_CLIENT_ID`.
- `apps/web/vercel.json` untuk rewrite SPA:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

- Tambahkan domain web produksi ke Authorized JavaScript origins di OAuth client Web dan ke `CORS_ORIGINS` API.

## 8. Build mobile (EAS)

- `eas build --profile development` untuk development build (dibutuhkan login Google native).
- `eas build --profile preview --platform android` menghasilkan APK untuk diuji.
- Ambil SHA-1 sertifikat dari `eas credentials` dan daftarkan di OAuth client Android.

## 9. Domain kustom (disarankan)

Contoh: `daydone.app` → web di `app.daydone.app` (Vercel), API di `api.daydone.app` (Render/Railway). Dengan begitu cookie refresh token web bisa `SameSite=Lax` dan tidak terpengaruh pemblokiran cookie pihak ketiga. Set `COOKIE_SAMESITE=lax`, perbarui `CORS_ORIGINS`, `PUBLIC_API_URL`, dan origin di Google Cloud.

## 10. Runbook singkat

| Kejadian | Langkah |
|---|---|
| Migrasi gagal saat deploy | Deploy dibatalkan otomatis bila release command gagal. Periksa log, perbaiki dengan migrasi baru, deploy ulang. Jangan edit migrasi lama |
| Banyak pengguna `DRIVE_RECONNECT_REQUIRED` tiba-tiba | Cek apakah aplikasi Google masih berstatus Testing (token 7 hari) atau client secret dirotasi |
| Kunci enkripsi token bocor | Buat kunci baru, jalankan skrip re-enkripsi (dekripsi dengan kunci lama, enkripsi dengan kunci baru), cabut semua sesi |
| JWT secret bocor | Ganti `JWT_ACCESS_SECRET`; semua access token langsung tidak berlaku, client otomatis refresh |
| Database penuh / lambat | Periksa ukuran tabel dan query lambat di dashboard Supabase |
