# AGENTS.md — Panduan Kerja untuk AI Agent

Dokumen ini adalah acuan utama bagi AI agent yang melanjutkan pengembangan DayDone. Bila ada konflik dengan dokumen lain, urutan prioritasnya: instruksi langsung dari pemilik proyek → `AGENTS.md` ini → dokumen di `docs/` → `apps/*/AGENTS.md` bawaan framework.

## 1. Konteks singkat

- **Produk**: logbook harian untuk mahasiswa magang (tanggal, deskripsi, foto opsional). Detail di `docs/01-prd.md`.
- **Pemilik proyek** sedang belajar NestJS. Ia menulis bagian awal sendiri, lalu menyerahkan ke agent. Tulis kode yang mudah dibaca dan dipelajari: nama yang jelas, fungsi kecil, komentar singkat hanya di bagian yang tidak jelas dengan sendirinya. Setiap selesai task, tulis ringkasan "apa yang dibuat dan kenapa" yang bisa dipelajari pemilik.
- **Bahasa**: kode, nama variabel, dan pesan commit dalam bahasa Inggris. Pesan error yang dilihat pengguna akhir dan dokumentasi di `docs/` dalam bahasa Indonesia.

## 2. Urutan membaca di awal sesi

1. `docs/progress.md` untuk tahu status terakhir dan task berikutnya.
2. Task terkait di `docs/09-roadmap.md` beserta acceptance criteria-nya.
3. Dokumen yang relevan dengan task (API spec, data model, auth, dll).
4. Kode yang benar-benar ada di repo. **Kode adalah sumber kebenaran tentang status saat ini**; bila `progress.md` tidak cocok dengan kode, percayai kode lalu perbarui `progress.md`.

## 3. Struktur repo

```
DayDone/
├── apps/
│   ├── api/        NestJS REST API (ESM, Vitest, Prisma)
│   ├── web/        React + Vite dashboard (belum dibuat, M7)
│   └── mobile/     Expo React Native (belum dibuat, M8)
├── packages/
│   └── shared/     Schema Zod + tipe bersama (belum dibuat, M7)
├── docs/
├── AGENTS.md
├── pnpm-workspace.yaml
└── package.json
```

## 4. Perintah

Jalankan dari `apps/api` kecuali disebutkan lain.

| Tujuan | Perintah |
|---|---|
| Install semua dependency (dari root) | `pnpm install` |
| Dev server | `pnpm start:dev` |
| Build | `pnpm build` |
| Unit test | `pnpm test` |
| E2E test | `pnpm test:e2e` |
| Lint | `pnpm lint` |
| Format | `pnpm format` |
| Buat migrasi baru | `pnpm exec prisma migrate dev --name <nama_snake_case>` |
| Generate Prisma Client | `pnpm exec prisma generate` |
| Generate file Nest | `pnpm exec nest g <module\|controller\|service> <nama> --no-spec` |

Sebelum menyatakan task selesai, `pnpm build`, `pnpm lint`, dan `pnpm test` harus lolos.

## 5. Aturan wajib (non-negotiable)

1. **ESM**: proyek API memakai ES Modules. Import relatif wajib berakhiran `.js` (contoh: `import { LogsService } from './logs.service.js'`). Gunakan `import type` untuk import yang hanya tipe.
2. **Validasi dengan Zod**: semua input (`@Body`, `@Query`, `@Param`) divalidasi lewat opsi `schema` dan `StandardSchemaValidationPipe` global. Jangan menambahkan class-validator. Lihat ADR-0006.
3. **Scoping per user**: setiap query ke data milik pengguna **wajib** difilter dengan `userId` dari JWT. Tidak boleh ada endpoint yang mengambil `LogEntry` atau `Attachment` hanya berdasarkan `id`. Data milik pengguna lain dibalas `404`, bukan `403`, supaya keberadaan data tidak bocor.
4. **Tanggal logbook**: di batas API, tanggal selalu string `YYYY-MM-DD`. Di database bertipe `@db.Date`. Konversi hanya lewat helper di `src/common/date.ts`. Jangan memakai `new Date()` lokal untuk tanggal logbook. Lihat `docs/03-data-model.md`.
5. **Rahasia**: jangan pernah commit `.env`, jangan pernah me-log token (Google access/refresh token, JWT, refresh token sesi), dan jangan mengembalikan refresh token Google ke client dalam bentuk apa pun.
6. **Google Drive hanya lewat abstraksi**: modul lain tidak boleh memanggil `googleapis` langsung. Semua akses file lewat interface `StorageProvider` (lihat `docs/02-architecture.md`).
7. **Migrasi**: jangan mengedit file migrasi yang sudah ter-commit. Perubahan skema selalu lewat migrasi baru.
8. **Controller tipis**: controller hanya membaca request dan memanggil service. Logika bisnis ada di service.
9. **Dependency baru**: hanya tambahkan bila benar-benar dibutuhkan, dan sebutkan alasannya di ringkasan task. Utamakan yang sudah tercantum di dokumen ini.
10. **Kontrak API**: jangan mengubah bentuk request/response di luar `docs/04-api-spec.md`. Bila perubahan perlu, perbarui spec dalam commit yang sama.

