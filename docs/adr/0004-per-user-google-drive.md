# ADR-0004: Foto disimpan di Google Drive masing-masing pengguna

**Status:** Accepted
**Tanggal:** 2026-11-02

## Context
Kapasitas penyimpanan gratis layanan seperti Supabase Storage terbatas, dan aplikasi ini tidak punya anggaran penyimpanan. Pengguna juga lebih tenang bila memiliki file aslinya.

## Decision
Foto disimpan di folder `DayDone` pada Drive pengguna, memakai scope `drive.file` (aplikasi hanya bisa mengakses file yang dibuatnya sendiri). Database menyimpan `driveFileId` dan metadata. Semua akses lewat interface `StorageProvider`.

## Options Considered
| Opsi | Biaya bagi pengelola | Kelebihan | Kekurangan |
|---|---|---|---|
| **Drive pengguna** | Nol | File milik pengguna; kapasitas mengikuti akun pengguna (berbagi 15 GB gratis dengan Gmail/Photos) | Bergantung pada token yang bisa dicabut; latensi Drive API; perlu verifikasi aplikasi Google untuk publik |
| Supabase Storage | Gratis terbatas, lalu berbayar | Sederhana, terintegrasi | Kapasitas terbatas |
| Cloudflare R2 / Backblaze B2 | Murah, ada kuota gratis | Cepat, tanpa token pengguna | Tetap ada biaya saat tumbuh; file bukan milik pengguna |
| Drive dengan service account | — | — | Service account tidak punya kuota penyimpanan untuk akun biasa |

## Consequences
- Lebih mudah: tidak ada biaya penyimpanan; privasi lebih baik.
- Lebih sulit: alur "hubungkan ulang Drive"; penanganan Drive penuh; foto tidak tampil bila akses dicabut.
- Abstraksi `StorageProvider` menjaga opsi pindah ke R2 tetap terbuka.
