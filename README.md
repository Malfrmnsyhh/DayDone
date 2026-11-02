# DayDone

DayDone adalah aplikasi logbook harian untuk mahasiswa magang. Pengguna mencatat kegiatan per hari (tanggal + deskripsi) dan bisa melampirkan foto dokumentasi. Foto disimpan di **Google Drive milik masing-masing pengguna**, sedangkan data logbook disimpan di Postgres (Supabase). Aplikasi tersedia sebagai **dashboard web** dan **aplikasi mobile**, keduanya memakai satu **REST API NestJS**.

## Cara memakai dokumen ini

Kalau kamu adalah AI agent yang melanjutkan pengembangan, baca [`AGENTS.md`](./AGENTS.md) lebih dulu. File itu berisi aturan kerja, perintah, dan urutan membaca dokumen.

| Dokumen | Isi | Kapan dibaca |
|---|---|---|
| [`AGENTS.md`](./AGENTS.md) | Aturan kerja agent, perintah, Definition of Done | Selalu, paling awal |
| [`docs/progress.md`](./docs/progress.md) | Status terkini dan tugas berikutnya | Setiap memulai sesi |
| [`docs/01-prd.md`](./docs/01-prd.md) | Product Requirements: tujuan, user story, scope MVP | Sebelum mengerjakan fitur |
| [`docs/02-architecture.md`](./docs/02-architecture.md) | Desain sistem, komponen, alur data, diagram | Sebelum mengubah struktur |
| [`docs/03-data-model.md`](./docs/03-data-model.md) | Skema Prisma, aturan tanggal, migrasi | Saat menyentuh database |
| [`docs/04-api-spec.md`](./docs/04-api-spec.md) | Kontrak REST API lengkap | Saat membuat/mengubah endpoint |
| [`docs/05-auth-and-storage.md`](./docs/05-auth-and-storage.md) | Google OAuth, JWT, sesi, integrasi Drive | Milestone M4 dan M5 |
| [`docs/06-security.md`](./docs/06-security.md) | Ancaman, mitigasi, checklist keamanan | Setiap fitur baru |
| [`docs/07-conventions.md`](./docs/07-conventions.md) | Konvensi kode, struktur folder, commit | Selalu |
| [`docs/08-testing.md`](./docs/08-testing.md) | Strategi dan matriks pengujian | Setiap fitur baru |
| [`docs/09-roadmap.md`](./docs/09-roadmap.md) | Milestone dan task dengan acceptance criteria | Saat memilih tugas |
| [`docs/10-setup-and-deployment.md`](./docs/10-setup-and-deployment.md) | Env var, setup Supabase/Google Cloud, deploy | Setup awal dan rilis |
| [`docs/adr/`](./docs/adr/) | Architecture Decision Records | Saat ingin tahu "kenapa begini" |

## Ringkasan stack

| Lapisan | Teknologi |
|---|---|
| Monorepo | pnpm workspaces (`apps/*`, `packages/*`) |
| Backend | NestJS (ESM, Vitest), Zod + `StandardSchemaValidationPipe` |
| Database | PostgreSQL di Supabase, Prisma 7 + `@prisma/adapter-pg` |
| Identitas | Google OAuth 2.0 (satu-satunya login), JWT milik DayDone |
| Penyimpanan file | Google Drive pengguna, scope `drive.file` |
| Web | React + Vite, di-deploy ke Vercel |
| Mobile | React Native (Expo), build via EAS |
| Shared | `packages/shared`: schema Zod dan tipe yang dipakai bersama |

## Penempatan di repo

Salin isi folder ini ke root repo `DayDone`:

```
DayDone/
├── AGENTS.md          ← dari dokumen ini
├── README.md          ← dari dokumen ini (boleh digabung dengan README yang ada)
├── docs/              ← dari dokumen ini
├── apps/
│   └── api/           ← sudah ada (NestJS)
├── packages/
├── pnpm-workspace.yaml
└── package.json
```

`apps/api/AGENTS.md` (dibuat otomatis oleh Nest CLI) tetap dipertahankan. Isinya panduan umum NestJS, sedangkan `AGENTS.md` di root berisi aturan khusus proyek DayDone dan menjadi acuan utama bila ada perbedaan.