## 6. Alur kerja per task

1. Pilih task berikutnya dari `docs/progress.md` (atau yang diminta pemilik).
2. Tulis rencana singkat: file yang akan dibuat/diubah, dan cara mengujinya.
3. Implementasi dalam langkah kecil. Satu task = satu atau beberapa commit kecil yang masing-masing tetap bisa di-build.
4. Tulis atau perbarui test sesuai `docs/08-testing.md`.
5. Jalankan build, lint, dan test.
6. Perbarui `docs/progress.md` (centang task, catat keputusan kecil dan hal yang perlu diketahui pemilik).
7. Tulis ringkasan untuk pemilik: apa yang dibuat, kenapa, cara mencobanya (contoh request), dan konsep NestJS yang dipakai.

## 7. Definition of Done

Sebuah task dianggap selesai bila:

- [ ] Semua acceptance criteria di `docs/09-roadmap.md` terpenuhi.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` lolos (dan `pnpm test:e2e` bila task menyentuh endpoint).
- [ ] Endpoint baru atau yang berubah sesuai `docs/04-api-spec.md`.
- [ ] Tidak ada query data pengguna yang tidak di-scope dengan `userId`.
- [ ] Tidak ada rahasia di kode, log, atau commit.
- [ ] `docs/progress.md` sudah diperbarui.

## 8. Kapan harus berhenti dan bertanya

Hentikan pekerjaan dan tanyakan ke pemilik bila:

- Task membutuhkan kredensial atau akses yang belum ada (Supabase, Google Cloud, akun deploy).
- Ada keputusan produk yang belum tercantum di `docs/01-prd.md` (bagian "Pertanyaan terbuka").
- Perubahan akan melanggar salah satu aturan di bagian 5 atau ADR yang berstatus Accepted.
- Ditemukan bahwa dokumen saling bertentangan.
- Butuh menghapus data, me-reset database, atau melakukan force push.

## 9. Hal yang sering salah (baca sebelum menulis kode)

- Prisma 7 memakai `prisma.config.ts` dan driver adapter (`@prisma/adapter-pg`). Client di-generate ke `src/generated/prisma` dan di-import dari `./generated/prisma/client.js`, bukan dari `@prisma/client`. Cek dokumentasi resmi Prisma bila ada error konfigurasi.
- Kolom `@db.Date` dikembalikan Prisma sebagai objek `Date` pada 00:00 UTC. Ubah ke string dengan `toISOString().slice(0, 10)`, jangan dengan method lokal seperti `getDate()`.
- Google hanya mengirim refresh token saat pengguna memberi persetujuan pertama kali. Jangan menimpa refresh token yang tersimpan dengan `null`.
- Pengguna bisa tidak mencentang izin Drive di layar persetujuan Google (granular consent). Selalu periksa scope yang benar-benar diberikan.
- Tag `<img>` di web tidak bisa mengirim header `Authorization`. Karena itu gambar ditampilkan lewat signed URL berumur pendek, lihat `docs/05-auth-and-storage.md`.
- Nest CLI versi ini membuat proyek ESM dengan Vitest, sedangkan banyak tutorial lama memakai CommonJS dan Jest. Jangan mengonversi proyek ke CommonJS.
