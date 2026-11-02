# 04 — Spesifikasi REST API

## 1. Konvensi umum

| Hal | Aturan |
|---|---|
| Base URL | `https://<host>/api/v1` (lokal: `http://localhost:3000/api/v1`) |
| Format | JSON (`Content-Type: application/json`), kecuali unggah file (`multipart/form-data`) |
| Autentikasi | `Authorization: Bearer <accessToken>` untuk semua endpoint kecuali yang bertanda **Publik** |
| Tanggal logbook | String `YYYY-MM-DD` |
| Timestamp | ISO 8601 UTC, contoh `2026-11-02T08:15:30.000Z` |
| ID | UUID v4 |
| Penamaan field | camelCase |
| Data milik pengguna lain | Selalu dibalas `404` |

### Format error

Mengikuti bentuk bawaan NestJS, ditambah `code` untuk error domain yang perlu ditangani client secara khusus:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Logbook untuk tanggal 2026-11-02 sudah ada",
  "code": "LOG_DATE_CONFLICT"
}
```

Error validasi (`400`) mengembalikan `message` berupa array:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["description: Deskripsi wajib diisi"]
}
```

### Daftar kode error

| `code` | Status | Arti | Tindakan client |
|---|---|---|---|
| `LOG_DATE_CONFLICT` | 409 | Tanggal sudah punya logbook | Tawarkan membuka logbook yang ada (`existingLogId` disertakan) |
| `ATTACHMENT_LIMIT_REACHED` | 409 | Sudah 5 foto | Beri tahu batas |
| `UNSUPPORTED_FILE_TYPE` | 415 | Bukan JPEG/PNG/WebP atau gambar rusak | Minta file lain |
| `FILE_TOO_LARGE` | 413 | > 10 MB | Kompres lalu ulangi |
| `DRIVE_NOT_CONNECTED` | 409 | Pengguna belum memberi izin Drive | Tampilkan tombol hubungkan Drive |
| `DRIVE_RECONNECT_REQUIRED` | 409 | Akses Drive dicabut/kedaluwarsa | Tampilkan tombol hubungkan ulang |
| `DRIVE_STORAGE_FULL` | 507 | Drive pengguna penuh | Beri tahu pengguna |
| `DRIVE_UNAVAILABLE` | 502 | Error dari Google | Coba lagi nanti |
| `GOOGLE_AUTH_FAILED` | 401 | Code tidak valid/kedaluwarsa | Ulangi login |
| `SESSION_EXPIRED` | 401 | Refresh token tidak valid | Arahkan ke login |

### Paginasi

Query `page` (mulai 1, default 1) dan `limit` (1–100, default 20). Response daftar:

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

### Rate limit

Default 100 request/menit per IP. Endpoint `/auth/*` 10 request/menit per IP. Unggah 30 request/menit per pengguna. Melebihi batas → `429`.

---

## 2. Health

### `GET /health` — Publik

```json
{ "status": "ok", "database": "up", "timestamp": "2026-11-02T08:00:00.000Z" }
```

Bila database tidak terjangkau: `503` dengan `"database": "down"`.

---

## 3. Auth

### `POST /auth/google` — Publik

Menukar authorization code Google dengan sesi DayDone.

Request:

