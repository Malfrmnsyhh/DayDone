# 05 — Autentikasi, Sesi, dan Integrasi Google Drive

Bagian ini paling rawan salah. Kerjakan berurutan dan uji setiap langkah sebelum lanjut.

## 1. Setup Google Cloud

1. Buat project di Google Cloud Console, misalnya `daydone`.
2. Aktifkan **Google Drive API**.
3. **OAuth consent screen**:
   - User type: External.
   - Nama aplikasi: DayDone, email dukungan, logo (opsional).
   - Scope: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `.../auth/drive.file`.
   - Selama development status "Testing": tambahkan akun Google penguji sebagai test user (maks. 100). Dalam status ini refresh token kedaluwarsa setelah 7 hari, jadi wajar bila penguji harus login ulang seminggu sekali.
4. **OAuth client ID**:
   - **Web application** — dipakai web dan dipakai backend untuk menukar code dari semua platform. Authorized JavaScript origins: `http://localhost:5173` dan domain web produksi. Simpan client ID dan client secret.
   - **Android** — package name aplikasi + SHA-1 sertifikat (debug, dan nanti dari EAS untuk build rilis).
   - **iOS** — bundle identifier (bila iOS dibangun).
5. Sebelum rilis publik: siapkan halaman beranda dan kebijakan privasi, lalu publikasikan aplikasi. Scope `drive.file` termasuk scope yang direkomendasikan Google untuk aplikasi seperti ini; tetap periksa persyaratan verifikasi terbaru di Console saat mempublikasikan.

## 2. Alur login per platform

### Web (React)

Pakai Google Identity Services *authorization code flow* mode popup (misalnya lewat `@react-oauth/google` dengan `flow: 'auth-code'`):

- `scope`: `openid email profile https://www.googleapis.com/auth/drive.file`
- Code yang diterima dikirim ke `POST /auth/google` dengan `platform: "WEB"` dan `redirectUri: "postmessage"`.

### Mobile (Expo)

Pakai `@react-native-google-signin/google-signin` (butuh **development build**, tidak jalan di Expo Go):

- Konfigurasi `webClientId` = client ID **Web** (bukan Android), `offlineAccess: true`, `scopes: ['https://www.googleapis.com/auth/drive.file']`.
- Setelah sign-in, ambil `serverAuthCode` dan kirim ke `POST /auth/google` dengan `platform: "MOBILE"` tanpa `redirectUri`.

### Backend

```ts
// google-oauth.service.ts (garis besar)
const client = new OAuth2Client({
  clientId: env.GOOGLE_WEB_CLIENT_ID,
  clientSecret: env.GOOGLE_WEB_CLIENT_SECRET,
});

const { tokens } = await client.getToken({ code, redirect_uri: redirectUri ?? '' });

const ticket = await client.verifyIdToken({
  idToken: tokens.id_token!,
  audience: env.GOOGLE_WEB_CLIENT_ID,
});
const payload = ticket.getPayload(); // sub, email, email_verified, name, picture
```

Pemeriksaan wajib:

1. `email_verified === true`, bila tidak tolak dengan `401 GOOGLE_AUTH_FAILED`.
2. **Scope yang benar-benar diberikan**: periksa `tokens.scope` mengandung `https://www.googleapis.com/auth/drive.file`. Layar persetujuan Google memungkinkan pengguna tidak mencentang izin tertentu. Bila tidak ada → `driveStatus = NOT_CONNECTED`, login tetap berhasil.
3. **Refresh token**: Google hanya mengirim `refresh_token` pada persetujuan pertama (atau bila client meminta `prompt=consent`). Bila `tokens.refresh_token` kosong, **jangan** menimpa yang tersimpan. Bila kosong dan belum ada yang tersimpan sementara scope Drive diberikan, kembalikan `driveStatus: "NEEDS_RECONNECT"` agar client meminta login ulang dengan `prompt=consent`.
4. Upsert user berdasarkan `googleId` (`sub`), bukan email.

Setelah user tersimpan dan Drive terhubung, panggil `storage.ensureAppFolder(userId)` bila `driveFolderId` masih kosong.

