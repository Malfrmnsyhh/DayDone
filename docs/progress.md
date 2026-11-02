# Progress

> Diperbarui oleh agent atau pemilik setiap selesai task. Kode di repo adalah sumber kebenaran; bila berbeda dengan catatan ini, perbaiki catatan ini.

**Terakhir diperbarui:** 2 November 2026 (serah terima dari sesi belajar manual ke mode agentik)

## Status per milestone

| Milestone | Status |
|---|---|
| M0 Fondasi monorepo | Sebagian besar selesai, perlu verifikasi |
| M1 CRUD logbook di memori | Materi sudah diberikan; perlu verifikasi apakah sudah diimplementasikan |
| M2 – M9 | Belum dimulai |

## Detail

### M0
- [x] M0-1 Monorepo pnpm (`pnpm-workspace.yaml`, `apps/`, `packages/`, `.gitignore`)
- [x] M0-2 NestJS di `apps/api` (ESM + Vitest, terlihat dari `vitest.config.ts`)
- [ ] M0-3 Prefix `api/v1` + CORS — *verifikasi di `main.ts`*
- [ ] M0-4 `GET /health` — *latihan pemilik, verifikasi*
- [ ] M0-5 Script root

Catatan: repo sudah terhubung ke `github.com/Malfrmnsyh/DayDone`. Proyek kemungkinan sudah di-link ke NestJS Observe saat pembuatan (project `DayDone`, application `api`); bila ya, kuncinya ada di `apps/api/.env`. Observe bersifat opsional.

### M1
- [ ] M1-1 `LogsModule` in-memory dengan Zod — *verifikasi keberadaan `src/logs/`*
- [ ] M1-2 Filter `search` — *latihan pemilik, verifikasi*

## Task berikutnya untuk agent

1. **Audit repo** terhadap daftar di atas. Perbarui centang dan catatan sesuai kondisi nyata.
2. Selesaikan sisa M0 dan M1 bila belum ada (ikuti `docs/04-api-spec.md` untuk bentuk error dan validasi; in-memory boleh tetap sederhana).
3. Mulai **M2**. Butuh dari pemilik: connection string Supabase (session pooler). Bila belum tersedia, kerjakan M2-1, M2-4, M2-7 dulu, lalu minta kredensialnya.

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

## Catatan untuk pemilik (hal yang perlu dipelajari dari task yang dikerjakan agent)

*(diisi agent setiap selesai task: konsep NestJS yang dipakai dan di file mana bisa dilihat)*
