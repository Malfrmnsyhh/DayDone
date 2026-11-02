# 07 — Konvensi Kode

## 1. Umum

- TypeScript strict di semua paket. Dilarang `any`; gunakan `unknown` lalu persempit.
- Format dengan Prettier, lint dengan ESLint (konfigurasi bawaan Nest CLI). Jangan menonaktifkan aturan lint tanpa komentar alasannya.
- Fungsi kecil dan satu tanggung jawab. Bila sebuah method service lebih dari ~40 baris, pecah.
- Nama dalam bahasa Inggris. Pesan untuk pengguna akhir dalam bahasa Indonesia.

## 2. Struktur modul NestJS

Setiap fitur adalah satu folder:

```
src/logs/
├── dto/
│   └── log.schema.ts        schema Zod + tipe hasil z.infer
├── logs.controller.ts
├── logs.service.ts
├── logs.mapper.ts           entitas Prisma -> bentuk response API
├── logs.module.ts
└── logs.service.spec.ts     unit test (bersebelahan dengan file yang diuji)
```

Setelah `packages/shared` ada (M7), schema request dipindah ke sana dan `dto/` hanya me-re-export atau memperluasnya.

## 3. Penamaan

| Hal | Konvensi | Contoh |
|---|---|---|
| File | kebab-case dengan sufiks peran | `google-drive.storage.ts`, `jwt-auth.guard.ts` |
| Class | PascalCase dengan sufiks peran | `LogsService`, `JwtAuthGuard` |
| Schema Zod | camelCase + `Schema` | `createLogSchema` |
| Tipe dari schema | PascalCase + `Dto` / `Query` | `CreateLogDto`, `ListLogsQuery` |
| Kode error | SCREAMING_SNAKE_CASE | `LOG_DATE_CONFLICT` |
| Tabel database | snake_case jamak lewat `@@map` | `log_entries` |
| Env var | SCREAMING_SNAKE_CASE | `GOOGLE_WEB_CLIENT_ID` |

## 4. Import (ESM)

```ts
import { Injectable } from '@nestjs/common';           // paket: tanpa ekstensi
import { PrismaService } from '../prisma/prisma.service.js'; // relatif: wajib .js
import type { CreateLogDto } from './dto/log.schema.js';    // hanya tipe: import type
```

Urutan: paket Node bawaan (`node:crypto`) → paket pihak ketiga → modul internal. Biarkan ESLint/Prettier merapikan.

## 5. Validasi

```ts
@Post()
create(
  @CurrentUser() user: AuthUser,
  @Body({ schema: createLogSchema }) dto: CreateLogDto,
) {
  return this.logsService.create(user.userId, dto);
}
```

- Gunakan `z.object()` (membuang field tak dikenal).
- Pesan error Zod untuk field yang dilihat pengguna ditulis dalam bahasa Indonesia.
- Query angka memakai `z.coerce.number()`.

## 6. Error

- Error HTTP standar: exception bawaan Nest (`NotFoundException`, dll).
- Error domain dengan kode: `DomainException`.

```ts
export class DomainException extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: ErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ statusCode: status, error: HttpStatus[status], message, code, ...extra }, status);
  }
}
```

- Daftar `ErrorCode` terpusat di `src/common/errors/error-codes.ts` dan harus sama dengan tabel di `docs/04-api-spec.md`.
- Filter global memetakan error Prisma: `P2002` → `409`, `P2025` → `404`.

## 7. Konfigurasi

- `@nestjs/config` dengan `validate` memakai schema Zod di `src/config/env.schema.ts`. Aplikasi gagal start bila env tidak lengkap.
- Akses env hanya lewat `ConfigService`, bukan `process.env` langsung (kecuali di `prisma.config.ts` dan `main.ts` sebelum app dibuat).

## 8. Service dan database

- Method service menerima `userId` sebagai argumen pertama untuk data milik pengguna.
- Gunakan `findFirst({ where: { id, userId } })`, bukan `findUnique({ where: { id } })` lalu cek manual.
- Operasi multi-langkah yang harus konsisten memakai `prisma.$transaction`.
- Jangan memanggil layanan eksternal (Drive) di dalam transaksi database.

## 9. Git

- Branch: `main` selalu bisa di-build. Fitur di `feat/<ringkas>`, perbaikan di `fix/<ringkas>`.
- Commit mengikuti Conventional Commits:
  - `feat(logs): add search filter`
  - `fix(auth): keep stored refresh token when google omits it`
  - `chore(api): setup prisma 7 with adapter-pg`
  - `docs: update progress`
  - `test(attachments): cover cross-user access`
- Satu commit = satu perubahan logis yang tetap bisa di-build.

## 10. Checklist PR

- [ ] Build, lint, test lolos.
- [ ] Spec API dan dokumen terkait diperbarui bila perilaku berubah.
- [ ] Checklist keamanan per fitur (`docs/06-security.md`) dipenuhi.
- [ ] `docs/progress.md` diperbarui.
