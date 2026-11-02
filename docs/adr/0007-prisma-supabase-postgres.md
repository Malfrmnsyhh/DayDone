# ADR-0007: Prisma 7 + PostgreSQL Supabase

**Status:** Accepted
**Tanggal:** 2026-11-02

## Context
Dibutuhkan database relasional terkelola dengan free tier dan ORM yang type-safe.

## Decision
PostgreSQL di Supabase (region Singapura), diakses dengan Prisma 7 memakai `@prisma/adapter-pg`. Client di-generate ke `src/generated/prisma`. Koneksi runtime dan migrasi memakai Supavisor session mode. Supabase Auth dan Storage tidak dipakai.

## Options Considered
| Opsi | Kelebihan | Kekurangan |
|---|---|---|
| **Prisma** | Skema deklaratif, migrasi, tipe otomatis, populer | Prisma 7 mengubah banyak konfigurasi; tutorial lama sering tidak cocok |
| Drizzle | Ringan, dekat dengan SQL | Kurva belajar berbeda; pemilik sudah memilih Prisma |
| TypeORM | Integrasi lama dengan Nest | Tipe kurang ketat |

## Consequences
- Lebih mudah: perubahan skema lewat migrasi yang tercatat.
- Lebih sulit: RLS Supabase tidak melindungi query Prisma, sehingga scoping `userId` di kode wajib dan harus diuji.
