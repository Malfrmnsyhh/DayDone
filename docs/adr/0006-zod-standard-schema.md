# ADR-0006: Validasi dengan Zod dan StandardSchemaValidationPipe

**Status:** Accepted
**Tanggal:** 2026-11-02

## Context
NestJS versi terbaru menyediakan `ValidationPipe` (class-validator) dan `StandardSchemaValidationPipe` (Zod, Valibot, ArkType). Web dan mobile juga butuh validasi form dengan aturan yang sama.

## Decision
Semua validasi input API memakai schema Zod yang dipasang lewat opsi `schema` pada `@Body`, `@Query`, `@Param`, dengan `StandardSchemaValidationPipe` global. Schema dipindah ke `packages/shared` pada M7 agar dipakai bersama web dan mobile. class-validator tidak dipakai.

## Options Considered
| Opsi | Kelebihan | Kekurangan |
|---|---|---|
| **Zod + StandardSchemaValidationPipe** | Satu schema untuk API, web, mobile; tipe di-infer; tanpa decorator/reflection | Lebih sedikit tutorial lama yang memakainya |
| class-validator + ValidationPipe | Banyak contoh; integrasi Swagger CLI plugin | Tidak bisa dipakai langsung di React Native/web untuk validasi form; aturan ditulis dua kali |

## Consequences
- Lebih mudah: konsistensi aturan validasi lintas platform.
- Lebih sulit: dokumentasi Swagger perlu memakai dukungan Standard Schema di `@nestjs/swagger`.
