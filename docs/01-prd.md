# 01 — Product Requirements Document (PRD)

| | |
|---|---|
| **Produk** | DayDone |
| **Versi dokumen** | 1.0 |
| **Tanggal** | 2 November 2026 |
| **Pemilik** | Pemilik proyek (mahasiswa magang, developer tunggal) |
| **Status** | Disetujui untuk MVP |

## 1. Ringkasan

DayDone adalah aplikasi logbook harian yang membantu mahasiswa magang mencatat kegiatan setiap hari secara konsisten, lengkap dengan foto dokumentasi. Catatan bisa dibuat dari HP saat di tempat magang, lalu ditinjau dan dirapikan dari dashboard web. Foto disimpan di Google Drive milik pengguna sendiri sehingga aplikasi tidak menanggung biaya penyimpanan, dan pengguna tetap memiliki file aslinya.

## 2. Latar belakang dan masalah

Mahasiswa magang umumnya wajib membuat logbook harian sebagai syarat tugas akhir atau laporan magang. Masalah yang sering muncul:

1. **Lupa mencatat.** Kegiatan baru ditulis berhari-hari kemudian sehingga detailnya hilang.
2. **Dokumentasi tercecer.** Foto kegiatan ada di galeri HP, chat, dan laptop, tidak terhubung dengan tanggal logbook.
3. **Format tidak konsisten.** Catatan tersebar di notes, dokumen, dan spreadsheet sehingga sulit direkap saat menyusun laporan.
4. **Penyimpanan terbatas.** Layanan penyimpanan gratis cepat penuh bila semua foto disimpan di server aplikasi.

## 3. Tujuan

| ID | Tujuan | Ukuran keberhasilan |
|---|---|---|
| G1 | Mencatat logbook harian dalam waktu singkat dari HP | Logbook baru (tanpa foto) bisa disimpan dalam ≤ 30 detik sejak aplikasi dibuka |
| G2 | Foto dokumentasi terhubung langsung ke tanggal logbook | 100% foto yang diunggah tampil di logbook yang benar |
| G3 | Data aman dan hanya bisa diakses pemiliknya | Tidak ada endpoint yang mengembalikan data pengguna lain (diverifikasi test) |
| G4 | Tanpa biaya penyimpanan file bagi pengelola aplikasi | Seluruh file berada di Drive pengguna |
| G5 | Satu backend untuk web dan mobile | Web dan mobile memakai endpoint yang sama tanpa endpoint khusus platform (kecuali detail login) |

## 4. Bukan tujuan (non-goals) untuk MVP

- Ekspor PDF logbook (direncanakan setelah MVP).
- Akses pembimbing atau berbagi logbook ke orang lain.
- Mode offline di mobile.
- Login selain Google (email/password, GitHub, dll).
- Kolaborasi atau logbook tim.
- Notifikasi pengingat harian.
- Penyimpanan selain Google Drive.

## 5. Persona

**Rina, mahasiswa magang (pengguna utama).** Magang 3–6 bulan di perusahaan. Aktif memakai HP dan punya akun Google. Butuh mencatat kegiatan setiap sore sebelum pulang, memotret kegiatan atau hasil kerja, lalu di akhir magang merekap semuanya ke laporan.

**Pembimbing (pengguna masa depan, di luar MVP).** Ingin melihat progres logbook mahasiswa bimbingannya tanpa harus meminta file.

## 6. User stories dan acceptance criteria

### Autentikasi

**US-01: Login dengan Google**
Sebagai pengguna, saya ingin masuk dengan akun Google agar tidak perlu membuat password baru dan foto saya tersimpan di Drive saya.
- Pengguna menekan "Masuk dengan Google", memilih akun, dan menyetujui izin profil + Drive.
- Setelah berhasil, pengguna masuk ke halaman daftar logbook.
- Pada login pertama, folder `DayDone` dibuat di Drive pengguna.
- Bila pengguna menolak izin Drive, pengguna tetap bisa masuk dan membuat logbook teks, tetapi fitur unggah foto menampilkan ajakan untuk menghubungkan Drive.

