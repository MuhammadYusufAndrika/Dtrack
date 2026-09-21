# FleetVision AI — Konteks Lengkap untuk GPT
Domain produksi: https://dtrack.yusufandrika.dev

Dokumen ini adalah sumber kebenaran tunggal (single source of truth) tentang proyek FleetVision AI.
Gunakan untuk menjawab pertanyaan, debugging, dan membuat kode baru yang konsisten dengan arsitektur yang ada.

---

## 1. Ringkasan Proyek

FleetVision AI = platform fleet management + driver monitoring real-time.
Status: Prototype / MVP.

Alur besar:
```
HP Android (GPS + Kamera) / Browser Driver
  │  POST /api/location (tiap 5 detik)
  │  WebSocket frame base64 -> AI Service
  ▼
AI Service (Python FastAPI :5000)
  │  YOLOv8n + MediaPipe + OpenCV
  │  POST /api/ai/result (X-API-Key)
  ▼
Backend Laravel 12 + Inertia + React 19 (:8000)
  │  Sanctum Auth + MySQL + Redis + Reverb WebSocket (:8080)
  ▼
Dashboard Admin + Driver + Public Track (React via Inertia)
```

Peran tiap bagian:
- Laptop/Server: AI Server + Laravel Backend + Dashboard.
- HP: GPS Tracker + Kamera (bisa via browser ATAU via APK native).
- Production: smartphone diganti GPS Tracker + IP Camera + Jetson (roadmap).

---

## 2. Domain Produksi

