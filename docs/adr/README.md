# Architecture Decision Records

Setiap keputusan arsitektur penting dicatat sebagai ADR. ADR berstatus **Accepted** tidak boleh dilanggar tanpa ADR baru yang menggantikannya (status lama menjadi **Superseded**).

| ADR | Judul | Status |
|---|---|---|
| [0001](./0001-monorepo-typescript.md) | Monorepo TypeScript dengan pnpm workspaces | Accepted |
| [0002](./0002-nestjs-separate-backend.md) | NestJS sebagai backend terpisah | Accepted |
| [0003](./0003-google-oauth-own-sessions.md) | Google OAuth sebagai satu-satunya login, sesi dikelola sendiri | Accepted |
| [0004](./0004-per-user-google-drive.md) | Foto disimpan di Google Drive masing-masing pengguna | Accepted |
| [0005](./0005-upload-through-api.md) | Unggah foto melalui API untuk MVP | Accepted |
| [0006](./0006-zod-standard-schema.md) | Validasi dengan Zod dan StandardSchemaValidationPipe | Accepted |
| [0007](./0007-prisma-supabase-postgres.md) | Prisma 7 + PostgreSQL Supabase | Accepted |
| [0008](./0008-signed-image-urls.md) | Gambar ditampilkan lewat URL bertanda tangan berumur pendek | Accepted |
| [0009](./0009-mobile-framework.md) | Framework mobile: React Native (Expo) | Proposed |

Template ADR baru: salin salah satu file, naikkan nomornya, isi bagian Context, Decision, Options, Consequences.
