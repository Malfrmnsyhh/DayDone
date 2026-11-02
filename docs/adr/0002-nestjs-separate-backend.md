# ADR-0002: NestJS sebagai backend terpisah

**Status:** Accepted
**Tanggal:** 2026-11-02

## Context
API dipakai oleh web dan mobile. Pemilik proyek ingin memisahkan backend dan frontend serta mempelajari arsitektur backend yang terstruktur sebagai bagian dari tugas akhir magang.

## Decision
REST API dibangun dengan NestJS (ESM, Vitest), di-deploy sebagai server yang berjalan terus (Render/Railway). Web adalah SPA React + Vite yang di-deploy ke Vercel.

## Options Considered
| Opsi | Kompleksitas | Kelebihan | Kekurangan |
|---|---|---|---|
| **NestJS terpisah** | Sedang | Struktur jelas (module, DI, guard, pipe); cocok untuk banyak client; tidak terkena batas serverless | Dua tempat deploy |
| Next.js Route Handlers | Rendah | Satu deploy di Vercel | Batas body 4,5 MB dan durasi function; API "menempel" ke web; struktur kurang tegas |
| Express murni | Rendah | Sederhana | Struktur, validasi, DI harus dibangun sendiri |

## Consequences
- Lebih mudah: unggah file besar, koneksi database persisten, pengujian per modul.
- Lebih sulit: dua deployment; free tier server bisa cold start.
- Ditinjau ulang bila biaya hosting server menjadi masalah.