## 3. Enkripsi refresh token Google

- Algoritma: AES-256-GCM (`node:crypto`).
- Kunci: `TOKEN_ENCRYPTION_KEY`, 32 byte dalam base64. Buat dengan `openssl rand -base64 32`.
- Format tersimpan: `v1.<iv base64url>.<authTag base64url>.<ciphertext base64url>`. IV 12 byte acak setiap enkripsi.
- Prefix versi `v1` memungkinkan rotasi kunci di masa depan (dekripsi dengan kunci lama, enkripsi ulang dengan kunci baru).
- Dekripsi hanya dilakukan di `GoogleOAuthService` tepat sebelum meminta access token Google.

## 4. Token milik DayDone

| Token | Bentuk | Umur | Disimpan di |
|---|---|---|---|
| Access token | JWT HS256, payload `{ sub: userId, sid: sessionId }` | 15 menit | Memori client (web: state; mobile: memori) |
| Refresh token sesi | 32 byte acak (base64url), opaque | 30 hari, diperpanjang saat rotasi | Web: cookie `HttpOnly`; Mobile: `expo-secure-store`. Server menyimpan SHA-256-nya |

### Rotasi dan deteksi pemakaian ulang

1. Client memanggil `/auth/refresh` dengan refresh token R1.
2. Server mencari sesi dengan hash(R1). Bila tidak ada, kedaluwarsa, atau dicabut → `401 SESSION_EXPIRED`.
3. Bila sesi R1 sudah punya `replacedById` (artinya R1 pernah dipakai) → anggap token dicuri: cabut **semua** sesi user, balas `401`.
4. Bila valid: buat sesi baru dengan R2, tandai sesi R1 `revokedAt = now` dan `replacedById = sesi baru`, kembalikan access token baru + R2.

Gunakan transaksi Prisma untuk langkah 4.

### Guard

- `JwtAuthGuard` dipasang global (`APP_GUARD`). Endpoint tanpa autentikasi diberi decorator `@Public()`.
- Guard memverifikasi JWT, lalu memeriksa sesi `sid` belum dicabut. Pemeriksaan sesi boleh di-cache singkat bila nanti jadi bottleneck, tetapi pada MVP lakukan setiap request agar logout langsung berlaku.
- Decorator `@CurrentUser()` mengembalikan `{ userId, sessionId }`.

### Cookie web

- Nama `daydone_rt`, atribut `HttpOnly; Secure; Path=/api/v1/auth; Max-Age=2592000`.
- `SameSite=Lax` bila web dan API berada di domain induk yang sama (misal `app.daydone.app` dan `api.daydone.app`). Bila domain berbeda (misal `*.vercel.app` dan `*.onrender.com`), terpaksa `SameSite=None` dan beberapa browser (terutama Safari) bisa memblokirnya. Itulah alasan domain kustom direkomendasikan (ADR-0003).
- CORS: `credentials: true` dengan daftar origin eksplisit (bukan `*`).
- Proteksi CSRF untuk `/auth/refresh` dan `/auth/logout` versi web: wajib header `X-Requested-With: daydone-web` dan origin harus ada di daftar CORS.

## 5. Integrasi Google Drive

### Mendapat akses Drive untuk seorang pengguna

```ts
async getDriveClient(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.driveStatus === 'NOT_CONNECTED') throw driveNotConnected();
  if (!user.googleRefreshToken) throw driveReconnectRequired();

  const auth = new OAuth2Client({ clientId, clientSecret });
  auth.setCredentials({ refresh_token: decrypt(user.googleRefreshToken) });
  return google.drive({ version: 'v3', auth });
}
```

Library otomatis meminta access token baru dari refresh token saat dibutuhkan. Bila Google membalas `invalid_grant` (pengguna mencabut akses, refresh token kedaluwarsa, atau status Testing 7 hari):

1. Set `driveStatus = NEEDS_RECONNECT` dan `googleRefreshToken = null`.
2. Lempar `DomainException` dengan `code: DRIVE_RECONNECT_REQUIRED`.

