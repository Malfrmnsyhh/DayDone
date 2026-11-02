# ADR-0003: Google OAuth sebagai satu-satunya login, sesi dikelola sendiri

**Status:** Accepted
**Tanggal:** 2026-11-02

## Context
Setiap pengguna menyimpan foto di Drive-nya sendiri, sehingga setiap pengguna pasti memberi izin Google. Backend membutuhkan refresh token Google yang tersimpan permanen untuk mengakses Drive kapan saja.

## Decision
- Login hanya dengan Google (authorization code flow), dengan scope `openid email profile drive.file` dan akses offline.
- Code ditukar di backend; refresh token Google disimpan terenkripsi.
- DayDone menerbitkan JWT access token (15 menit) dan refresh token sesi opaque (30 hari, dirotasi, hash disimpan di DB).
- Web menerima refresh token sesi lewat cookie `HttpOnly`; mobile lewat body dan menyimpannya di secure storage.

## Options Considered
| Opsi | Kelebihan | Kekurangan |
|---|---|---|
| **Google OAuth langsung di NestJS** | Satu kali login sekaligus mendapat izin Drive; kontrol penuh atas refresh token Google | Harus membangun sesi sendiri |
| Supabase Auth (provider Google) | Sesi siap pakai | Refresh token Google tidak disimpan permanen oleh Supabase, sehingga akses Drive dari backend tetap butuh alur terpisah |
| Login email/password + hubungkan Drive terpisah | Tidak bergantung pada Google untuk login | Dua langkah, lebih banyak fitur (reset password, verifikasi email) |

## Consequences
- Lebih mudah: pengalaman login satu langkah; tidak ada password untuk dikelola.
- Lebih sulit: rotasi sesi, deteksi reuse, enkripsi token harus diimplementasikan dan diuji dengan teliti.
- Cookie lintas domain (Vercel ↔ Render) bisa diblokir browser; domain kustom dengan domain induk sama sangat disarankan sebelum rilis.