Domain kanonis: `dtrack.yusufandrika.dev`
Wajib HTTPS (Let's Encrypt / Cloudflare). HTTP biasa menyebabkan error browser:
`Only secure origins are allowed` untuk `getUserMedia` dan `geolocation`.

Pemetaan URL produksi yang benar:
| URL | Tujuan |
|-----|--------|
| `https://dtrack.yusufandrika.dev/` | Laravel (redirect ke `/track`) |
| `https://dtrack.yusufandrika.dev/login` | Login Admin + Driver |
| `https://dtrack.yusufandrika.dev/admin/*` | Dashboard Admin |
| `https://dtrack.yusufandrika.dev/driver`, `/driver/trips`, `/driver/alerts` | Dashboard Driver |
| `https://dtrack.yusufandrika.dev/track` | Public tracking |
| `https://dtrack.yusufandrika.dev/api/*` | REST API Laravel |
| `https://dtrack.yusufandrika.dev/ai/*` | Reverse proxy Nginx -> `127.0.0.1:5000/` (AI Service) |
| `wss://dtrack.yusufandrika.dev/ai/inference/stream` | AI WebSocket (kamera driver) |
| `wss://dtrack.yusufandrika.dev:443` atau `/app` | Laravel Reverb WebSocket |
| `https://dtrack.yusufandrika.dev/.well-known/assetlinks.json` | Verifikasi TWA Android |
| `https://dtrack.yusufandrika.dev/manifest.webmanifest`, `/sw.js`, `/icons/*` | PWA |

Logika frontend otomatis (tidak perlu hardcode IP):
- `backend/resources/js/Pages/Driver/Dashboard.jsx:10-23`:
  - `http:` -> `http://hostname:5000` dan `ws://hostname:5000/inference/stream`
  - `https:` -> `https://hostname/ai` dan `wss://hostname/ai/inference/stream`
- File yang sama dipakai di `Admin/FleetShow.jsx:12`, `Admin/DriversShow.jsx:10`.
- Reverb client `backend/resources/js/bootstrap.js:9-18` pakai `VITE_REVERB_HOST`, `VITE_REVERB_PORT`, `VITE_REVERB_SCHEME`.

Contoh Nginx minimal untuk domain ini:
```nginx
server {
  listen 443 ssl;
  server_name dtrack.yusufandrika.dev;

  location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
  }
  location /ai/ {
    proxy_pass http://127.0.0.1:5000/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    client_max_body_size 10M;
  }
  location /app/ {
    proxy_pass http://127.0.0.1:8080/app/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

---

## 3. Tech Stack

Backend:
- PHP 8.2, Laravel 12, Inertia.js v3, React 19, Vite 7, Tailwind v4
- Leaflet + react-leaflet, lucide-react
- Auth: Laravel Sanctum (token Bearer di localStorage)
- Realtime: Laravel Reverb (Pusher-protocol via laravel-echo + pusher-js)
- DB: MySQL 8.0, Cache/Queue: Redis 7 (prod), file/sync (local default)
- Pattern: Controller tipis -> Service -> Repository -> Model

AI Service:
- Python FastAPI, uvicorn `:5000`
- Ultralytics YOLOv8n (`yolov8n.pt` di root), MediaPipe (Face Detection, Face Mesh, Pose), OpenCV
- CORS `allow_origins=["*"]`, expose `X-AI-Result, X-Timestamp, X-Age-Seconds, X-Vehicle-ID`
- Mode default `STREAM_SOURCE=none` = API-only (terima frame via WS/HTTP, tidak buka webcam server)

Mobile native (`mobile/`):
- Kotlin, CameraX, Fused Location, Retrofit2 + OkHttp + Gson, Coroutines, WorkManager, NanoHTTPD
- `namespace com.fleetvisionai`, `minSdk 26`, `targetSdk 34`
- `mobile/app/build.gradle.kts:17-18` default emulator:
  `API_BASE_URL="http://10.0.2.2:8000/api/"`, `INFERENCE_URL="http://10.0.2.2:5000/"`
- Produksi dengan domain: `https://dtrack.yusufandrika.dev/api/` dan `https://dtrack.yusufandrika.dev/ai/`

TWA (`twa/`):
- `packageId com.fleetvisionai.twa`, `startUrl /track`, fallback customtabs
- `twa-manifest.json` placeholder `fleetvision.example.com` WAJIB diganti ke `dtrack.yusufandrika.dev` (host, iconUrl, fullScopeUrl)
- Verifikasi via `GET /.well-known/assetlinks.json` (route Laravel di `backend/routes/web.php:23-46` + `backend/config/twa.php` via `.env` `TWA_PACKAGE`, `TWA_SHA256_1`, `TWA_SHA256_2`)

Infra:
- `docker-compose.yml`: mysql:8.0 (:3306), redis:7 (:6379), ai-service (:5000)
- `docker-compose.override.yml`: hot-reload dev

---

## 4. Struktur Folder

```
dtrack/
├── backend/               # Laravel + Inertia + React
│   ├── app/Enums/         # VehicleStatus, DriverStatus, AlertType, AlertSeverity
│   ├── app/Events/        # LocationUpdated, AlertTriggered, DriverStatusChanged
│   ├── app/Http/Controllers/Api/ # Auth, Vehicle, Driver, Trip, Location, Alert, AI, Dashboard, PublicTracking
│   ├── app/Http/Requests/ # StoreLocationRequest, StoreAIResultRequest
│   ├── app/Http/Resources/# VehicleResource, DriverResource, LocationResource, AlertResource
│   ├── app/Models/        # Vehicle, Driver, Trip, DrivingSession, LocationHistory, DriverStatus, Alert, User
│   ├── app/Repositories/  # BaseRepository + implementasi
│   ├── app/Services/      # AuthService, VehicleService, AIService, LocationService, TripService, AlertService
│   ├── database/migrations/ # ~14 file
│   ├── database/seeders/  # 5 vehicles, 5 drivers
│   ├── resources/js/Pages/# Login, Admin/*, Driver/*, Customer/Track
│   ├── resources/js/Layouts/ # AdminLayout, DriverLayout, GuestLayout
│   ├── resources/js/Components/ # DataTable, StatCard, StatusBadge, FleetMap, MapTiles
│   ├── resources/js/utils/api.js # apiFetch wrapper Bearer + 401 redirect
│   ├── resources/js/bootstrap.js # Echo + Reverb config
│   ├── resources/js/app.jsx # entry Inertia
│   ├── routes/api.php, web.php, channels.php
│   ├── vite.config.js     # host 0.0.0.0:5173
│   └── public/manifest.webmanifest, sw.js, offline.html, icons/*
├── ai-service/
│   ├── app.py             # FastAPI + lifespan + continuous loop
│   ├── config/settings.py # BACKEND_API_URL, STREAM_SOURCE, VEHICLE_ID, dll
│   ├── detectors/         # base, face, seatbelt, fatigue, phone, distraction
│   ├── services/          # detection_service, stream_service, communication_service
│   ├── routes/            # inference_routes, vehicle_routes
│   └── models/            # inference_result, detection
├── mobile/                # APK native Kotlin
│   └── app/src/main/java/com/fleetvisionai/
│       ├── MainActivity, LoginActivity, GpsTrackingService, CameraStreamingService
│       ├── gps/, camera/, api/RetrofitClient, ApiService, models/
├── twa/                   # Bubblewrap wrapper
├── docker-compose.yml
└── yolov8n.pt
```

---

## 5. Environment Variables

Backend `.env` lokal vs produksi `https://dtrack.yusufandrika.dev`:

```env
# LOKAL (HP satu WiFi, ganti 192.168.1.10 dengan IP laptop)
APP_URL=http://192.168.1.10:8000
DB_HOST=127.0.0.1
DB_DATABASE=fleetvision
REVERB_HOST=192.168.1.10
REVERB_PORT=8080
REVERB_SCHEME=http
VITE_REVERB_HOST=192.168.1.10
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
SANCTUM_STATEFUL_DOMAINS=localhost,127.0.0.1,192.168.1.10

# PRODUKSI (dtrack.yusufandrika.dev)
APP_NAME=FleetVisionAI
APP_ENV=production
APP_DEBUG=false
APP_URL=https://dtrack.yusufandrika.dev
DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=fleetvision
DB_USERNAME=fleetvision
DB_PASSWORD=***
BROADCAST_DRIVER=reverb
CACHE_DRIVER=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
REDIS_HOST=redis
REVERB_APP_ID=fleetvision-reverb
REVERB_APP_KEY=fleetvision-key
REVERB_APP_SECRET=***
REVERB_HOST=0.0.0.0
REVERB_PORT=8080
REVERB_SCHEME=https
VITE_REVERB_HOST=dtrack.yusufandrika.dev
VITE_REVERB_PORT=443
VITE_REVERB_SCHEME=https
VITE_AI_SERVICE_URL=https://dtrack.yusufandrika.dev/ai
VITE_AI_SERVICE_WS=wss://dtrack.yusufandrika.dev/ai/inference/stream
VITE_LIVE_POLL_MS=600
VITE_AI_SEND_MS=500
SANCTUM_STATEFUL_DOMAINS=dtrack.yusufandrika.dev
TWA_PACKAGE=com.fleetvisionai.twa
TWA_SHA256_1=***
TWA_SHA256_2=***
FLEETVISION_AI_API_KEY=***
```

AI Service `.env` / env:
```
BACKEND_API_URL=https://dtrack.yusufandrika.dev/api  # lokal: http://host.docker.internal:8000/api atau http://192.168.1.10:8000/api
REDIS_URL=redis://redis:6379/0
STREAM_SOURCE=none
VEHICLE_ID=TRK001
VEHICLE_DB_ID=1
INFERENCE_INTERVAL=0.5
CONFIDENCE_THRESHOLD=0.5
```

Catatan: `VITE_*` di-bake saat `npm run build`. Setiap ganti domain wajib rebuild.

---

## 6. Routes & API

Web (`backend/routes/web.php`):
- `/login`, `/admin`, `/admin/fleet`, `/admin/fleet/{id}`, `/admin/drivers`, `/admin/drivers/{id}`, `/admin/trips`, `/admin/alerts`, `/admin/settings`
- `/driver`, `/driver/trips`, `/driver/alerts`
- `/track` (publik), `/` redirect ke `/track`
- `/.well-known/assetlinks.json`

API (`backend/routes/api.php`), semua response envelope `{success, message, data}`:
- `POST /api/auth/login`, `POST /api/auth/register`
- `GET /api/public/track/{plateNumber}` (publik)
- `POST /api/ai/result` (header `X-API-Key`, dari AI Service)
- Auth Sanctum: `GET /api/auth/me`, `POST /api/auth/logout`, `apiResource vehicles/drivers/trips`, `POST /api/location`, `GET /api/vehicles/{id}/locations`, `GET /api/drivers/{id}/status`, `GET /api/dashboard/stats`, `GET/PATCH /api/alerts*`

Contoh `POST /api/location`:
```json
{"vehicle_id":1,"latitude":-6.2088,"longitude":106.8456,"speed":45,"heading":180,"accuracy":10}
```

Broadcast (`routes/channels.php`):
- `vehicle.{id}`: `LocationUpdated`
- `driver.{id}`: `DriverStatusChanged`
- `alerts`: `AlertTriggered`

---

## 7. Alur Driver (Paling Sering Ditanya)

1. Buka `https://dtrack.yusufandrika.dev/login`, login driver.
2. Frontend simpan `token, role` di `localStorage`, semua fetch via `utils/api.js:6 apiFetch()` otomatis Bearer + redirect `/login` saat 401.
3. Buka `/driver`, klik `Mulai Trip` (`Driver/Dashboard.jsx:266 handleStartTrip`):
   - `navigator.geolocation.getCurrentPosition({enableHighAccuracy:true})`
   - `POST /api/trips {vehicle_id, driver_id, start_latitude, start_longitude}`
   - `PATCH /api/trips/{id} {action:start}`
   - `startGpsTracking()` = `watchPosition` -> `POST /api/location` tiap 5 detik (`Dashboard.jsx:124-136,138-149`)
   - `startCamera()` = `getUserMedia({facingMode:user, 640x480})` -> `WebSocket(AI_SERVICE_WS)` kirim base64 JPEG tiap 500ms (`Dashboard.jsx:156-169,181-224,236-264`)
4. `Selesaikan Trip` (`Dashboard.jsx:304`): `PATCH /api/trips/{id} {action:end, end_latitude, end_longitude, total_distance_km}`.

Error terkenal:
- `Only secure origins are allowed` = buka via `http://IP` bukan HTTPS. Solusi: pakai `https://dtrack.yusufandrika.dev` (otomatis aman), atau flag `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, atau `adb reverse` agar HP buka `http://localhost:8000`.
- GPS/kamera wajib izin browser + HTTPS + `enableHighAccuracy`.

---

## 8. AI Service Detail

Detectors (`ai-service/detectors/`, semua `detect(frame)->JSON`):
| Detector | Teknologi | Output |
|----------|-----------|--------|
| FaceDetector | MediaPipe Face Detection | `face_detected, face_bbox` |
| SeatbeltDetector | MediaPipe Pose | `seatbelt bool` |
| FatigueDetector | MediaPipe Face Mesh (EAR, MAR, PERCLOS) | `fatigue, eye_closed, yawning, ear, mar, perclos` |
| PhoneDetector | YOLOv8n COCO class 67 | `phone bool, confidence` |
| DistractionDetector | solvePnP head pose | `looking_away, yaw, pitch, roll` |

Pipeline `services/detection_service.py`: face gate -> fatigue -> distraction -> seatbelt -> phone -> smoothing eye_closed (rata-rata 5 frame) -> `InferenceResult`.

`models/inference_result.py`:
```json
{"vehicle_id":"TRK001","seatbelt":true,"fatigue":false,"phone":false,"eye_closed":0.18,"yawning":false,"looking_away":false,"face_detected":true,"timestamp":"2026-07-04T10:00:00"}
```

Endpoint AI (`routes/inference_routes.py`):
- `POST /inference?vehicle_id=TRK001` (multipart image) -> JSON hasil, simpan frame
- `WS /inference/stream` in `{frame:base64, vehicle_id}` out `{result:{...}}`
- `GET /inference/frame/{vehicle_id}` -> JPEG terbaru (404 jika >30 detik basi), header `X-AI-Result`
- `GET /inference/frames` -> list kendaraan aktif
- `GET /inference/health`, `/inference/status`, `GET /`

Backend `AIService::processAIResult()`:
- simpan `DriverStatus`, broadcast `DriverStatusChanged`
- buat Alert: `seatbelt=false HIGH`, `fatigue=true CRITICAL`, `phone=true MEDIUM`, `eye_closed>0.7 HIGH`
- `AlertType: FATIGUE, SEATBELT, DISTRACTION, SPEEDING, DRIVING_TIME, PHONE_USAGE`

---

## 9. Akun Seed & Quick Start

Akun (`php artisan migrate --seed`):
- Admin: `admin@fleetvision.ai / password`
- Driver: `john.smith@example.com`, `maria.garcia@example.com`, `ahmed.hassan@example.com`, `sarah.johnson@example.com`, `carlos.mendez@example.com` / `password`

Lokal (dari README):
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
npm install
npm run build
php artisan serve --host=0.0.0.0 --port=8000
php artisan reverb:start --host=0.0.0.0 --port=8080
# ai-service:
python run.py
```

Satu WiFi dengan HP: ganti `APP_URL` dan `VITE_REVERB_HOST` ke IP laptop, rebuild, buka `http://192.168.x.x:8000/login` di HP.

Produksi `dtrack.yusufandrika.dev`: set `.env` produksi di atas, `npm run build`, `php artisan migrate --force`, jalankan `php-fpm/serve + reverb + ai-service` di balik Nginx HTTPS, pastikan `/ai/` proxy ke `:5000`.

---

## 10. Mobile Native vs TWA (Jangan Tertukar)

- `mobile/` = APK native `com.fleetvisionai` (GPS foreground service + CameraX). Untuk produksi ubah `API_BASE_URL=https://dtrack.yusufandrika.dev/api/` dan `INFERENCE_URL=https://dtrack.yusufandrika.dev/ai/`. Interface di `api/ApiService.kt:14-45`.
- `twa/` = wrapper PWA `com.fleetvisionai.twa` untuk Play Store, isi `https://dtrack.yusufandrika.dev/track`. Wajib HTTPS + `assetlinks.json` valid agar tidak ada URL bar. Web tidak perlu rebuild APK saat update Laravel.

---

## 11. Troubleshooting untuk GPT

- Secure origins: selalu arahkan ke `https://dtrack.yusufandrika.dev`, jangan `http://IP`.
- Mixed content: di HTTPS jangan panggil `http://` atau `ws://`, pakai `https://` dan `wss://`. Kode sudah handle otomatis.
- Reverb tidak connect: cek `VITE_REVERB_*` + rebuild + Nginx proxy WebSocket (`Upgrade` header).
- AI No Data di admin: cek `allow_origins`, `expose_headers X-AI-Result`, frame >30s dianggap basi, `STREAM_SOURCE=none` berarti harus ada driver yang streaming.
- Vite HMR rusak via IP: pakai `npm run build` untuk demo HP, bukan `npm run dev`.
- Firewall Windows/VPS: buka 80,443,8080,5000 (atau tutup 5000/8080 jika sudah via `/ai/` dan `/app/` proxy).
- TWA URL bar masih muncul: salah `SHA256`, salah host (harus `dtrack.yusufandrika.dev` bukan `fleetvision.example.com`), belum HTTPS, atau cache assetlinks.

---

## 12. File Kunci

- `backend/routes/web.php`, `api.php`, `channels.php`
- `backend/resources/js/Pages/Driver/Dashboard.jsx` (GPS + kamera + WS AI)
- `backend/resources/js/Pages/Admin/Fleet.jsx`, `FleetShow.jsx`, `DriversShow.jsx`
- `backend/resources/js/bootstrap.js`, `utils/api.js`, `vite.config.js`
- `backend/.env.example`, `backend/config/twa.php`
- `ai-service/app.py`, `config/settings.py`, `routes/inference_routes.py`, `services/detection_service.py`
- `mobile/app/build.gradle.kts`, `api/RetrofitClient.kt`, `api/ApiService.kt`
- `twa/twa-manifest.json`, `twa/README.md`
- `docker-compose.yml`, `README.md`, `agent.md`