**US-02: Tetap login**
Sebagai pengguna, saya tidak ingin login ulang setiap membuka aplikasi.
- Sesi bertahan hingga 30 hari tanpa aktivitas.
- Pengguna bisa logout, dan sesi di perangkat itu langsung tidak berlaku.

**US-03: Hapus akun**
Sebagai pengguna, saya ingin bisa menghapus akun dan seluruh data logbook saya.
- Setelah konfirmasi, semua data logbook, lampiran (metadata), dan sesi dihapus dari database.
- Akses aplikasi ke akun Google dicabut.
- Pengguna diberi tahu bahwa file foto tetap ada di Drive miliknya dan bisa dihapus manual.

### Logbook

**US-04: Membuat logbook harian**
Sebagai pengguna, saya ingin mencatat kegiatan hari ini dengan tanggal dan deskripsi.
- Tanggal default adalah hari ini (menurut perangkat pengguna) dan bisa diubah ke tanggal lain.
- Deskripsi wajib diisi, 1–5000 karakter, spasi di awal/akhir dipangkas.
- Hanya boleh ada satu logbook per tanggal. Bila tanggal sudah dipakai, pengguna mendapat pesan yang jelas dan tautan ke logbook yang sudah ada.

**US-05: Melihat daftar logbook**
Sebagai pengguna, saya ingin melihat logbook saya terurut dari tanggal terbaru.
- Daftar menampilkan tanggal, potongan deskripsi, dan jumlah foto.
- Bisa difilter berdasarkan rentang tanggal dan dicari berdasarkan kata di deskripsi.
- Daftar dipaginasi (default 20 per halaman).

**US-06: Melihat detail logbook**
- Menampilkan tanggal, deskripsi lengkap, dan semua foto.
- Foto bisa diperbesar.

**US-07: Mengubah logbook**
- Pengguna bisa mengubah tanggal dan/atau deskripsi. Aturan satu logbook per tanggal tetap berlaku.

**US-08: Menghapus logbook**
- Ada konfirmasi sebelum menghapus.
- Logbook dan metadata fotonya dihapus. File foto dipindahkan ke Trash di Drive pengguna.

### Dokumentasi foto

**US-09: Menambahkan foto**
Sebagai pengguna, saya ingin melampirkan foto dokumentasi ke logbook (opsional).
- Foto bisa diambil dari kamera (mobile) atau dipilih dari galeri/file.
- Maksimal 5 foto per logbook, maksimal 10 MB per foto sebelum diproses.
- Format diterima: JPEG, PNG, WebP. Di mobile, HEIC dikonversi ke JPEG sebelum diunggah.
- Foto diperkecil (sisi terpanjang maks. 2048 px) dan metadata lokasi (EXIF GPS) dihapus sebelum disimpan.
- Foto tersimpan di folder `DayDone` di Drive pengguna.

**US-10: Menghapus foto**
- Foto bisa dihapus satu per satu dari logbook. File dipindahkan ke Trash di Drive.

**US-11: Menghubungkan ulang Drive**
Sebagai pengguna, bila akses Drive dicabut atau kedaluwarsa, saya ingin diberi tahu dan bisa menghubungkannya lagi.
- Saat unggah gagal karena akses Drive tidak valid, aplikasi menampilkan pesan dan tombol "Hubungkan ulang Google Drive".
- Logbook teks tetap bisa dibuat dan dibaca selama Drive belum terhubung ulang (foto yang sudah ada mungkin tidak bisa ditampilkan).

## 7. Kebutuhan fungsional

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-01 | Login hanya dengan Google OAuth (web dan mobile) | Must |
| FR-02 | Sesi dengan access token pendek + refresh token yang dirotasi | Must |
| FR-03 | Logout per perangkat | Must |
| FR-04 | CRUD logbook (tanggal, deskripsi) milik pengguna sendiri | Must |
| FR-05 | Satu logbook per tanggal per pengguna | Must |
| FR-06 | Daftar logbook dengan filter tanggal, pencarian, dan paginasi | Must |
| FR-07 | Unggah foto (maks. 5 per logbook) ke Drive pengguna | Must |
| FR-08 | Menampilkan foto tanpa membuat file publik | Must |
| FR-09 | Hapus foto dan pindahkan file ke Trash Drive | Must |
| FR-10 | Deteksi akses Drive tidak valid dan alur hubungkan ulang | Must |
| FR-11 | Hapus akun beserta seluruh data | Should |
| FR-12 | Dokumentasi API interaktif (Swagger) di lingkungan non-produksi | Should |
| FR-13 | Ringkasan statistik (jumlah logbook bulan ini, hari tanpa logbook) di dashboard | Could |

