# ADR-0001: Monorepo TypeScript dengan pnpm workspaces

**Status:** Accepted
**Tanggal:** 2026-11-02
**Pengambil keputusan:** Pemilik proyek

## Context
DayDone terdiri dari API, web, dan mobile yang dikembangkan satu orang. Bentuk data (request/response) dan aturan validasi sama di ketiganya.

## Decision
Satu repo dengan pnpm workspaces: `apps/api`, `apps/web`, `apps/mobile`, `packages/shared`. Semua memakai TypeScript. Turborepo boleh ditambahkan nanti bila build mulai lambat.

## Options Considered
| Opsi | Kelebihan | Kekurangan |
|---|---|---|
| **Monorepo pnpm** | Schema dan tipe dibagi langsung; satu PR bisa mengubah API dan client sekaligus | Konfigurasi bundler (Metro, Vite) butuh perhatian untuk paket workspace |
| Repo terpisah per aplikasi | Isolasi penuh | Tipe diduplikasi atau harus dipublikasikan sebagai paket |

## Consequences
- Lebih mudah: menjaga kontrak API konsisten; perubahan schema langsung terdeteksi compiler di semua aplikasi.
- Lebih sulit: konfigurasi Metro untuk monorepo; `packages/shared` perlu di-build ke ESM sebelum dipakai API.
- Ditinjau ulang bila mobile memakai Flutter (lihat ADR-0009).