Client lalu menjalankan ulang alur login Google dengan `prompt: 'consent'`, dan `POST /auth/google` akan menyimpan refresh token baru.

### Folder aplikasi

- Saat pertama terhubung, buat folder `DayDone` (`mimeType: application/vnd.google-apps.folder`) di root Drive pengguna dan simpan id-nya.
- Dengan scope `drive.file`, aplikasi hanya bisa melihat file dan folder yang dibuatnya sendiri. Ini memang disengaja untuk privasi.
- Bila folder dihapus pengguna (Drive membalas 404 saat unggah), buat ulang folder lalu ulangi unggah sekali.
- Struktur datar: semua foto di satu folder dengan nama `YYYY-MM-DD_<id8>.jpg`, sehingga pengguna mudah mengurutkannya di Drive.

### Unggah

1. `FilesInterceptor('files', 5, { limits: { fileSize: 10 * 1024 * 1024 } })` dengan memory storage (Multer).
2. Cek jumlah lampiran yang sudah ada + jumlah file baru ≤ 5.
3. `ImageProcessor.process(buffer)` dengan sharp: `rotate()` → `resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })` → `jpeg({ quality: 82, mozjpeg: true })` (atau `png()` bila ada alpha). Sharp secara default tidak menyalin metadata EXIF ke output, sehingga GPS ikut terhapus. Bila sharp gagal mendekode → `415 UNSUPPORTED_FILE_TYPE`.
4. Batasi konkurensi pemrosesan gambar (misal `p-limit` dengan 2) agar memori instance kecil aman.
5. `drive.files.create({ requestBody: { name, parents: [folderId] }, media: { mimeType, body: Readable.from(buffer) }, fields: 'id,size' })`.
6. Simpan `Attachment`. Bila penyimpanan database gagal, panggil `trash` untuk file yang sudah terunggah.

### Menampilkan

- Token URL: `base64url(attachmentId.userId.expiresAtEpoch) + "." + base64url(HMAC-SHA256(payload, ATTACHMENT_URL_SECRET))`. Berlaku 5 menit.
- Endpoint konten memverifikasi tanda tangan dengan perbandingan waktu-konstan (`timingSafeEqual`), memastikan belum kedaluwarsa, dan memastikan lampiran masih milik `userId` di token.
- Ambil file dengan `drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' })` lalu pipe ke response.

### Menghapus

- Gunakan `drive.files.update({ fileId, requestBody: { trashed: true } })` (pindah ke Trash), bukan hapus permanen. Pengguna masih bisa memulihkan file dari Trash Drive selama periode retensi Google.
- Kegagalan trash tidak menggagalkan penghapusan di database; catat sebagai warning.

### Pemetaan error Drive

| Respons Google | Kode DayDone |
|---|---|
| `invalid_grant` saat refresh | `DRIVE_RECONNECT_REQUIRED` |
| 403 `storageQuotaExceeded` | `DRIVE_STORAGE_FULL` |
| 404 file (saat tampil) | `404` biasa; tandai lampiran rusak di log |
| 404 folder (saat unggah) | buat ulang folder, ulangi sekali |
| 429 / 5xx | ulangi dengan backoff (maks. 2 kali), lalu `DRIVE_UNAVAILABLE` |

## 6. Hapus akun

1. Ambil dan dekripsi refresh token Google; panggil `OAuth2Client.revokeToken()` (abaikan bila gagal).
2. Hapus user dalam satu transaksi (cascade ke sesi, logbook, lampiran).
3. Hapus cookie refresh token (web).
4. File di Drive tidak dihapus; client menampilkan informasi ini sebelum konfirmasi.

## 7. Mode development tanpa Google (Selesai — Digantikan oleh JwtAuthGuard)

Pada Milestone M3 digunakan `DevAuthGuard` sementara. Setelah Milestone M4 selesai, `DevAuthGuard` dan variabel `DEV_AUTH_ENABLED` **telah dihapus sepenuhnya**. Seluruh endpoint kini diproteksi oleh `JwtAuthGuard` global, dan pengujian otomatis/development menggunakan `FakeGoogleOAuthService` atau token JWT resmi.