## 8. Kebutuhan non-fungsional

| ID | Kategori | Kebutuhan |
|---|---|---|
| NFR-01 | Keamanan | Semua data di-scope per pengguna; token Google disimpan terenkripsi (AES-256-GCM); HTTPS di produksi |
| NFR-02 | Privasi | EXIF/GPS dihapus dari foto; file tidak pernah dibuat publik; aplikasi hanya meminta scope `drive.file` |
| NFR-03 | Performa | p95 endpoint logbook (tanpa unggah) < 500 ms di region Singapura; unggah satu foto 5 MB < 10 detik pada koneksi 10 Mbps |
| NFR-04 | Ketersediaan | Target sesuai free tier; cold start API diperbolehkan pada MVP |
| NFR-05 | Skala | Dirancang untuk ≤ 1.000 pengguna dan ≤ 200.000 logbook tanpa perubahan arsitektur |
| NFR-06 | Kualitas | Cakupan test unit service inti ≥ 80%; e2e untuk semua endpoint |
| NFR-07 | Maintainability | Satu bahasa (TypeScript) di backend, web, mobile; schema validasi dibagi lewat `packages/shared` |
| NFR-08 | Aksesibilitas | Web memenuhi kontras WCAG AA dan bisa dioperasikan dengan keyboard |
| NFR-09 | Lokalisasi | Antarmuka dan pesan error berbahasa Indonesia; format tanggal Indonesia (contoh: Senin, 2 November 2026) |

## 9. Scope MVP

**Termasuk:** FR-01 sampai FR-11, backend + web dashboard + aplikasi mobile Android (iOS bila memungkinkan).

**Rilis bertahap:** backend dan web lebih dulu, lalu mobile. Detail urutan ada di `docs/09-roadmap.md`.

## 10. Rencana setelah MVP

1. **Ekspor PDF** logbook per rentang tanggal, dengan format yang bisa dilampirkan ke laporan magang (format menyesuaikan template kampus).
2. **Akses pembimbing**: tautan baca-saja atau akun pembimbing dengan izin dari mahasiswa.
3. **Pengingat harian** (push notification) bila belum mengisi logbook.
4. **Template deskripsi** (kegiatan, hasil, kendala, rencana besok).
5. **Mode offline** di mobile dengan sinkronisasi.
6. **Penyimpanan alternatif** (Cloudflare R2) bila pengguna tidak ingin memakai Drive.

## 11. Asumsi

- Semua pengguna punya akun Google dan bersedia memberi izin `drive.file`.
- Satu logbook per hari sudah cukup untuk kebutuhan magang.
- Tanggal logbook adalah tanggal kalender lokal pengguna dan tidak perlu zona waktu.
- Selama pengembangan, aplikasi Google Cloud berstatus "Testing" (maks. 100 test user). Sebelum dibuka untuk umum, aplikasi dipublikasikan dan dilengkapi kebijakan privasi.

## 12. Pertanyaan terbuka

| # | Pertanyaan | Dampak | Perlu diputuskan sebelum |
|---|---|---|---|
| Q1 | Mobile final memakai React Native (Expo) atau Flutter? | Struktur `apps/mobile` dan cara berbagi tipe | M8 |
| Q2 | Apakah satu hari perlu bisa berisi beberapa entri? | Constraint `@@unique([userId, date])` | Sebelum rilis publik |
| Q3 | Format PDF mengikuti template kampus tertentu? | Desain fitur ekspor | Fase setelah MVP |
| Q4 | Domain kustom (misal `daydone.app`) akan dipakai? | Konfigurasi cookie refresh token web | M9 |
