# 06 — Keamanan dan Privasi

## 1. Aset yang dilindungi

| Aset | Mengapa penting |
|---|---|
| Refresh token Google pengguna | Memberi akses ke file DayDone di Drive pengguna |
| Refresh token sesi DayDone | Memberi akses penuh ke akun DayDone |
| Isi logbook | Bisa berisi informasi internal perusahaan tempat magang |
| Foto dokumentasi | Bisa berisi wajah, dokumen kerja, dan lokasi |

## 2. Ancaman dan mitigasi

| Ancaman | Mitigasi |
|---|---|
| **IDOR** (mengakses data user lain dengan menebak id) | Semua query di-scope `userId`; data orang lain dibalas `404`; e2e test khusus lintas pengguna untuk setiap endpoint |
| **Kebocoran token Google** dari database | Enkripsi AES-256-GCM, kunci di env terpisah dari database; scope minimal `drive.file` |
| **Pencurian refresh token sesi** | Disimpan sebagai hash; rotasi setiap pemakaian; deteksi pemakaian ulang mencabut semua sesi; web memakai cookie `HttpOnly` |
| **XSS di web** | React meng-escape teks secara default; dilarang `dangerouslySetInnerHTML` untuk deskripsi; access token hanya di memori; header CSP dari Vercel |
| **CSRF** pada endpoint berbasis cookie | Cookie hanya di path `/api/v1/auth`; wajib header `X-Requested-With`; pengecekan origin |
| **File berbahaya** yang diunggah | File didekode dan di-encode ulang dengan sharp; hanya format gambar tertentu; batas ukuran; `X-Content-Type-Options: nosniff` |
| **Kebocoran lokasi** dari EXIF | Metadata dihapus saat pemrosesan |
| **Brute force / spam** | `@nestjs/throttler` (lihat batas di API spec) |
| **Header tidak aman** | `helmet` di API |
| **Rahasia ter-commit** | `.env` di `.gitignore`; `.env.example` tanpa nilai asli; secret scanning GitHub diaktifkan |
| **Detail error bocor** | Error 500 tanpa stack trace ke client; detail hanya di log server |
| **Token di log** | Logger tidak pernah mencetak header `Authorization`, cookie, body `/auth/*`, atau objek token Google |
| **Dependency rentan** | `pnpm audit` di CI; Dependabot/Renovate; pin versi mayor |
| **Konfigurasi dev lolos ke produksi** | Validasi env dengan Zod saat start; aplikasi menolak start bila `DEV_AUTH_ENABLED=true` di produksi |

## 3. Privasi

- Aplikasi hanya meminta `openid email profile drive.file`. Tidak pernah meminta akses penuh Drive.
- File tidak pernah dibuat publik atau dibagikan ("anyone with link" dilarang).
- Data yang disimpan di database: profil dasar Google (nama, email, foto profil), isi logbook, metadata lampiran.
- Pengguna bisa menghapus akun dan seluruh datanya (US-03).
- Kebijakan privasi wajib tersedia sebelum aplikasi Google dipublikasikan. Isinya minimal: data apa yang dikumpulkan, untuk apa, di mana disimpan, cara menghapus, dan penjelasan bahwa foto tersimpan di Drive pengguna. Penggunaan data dari Google API harus mematuhi Google API Services User Data Policy.

## 4. Checklist per fitur

Gunakan checklist ini di setiap PR yang menyentuh endpoint:

- [ ] Input divalidasi dengan schema Zod (body, query, param).
- [ ] Query database memakai `userId` dari `@CurrentUser()`, bukan dari input client.
- [ ] Ada e2e test bahwa user B tidak bisa membaca/mengubah/menghapus data user A.
- [ ] Response tidak berisi field rahasia (lihat `docs/03-data-model.md` bagian 5).
- [ ] Tidak ada token atau data sensitif di log.
- [ ] Error dari layanan eksternal dipetakan ke kode error yang aman.

## 5. Checklist sebelum produksi

- [ ] `NODE_ENV=production`, Swagger nonaktif, `DEV_AUTH_ENABLED` tidak ada.
- [ ] Semua secret dibuat ulang khusus produksi (JWT, enkripsi token, HMAC URL).
- [ ] CORS hanya mengizinkan origin web produksi.
- [ ] HTTPS aktif di semua domain.
- [ ] Koneksi database memakai SSL.
- [ ] Rate limit aktif.
- [ ] Backup database Supabase dipahami (fitur dan batasan sesuai paket).
- [ ] Kebijakan privasi dan halaman beranda tersedia; aplikasi Google dipublikasikan.
- [ ] `pnpm audit` tanpa temuan high/critical.
