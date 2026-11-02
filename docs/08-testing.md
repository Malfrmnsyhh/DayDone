# 08 — Strategi Pengujian

## 1. Lapisan test

| Lapisan | Alat | Cakupan | Lokasi |
|---|---|---|---|
| Unit | Vitest | Service, mapper, helper (tanggal, enkripsi, token URL), image processor | `src/**/*.spec.ts` |
| E2E API | Vitest + supertest | Semua endpoint melalui HTTP, dengan database sungguhan | `test/**/*.e2e-spec.ts` |
| Kontrak | Schema Zod bersama | Web/mobile dan API memakai schema yang sama | `packages/shared` |
| Manual | Checklist | Login Google sungguhan, unggah dari HP, tampilan | Bagian 5 dokumen ini |

Target: cakupan unit test ≥ 80% untuk `logs`, `attachments`, `auth`, `common`. Setiap endpoint punya minimal satu e2e test sukses dan satu gagal.

## 2. Database untuk test

- Gunakan Postgres lokal lewat Docker (`docker-compose.yml` di root, service `postgres-test` port 5433), **bukan** database Supabase produksi.
- Sebelum suite e2e: `prisma migrate reset --force` ke database test.
- Setiap test membersihkan tabel yang dipakainya (atau memakai transaksi yang di-rollback).

## 3. Layanan eksternal di test

Tidak ada test otomatis yang memanggil Google.

- `StorageProvider` diganti `InMemoryStorageProvider` lewat `overrideProvider(STORAGE_PROVIDER)`. Fake ini bisa diatur untuk mensimulasikan `DRIVE_RECONNECT_REQUIRED`, `DRIVE_STORAGE_FULL`, dan error lain.
- `GoogleOAuthService` diganti fake yang memetakan code palsu (misal `"code-user-a"`) ke profil dan scope tertentu.
- Helper test `loginAs(app, 'user-a')` mengembalikan access token untuk dipakai di request berikutnya.

## 4. Matriks test minimum

### Logs

- Buat logbook valid → 201, tanggal dikembalikan sama persis (`2026-11-02`, tidak bergeser zona waktu).
- Tanggal duplikat → 409 `LOG_DATE_CONFLICT` dengan `existingLogId`.
- Deskripsi hanya spasi → 400.
- Format tanggal salah, tanggal tidak ada (`2026-02-30`) → 400.
- Tanggal terlalu jauh di masa depan → 400.
- Daftar terurut menurun, filter `from`/`to` inklusif, `search` tidak peka huruf, paginasi `meta` benar.
- `from > to` → 400.
- PATCH body kosong → 400; PATCH tanggal ke tanggal yang sudah dipakai → 409.
- DELETE → 204, lalu GET → 404; `trash` dipanggil untuk setiap lampiran.
- **Lintas pengguna**: user B GET/PATCH/DELETE logbook user A → 404; daftar user B tidak berisi logbook user A.
- Tanpa token → 401.

### Auth

- Login pertama membuat user, menyimpan refresh token terenkripsi, membuat folder.
- Login ulang tanpa `refresh_token` dari Google tidak menghapus token tersimpan.
- Scope Drive tidak diberikan → `driveStatus: NOT_CONNECTED`.
- `email_verified: false` → 401.
- Refresh berhasil memutar token; token lama dipakai lagi → 401 dan semua sesi dicabut.
- Logout → access token dengan `sid` tersebut ditolak.
- Web: refresh token ada di cookie, tidak di body; tanpa header `X-Requested-With` → 403.

### Attachments

- Unggah 1 dan 5 file → 201; file ke-6 → 409.
- File > 10 MB → 413; file teks berekstensi `.jpg` → 415.
- Gambar dengan EXIF GPS → hasil yang disimpan di fake storage tidak memiliki EXIF.
- Gambar 4000×3000 → disimpan 2048×1536.
- Drive `NEEDS_RECONNECT` → 409 dan `driveStatus` user diperbarui.
- Insert DB gagal setelah unggah → file di fake storage di-trash.
- URL bertanda tangan: valid → 200; diubah satu karakter → 401; kedaluwarsa → 401; lampiran milik user lain dengan token user lain → 404.
- Lintas pengguna untuk semua endpoint lampiran.

### Common

- `toDbDate`/`fromDbDate` bolak-balik untuk tanggal batas (1 Jan, 31 Des, 29 Feb tahun kabisat).
- Enkripsi → dekripsi menghasilkan teks semula; ciphertext yang dimodifikasi gagal didekripsi.

## 5. Checklist uji manual sebelum rilis

- [ ] Login Google di web (Chrome dan Safari) dan Android.
- [ ] Menolak izin Drive saat login → bisa membuat logbook teks, tombol hubungkan Drive muncul.
- [ ] Unggah foto dari kamera dan galeri (termasuk HEIC dari iPhone bila iOS didukung).
- [ ] Foto muncul di folder `DayDone` Drive dengan nama yang benar dan tanpa lokasi.
- [ ] Cabut akses DayDone di pengaturan akun Google → aplikasi menampilkan "Hubungkan ulang Google Drive" dan alur hubungkan ulang berhasil.
- [ ] Logout di satu perangkat tidak mengeluarkan perangkat lain.
- [ ] Hapus akun menghapus semua data dan menampilkan informasi tentang file di Drive.
- [ ] Logbook dibuat pukul 23.30 WIB tersimpan dengan tanggal hari itu, bukan besoknya.

## 6. CI (GitHub Actions)

Setiap push dan PR: `pnpm install --frozen-lockfile` → `prisma generate` → lint → build → unit test → e2e test (dengan service Postgres) → `pnpm audit --audit-level high`.
