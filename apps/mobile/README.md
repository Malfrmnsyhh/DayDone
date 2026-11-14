# DayDone Mobile App (Expo + React Native)

Aplikasi mobile DayDone untuk mahasiswa magang mencatat logbook harian dan dokumentasi foto secara cepat dari smartphone.

---

## 1. Menjalankan Aplikasi dengan API Lokal

Aplikasi mobile memerlukan koneksi ke backend API DayDone (`apps/api`). 

> **Penting untuk HP Fisik & Emulator:**
> `localhost` di dalam HP merujuk ke HP itu sendiri, bukan ke laptop Anda. 
> - **HP Fisik:** Gunakan alamat **IP lokal laptop** pada jaringan Wi-Fi yang sama (contoh: `http://192.168.1.15:3000/api/v1`).
> - **Android Emulator:** Dapat menggunakan alias loopback default Android `http://10.0.2.2:3000/api/v1` atau IP lokal laptop.
> - **Tunneling (Alternatif):** Dapat menggunakan ngrok / Cloudflare Tunnel bila berada di jaringan yang mengisolasi koneksi antar-perangkat.

### Langkah-langkah:

1. **Cari IP Lokal Laptop Anda:**
   - Di Windows: buka PowerShell/Terminal dan jalankan `ipconfig`.
   - Cari baris `IPv4 Address` pada adapter Wi-Fi/Ethernet Anda (contoh: `192.168.1.15`).

2. **Buat file `.env` di `apps/mobile`:**
   ```env
   EXPO_PUBLIC_API_URL=http://192.168.1.15:3000/api/v1
   ```

3. **Jalankan API Backend:**
   Dari root monorepo:
   ```bash
   pnpm --filter api start:dev
   ```

4. **Jalankan Aplikasi Mobile:**
   Dari root monorepo:
   ```bash
   pnpm --filter mobile start
   ```
   Atau masuk ke direktori mobile:
   ```bash
   cd apps/mobile
   pnpm start
   ```

---

## 2. Environment Variables

| Variabel | Deskripsi | Default / Contoh |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL endpoint API backend DayDone | `http://localhost:3000/api/v1` (lokal) |

---

## 3. Daftar Kredensial yang Perlu Disiapkan untuk M8-2 (Google Login Native)

Autentikasi Google pada aplikasi mobile menggunakan alur kode otorisasi native (`@react-native-google-signin/google-signin`), yang menghasilkan `serverAuthCode` untuk ditukarkan di backend API dengan sesi DayDone.

Untuk mengaktifkan fitur ini pada Milestone M8-2, pemilik proyek perlu menyiapkan:

1. **Akun Expo & EAS CLI:**
   - Buat akun di [expo.dev](https://expo.dev).
   - Login via terminal dengan perintah `npx eas-cli login`.
   - Google Sign-In native memerlukan **Development Build** (`npx eas build --profile development --platform android`), karena pustaka native Google Play Services tidak dapat berjalan di dalam Expo Go standar.

2. **Android OAuth Client ID (Google Cloud Console):**
   - Buka Google Cloud Console pada project DayDone yang sama dengan backend.
   - Buat OAuth Client ID baru dengan Application Type: **Android**.
   - Masukkan Package Name aplikasi (contoh: `app.daydone.mobile` di `app.json`).

3. **SHA-1 Fingerprint Sertifikat:**
   - **Debug (Lokal):** Dapatkan dari keystore debug lokal dengan menjalankan:
     ```bash
     keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
     ```
   - **EAS Build / Production:** Dapatkan SHA-1 dari dashboard kredensial Expo setelah menjalankan `eas credentials` atau build pertama.

4. **Web Client ID:**
   - Tetap gunakan Web Client ID yang sudah terdaftar di backend (`GOOGLE_WEB_CLIENT_ID`). Nilai ini akan dimasukkan ke konfigurasi Google Sign-In di mobile (`webClientId`) agar Google menerbitkan `serverAuthCode` offline yang valid untuk ditukarkan oleh server.
