# ADR-0005: Unggah foto melalui API untuk MVP

**Status:** Accepted
**Tanggal:** 2026-11-02

## Context
Ada dua cara mengunggah ke Drive: client mengirim file ke API lalu API meneruskan ke Drive, atau API membuat resumable upload session lalu client mengunggah langsung ke Drive.

## Decision
Untuk MVP, client mengirim `multipart/form-data` ke API. API memproses gambar dengan sharp (rotate, resize 2048 px, hapus EXIF, re-encode) lalu mengunggah ke Drive.

## Options Considered
| Opsi | Kompleksitas | Kelebihan | Kekurangan |
|---|---|---|---|
| **Lewat API** | Rendah | Validasi dan pemrosesan terpusat; EXIF pasti terhapus; satu alur untuk web dan mobile | Bandwidth dan memori API terpakai |
| Direct resumable upload | Tinggi | API ringan; mendukung file besar dan unggah yang bisa dilanjutkan | Validasi/pemrosesan harus di client; CORS dan finalisasi metadata lebih rumit |

## Consequences
- Lebih mudah: implementasi dan pengujian; jaminan privasi (EXIF).
- Lebih sulit: instance API kecil perlu pembatasan konkurensi pemrosesan gambar.
- Ditinjau ulang bila beban unggah membebani API (task P-6).
