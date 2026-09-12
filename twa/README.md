# FleetVision AI — TWA (Trusted Web Activity)

Bungkus halaman web `/track` (Laravel + Inertia) jadi aplikasi Android Play Store
tanpa menulis ulang kode native. Standar Google: **PWA + Bubblewrap + assetlinks**.

Paket: `com.fleetvisionai.twa` · Start URL: `/track?utm_source=twa`

```
Browser (Chrome/TWA)
  /track, /driver, /login  (PWA: manifest + sw.js)
        │
        ▼
Laravel backend (https://domain-kamu/)
  /.well-known/assetlinks.json  ← verifikasi ke Play Store
        │
        ▼
twa/ (Bubblewrap) → .aab → Play Store
```

Aplikasi native lama (`mobile/`, `com.fleetvisionai`) tetap ada dan tidak diubah.

---

## 1. Prasyarat

- [x] Backend sudah PWA (sudah dibuatkan): `public/manifest.webmanifest`, `public/sw.js`, `public/offline.html`, `public/icons/*`
- [ ] Domain **HTTPS publik** (wajib untuk TWA, mis. `fleet.example.com`)
- [ ] Node 20+, Java 17, Android SDK (atau pakai Android Studio)
- [ ] Akun Google Play Console (untuk upload `.aab`)

> Lokal (`http://localhost:8000`) **tidak bisa** diverifikasi TWA.
> Untuk dev lokal cukup "Install as app" dari Chrome (PWA). TWA penuh butuh HTTPS publik.

## 2. Deploy backend dulu

```bash
cd backend
# .env produksi:
# APP_URL=https://fleet.example.com
# TWA_PACKAGE=com.fleetvisionai.twa
# TWA_SHA256_1=<isi nanti setelah keystore jadi>
npm run build
php artisan migrate --force
```

Cek manual (harus 200 OK):

```
https://fleet.example.com/manifest.webmanifest
https://fleet.example.com/sw.js
https://fleet.example.com/icons/icon-512.png
https://fleet.example.com/.well-known/assetlinks.json
https://fleet.example.com/track
```

Cek Lighthouse PWA di Chrome DevTools → harus lolos Installable
(manifest + icons 192/512 + maskable + theme_color + service worker + HTTPS).

## 3. Ganti domain placeholder

Di folder ini, ganti semua `fleetvision.example.com` dengan domain asli:

- `twa/twa-manifest.json`: `host`, `iconUrl`, `maskableIconUrl`, `monochromeIconUrl`, `fullScopeUrl`

Find & replace:

```bash
# Windows PowerShell, dari D:\Code\dtrack\twa
(Get-Content twa-manifest.json) -replace 'fleetvision.example.com','fleet.example.com' | Set-Content twa-manifest.json
```

## 4. Build APK/AAB dengan Bubblewrap

```bash
cd twa
npm install
npx bubblewrap doctor      # pastikan JDK + Android SDK OK
npx bubblewrap init --manifest ./twa-manifest.json
# → akan membuat folder ./app + meminta buat keystore baru (android.keystore).
#    SIMPAN keystore + password baik-baik, hilang = tidak bisa update aplikasi!

npx bubblewrap build --manifest ./twa-manifest.json
# → hasil: app-release-signed.apk + app-release-bundle.aab
```

Keystore debug lokal juga bisa dibuat manual:

```bash
keytool -genkey -v -keystore android.keystore -alias fleetvision -keyalg RSA -keysize 2048 -validity 10000
keytool -list -v -keystore android.keystore -alias fleetvision
# catat SHA-256 certificate fingerprint
```

## 5. Sambungkan assetlinks (hilangkan address bar)

TWA tanpa verifikasi akan tampil address bar Chrome. Agar fullscreen:

1. Ambil SHA-256 dari keystore **dan** dari Play Console
   (Play Console → Setup → App integrity → SHA-256).
2. Isi ke backend:

```env
TWA_PACKAGE=com.fleetvisionai.twa
TWA_SHA256_1=AA:BB:CC:... (upload/release key)
TWA_SHA256_2=DD:EE:FF:... (Play signing / debug)
```

3. Redeploy, lalu cek:

```bash
curl https://fleet.example.com/.well-known/assetlinks.json
```

Harus mengembalikan `package_name: com.fleetvisionai.twa` + fingerprint asli
(tanpa `REPLACE_WITH_...`).

4. Verifikasi resmi Google:
   https://developers.google.com/digital-asset-links/tools/generator
   atau di device: install release APK → buka aplikasi → tidak ada URL bar.

> File statis cadangan ada di `backend/public/.well-known/assetlinks.json`,
> tapi yang aktif saat runtime adalah route Laravel
> (`routes/web.php` → `config/twa.php`) agar fingerprint bisa via `.env`.

## 6. Upload ke Play Store

1. Play Console → Create app → package `com.fleetvisionai.twa`
2. Upload `app-release-bundle.aab` ke track Internal testing dulu
3. Isi Data safety: lokasi (GPS tracking!), jelaskan kenapa butuh lokasi foreground
4. Geolocation di TWA ikut izin Chrome — pastikan `/track` & `/driver`
   diakses via HTTPS, kalau tidak GPS browser diblokir

## 7. Update berikutnya

```bash
# naikkan appVersionCode di twa-manifest.json (2, 3, ...), lalu:
npx bubblewrap update --manifest ./twa-manifest.json
npx bubblewrap build --manifest ./twa-manifest.json
```

Web-nya sendiri tidak perlu update APK — cukup deploy Laravel seperti biasa.

## 8. Troubleshooting

| Gejala | Penyebab / solusi |
|--------|-------------------|
| Masih ada URL bar | `assetlinks.json` salah domain / salah SHA-256 / belum HTTPS / cache (tunggu ±1 jam) |
| `sw.js` 404 / MIME salah | Pastikan `public/sw.js` ikut deploy, bukan hanya `public/build`. Laravel default sudah serve |
| GPS tidak jalan | TWA butuh HTTPS + izin lokasi Chrome. Test di Chrome Android dulu sebelum build |
| Ikon pecah / splash jelek | Ganti `public/icons/*.png` (192/512/maskable) lalu `npm run build`, update `twa-manifest.json` |
| Mau start di `/driver` | Ganti `startUrl` di `twa-manifest.json` + `id/start_url` di `public/manifest.webmanifest` |

## File terkait

- `../backend/public/manifest.webmanifest` — PWA manifest (`start_url: /track`)
- `../backend/public/sw.js` — offline cache (navigasi → `offline.html`)
- `../backend/public/offline.html` — fallback offline
- `../backend/routes/web.php` — route `/.well-known/assetlinks.json`
- `../backend/config/twa.php` — package + fingerprints via `.env`