```json
{
  "code": "4/0AeanS0...",
  "platform": "WEB",
  "redirectUri": "postmessage"
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `code` | string, wajib | Authorization code dari Google |
| `platform` | `"WEB"` \| `"MOBILE"`, wajib | Menentukan OAuth client dan cara pengiriman refresh token |
| `redirectUri` | string, opsional | Harus sama dengan yang dipakai client saat meminta code. Web (popup GIS): `"postmessage"`. Mobile (serverAuthCode): kosongkan |

Response `200`:

```json
{
  "accessToken": "eyJhbGciOi...",
  "accessTokenExpiresAt": "2026-11-02T08:15:00.000Z",
  "refreshToken": "dG9rZW4...",
  "user": {
    "id": "8f1c...",
    "email": "rina@gmail.com",
    "name": "Rina",
    "avatarUrl": "https://lh3.googleusercontent.com/...",
    "driveStatus": "CONNECTED"
  }
}
```

- Untuk `platform: "WEB"`, `refreshToken` **tidak** ada di body; dikirim sebagai cookie `daydone_rt` (`HttpOnly; Secure; Path=/api/v1/auth`).
- Untuk `platform: "MOBILE"`, `refreshToken` ada di body dan disimpan client di secure storage.

Error: `400` (body tidak valid), `401 GOOGLE_AUTH_FAILED`.

### `POST /auth/refresh` — Publik

Request (mobile): `{ "refreshToken": "dG9rZW4..." }`. Web: body kosong, token dibaca dari cookie; request web wajib menyertakan header `X-Requested-With: daydone-web` (proteksi CSRF).

Response `200`: sama dengan `/auth/google` tanpa field `user`. Refresh token lama langsung tidak berlaku (rotasi).

Error: `401 SESSION_EXPIRED`.

### `POST /auth/logout`

Mencabut sesi saat ini. Mobile mengirim `{ "refreshToken": "..." }`; web memakai cookie dan cookie dihapus. Response `204`.

### `GET /auth/me`

Response `200`: objek `user` seperti di atas.

---

## 4. Users

### `DELETE /users/me`

Menghapus akun dan semua data. Request: `{ "confirm": "HAPUS" }`.

Proses: cabut token Google → hapus user (cascade ke sesi, logbook, lampiran). File di Drive tidak dihapus. Response `204`.

---

## 5. Logs

### Objek `Log`

```json
{
  "id": "3b2a...",
  "date": "2026-11-02",
  "description": "Menyiapkan project NestJS dan membuat endpoint CRUD logbook.",
  "attachments": [
    {
      "id": "a91d...",
      "fileName": "2026-11-02_a91d.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 412345,
      "width": 2048,
      "height": 1536,
      "position": 0,
      "url": "https://api.../api/v1/attachments/a91d.../content?token=...",
      "urlExpiresAt": "2026-11-02T08:20:00.000Z"
    }
  ],
  "createdAt": "2026-11-02T08:00:00.000Z",
  "updatedAt": "2026-11-02T08:00:00.000Z"
}
```

`url` bisa `null` bila Drive pengguna sedang `NEEDS_RECONNECT`.

### `GET /logs`

Query:

| Param | Tipe | Keterangan |
|---|---|---|
| `from` | `YYYY-MM-DD`, opsional | Tanggal awal (inklusif) |
| `to` | `YYYY-MM-DD`, opsional | Tanggal akhir (inklusif). Bila `from` dan `to` ada, `from ≤ to` |
| `search` | string, opsional, 1–100 karakter | Cari di deskripsi, tidak peka huruf besar/kecil |
| `page`, `limit` | angka | Lihat paginasi |

Urutan: `date` menurun. Response `200` berbentuk daftar terpaginasi berisi objek `Log` dengan `attachments` diringkas: hanya lampiran pertama yang punya `url` (sebagai thumbnail), sisanya `url: null`, ditambah `attachmentCount`.

### `GET /logs/:id`

Response `200`: objek `Log` lengkap. `404` bila tidak ada atau bukan milik pengguna.

### `GET /logs/by-date/:date`

Mengambil logbook pada tanggal tertentu. Dipakai client untuk mengecek "apakah hari ini sudah diisi". `404` bila belum ada.

### `POST /logs`

Request:

```json
{ "date": "2026-11-02", "description": "Menyiapkan project NestJS." }
```

| Field | Aturan |
|---|---|
| `date` | wajib, `YYYY-MM-DD`, tidak boleh lebih dari 1 hari setelah tanggal server (toleransi zona waktu) |
| `description` | wajib, di-trim, 1–5000 karakter |

Response `201`: objek `Log` dengan `attachments: []`.

Error `409 LOG_DATE_CONFLICT`, dengan field tambahan `"existingLogId": "..."`.

### `PATCH /logs/:id`

Request: subset dari `{ date, description }`, minimal satu field. Response `200`: objek `Log`. Error: `400`, `404`, `409 LOG_DATE_CONFLICT`.

### `DELETE /logs/:id`

Menghapus logbook dan semua lampirannya dari database, lalu memindahkan file ke Trash Drive (best-effort: kegagalan Drive dicatat di log, tidak menggagalkan request). Response `204`.

---

## 6. Attachments

### `POST /logs/:id/attachments`

`multipart/form-data`, field `files` (1–5 file). Total lampiran setelah unggah tidak boleh lebih dari 5.

Batas: ≤ 10 MB per file; `image/jpeg`, `image/png`, `image/webp`. Server memverifikasi isi file dengan mendekodenya (sharp), bukan hanya dari header `Content-Type`.

Pemrosesan: auto-rotate sesuai EXIF orientation → resize sisi terpanjang maks. 2048 px (tidak diperbesar) → hapus semua metadata → simpan sebagai JPEG kualitas 82 (PNG dengan transparansi tetap PNG).

Nama file di Drive: `YYYY-MM-DD_<8 karakter awal id>.jpg`.

Response `201`:

```json
{ "data": [ { "id": "a91d...", "...": "objek attachment seperti di Log" } ] }
```

Bila sebagian file gagal, request dianggap gagal seluruhnya: file yang sudah terunggah dipindahkan ke Trash, dan response error dikembalikan.

Error: `404`, `409 ATTACHMENT_LIMIT_REACHED`, `409 DRIVE_NOT_CONNECTED`, `409 DRIVE_RECONNECT_REQUIRED`, `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_FILE_TYPE`, `502 DRIVE_UNAVAILABLE`, `507 DRIVE_STORAGE_FULL`.

### `GET /attachments/:id/url`

Response `200`:

```json
{ "url": "https://.../attachments/a91d.../content?token=...", "expiresAt": "2026-11-02T08:20:00.000Z" }
```

URL berlaku 5 menit.

### `GET /attachments/:id/content?token=...` — Publik (dilindungi token)

Mengalirkan isi gambar dari Drive. Header: `Content-Type` sesuai file, `Cache-Control: private, max-age=300`, `X-Content-Type-Options: nosniff`.

Error: `401` (token tidak valid/kedaluwarsa), `404`, `409 DRIVE_RECONNECT_REQUIRED`, `502`.

### `DELETE /attachments/:id`

Hapus metadata dan pindahkan file ke Trash Drive. Posisi lampiran lain dirapatkan ulang. Response `204`.

---

## 7. Dokumentasi interaktif

Di lingkungan non-produksi, Swagger UI tersedia di `/api/docs` (dibuat dengan `@nestjs/swagger`, memanfaatkan dukungan Standard Schema untuk schema Zod). Spesifikasi OpenAPI JSON di `/api/docs-json` dipakai untuk membuat client Dart bila mobile memakai Flutter.
