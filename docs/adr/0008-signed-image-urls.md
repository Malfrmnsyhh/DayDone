# ADR-0008: Gambar ditampilkan lewat URL bertanda tangan berumur pendek

**Status:** Accepted
**Tanggal:** 2026-11-02

## Context
Foto bersifat pribadi. Tag `<img>` di web tidak bisa mengirim header `Authorization`, dan file Drive tidak boleh dibuat publik.

## Decision
API mengeluarkan URL `/attachments/:id/content?token=...` dengan token HMAC-SHA256 berisi id lampiran, id pengguna, dan waktu kedaluwarsa (5 menit). Endpoint konten memverifikasi token lalu mengalirkan file dari Drive dengan `Cache-Control: private, max-age=300`.

## Options Considered
| Opsi | Kelebihan | Kekurangan |
|---|---|---|
| **URL bertanda tangan** | Bekerja dengan `<img>` dan `Image` React Native; tidak membuat file publik | URL bisa dipakai siapa pun selama 5 menit bila bocor |
| Proxy dengan header Authorization | Paling ketat | Web harus fetch blob lalu `URL.createObjectURL`; lebih rumit |
| Link Drive "anyone with link" | Sangat sederhana | File publik selamanya bila link bocor |
| `thumbnailLink` Drive | Cepat | URL sementara dan perilakunya tidak terdokumentasi stabil untuk penggunaan ini |

## Consequences
- Lebih mudah: menampilkan gambar di semua client.
- Lebih sulit: setiap tampilan gambar melewati API dan memanggil Drive; cache client penting.
