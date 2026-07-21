# FleetVision AI 🚛

**Real-Time Fleet Tracking & Driver Monitoring System**

Platform fleet management berbasis AI untuk monitoring kendaraan logistik secara real-time.

---

## Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| **Live GPS Tracking** | Pantau posisi kendaraan real-time (update setiap 5 detik) |
| **Driver Dashboard** | Start/End Trip, GPS tracking, live speed & distance dari browser |
| **Role-Based Access** | Admin (full dashboard) vs Driver (data sendiri) |
| **Fleet Dashboard** | Map semua kendaraan, statistik, daftar driver & trips |
| **AI Monitoring** | Deteksi seatbelt, fatigue, phone usage, distraction |
| **Alert System** | Notifikasi real-time untuk admin |

---

## Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser / Android                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  GPS (Web)  │  │   Dashboard  │  │      Login        │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘   │
└─────────┼─────────────────┼───────────────────┼──────────────┘
          │                 │                   │
          ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  AI Detection Service (Python)               │
│  Seatbelt · Fatigue · Phone · Distraction · Face Detection  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Laravel + Inertia + React                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Inertia Pages (React)                              │   │
│  │  Login · Admin Dashboard · Driver Dashboard         │   │
│  │  Fleet Map · Drivers · Trips · Alerts · Settings    │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Laravel API + Sanctum                              │   │
│  │  Auth · Vehicles · Drivers · Trips · Location · AI  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prasyarat

- PHP 8.2+
- Composer 2
- Node.js 20+
- MySQL 8.0

### Setup

```bash
# Clone
cd dtrack

# Backend
cd backend
composer install
cp .env.example .env   # edit DB_HOST=127.0.0.1, DB_DATABASE=fleetvision
php artisan key:generate
php artisan migrate --seed

# Frontend dependencies
npm install
npm run build

# Jalankan (2 terminal)
# Terminal 1:
php artisan serve --host=0.0.0.0 --port=8000

# Terminal 2:
npm run dev

#laravel reverb
cd d:\Code\dtrack\backend
php artisan reverb:start --host=0.0.0.0 --port=8080

#pastiin untuk login as a driver harus melalui website {baseurl}/login
```

Buka `http://localhost:8000`

### Akun

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@fleetvision.ai | password |
| Driver | john.smith@example.com | password |
| Driver | maria.garcia@example.com | password |
| Driver | ahmed.hassan@example.com | password |
| Driver | sarah.johnson@example.com | password |
| Driver | carlos.mendez@example.com | password |

---

## Struktur Project

```
dtrack/
├── backend/                  # Laravel + Inertia + React
│   ├── app/
│   │   ├── Enums/            # VehicleStatus, DriverStatus, AlertType, AlertSeverity
│   │   ├── Events/           # LocationUpdated, AlertTriggered, DriverStatusChanged
│   │   ├── Http/
│   │   │   ├── Controllers/Api/  # Auth, Vehicle, Driver, Trip, Location, Alert, AI, Dashboard
│   │   │   ├── Requests/         # StoreLocationRequest, StoreAIResultRequest
│   │   │   └── Resources/        # VehicleResource, DriverResource, LocationResource, AlertResource
│   │   ├── Middleware/       # HandleInertiaRequests
│   │   ├── Models/           # Vehicle, Driver, Trip, DrivingSession, LocationHistory, DriverStatus, Alert, User
│   │   ├── Repositories/     # BaseRepository + repository implementations
│   │   └── Services/         # AuthService, VehicleService, ..., AIService, LocationService
│   ├── database/
│   │   ├── migrations/       # 12 migration files
│   │   └── seeders/          # 5 vehicles, 5 drivers, sample data
│   ├── resources/
│   │   ├── js/
│   │   │   ├── Pages/        # Login, Admin/*, Driver/*
│   │   │   ├── Layouts/      # AdminLayout, DriverLayout, GuestLayout
│   │   │   ├── Components/   # DataTable, StatCard, StatusBadge, FleetMap, etc
│   │   │   └── app.jsx       # Inertia entry point
│   │   ├── css/app.css       # Tailwind + Leaflet styles
│   │   └── views/app.blade.php  # Inertia root template
│   ├── routes/
│   │   ├── api.php           # REST API routes
│   │   └── web.php           # Inertia page routes
│   └── vite.config.js        # Vite + React + Tailwind
│
├── ai-service/               # Python AI Service (FastAPI)
│   ├── detectors/            # Face, Seatbelt, Fatigue, Phone, Distraction
│   ├── services/             # Detection, Stream, Communication
│   ├── routes/               # Inference & Vehicle routes
│   ├── models/               # InferenceResult, Detection models
│   └── app.py                # FastAPI app
│
├── mobile/                   # Android App (Kotlin)
│   └── app/src/main/java/com/fleetvisionai/
│       ├── gps/              # GpsTracker, GpsRepository
│       ├── camera/           # CameraStreamer, CameraPreview
│       ├── api/              # ApiService (Retrofit), RetrofitClient
│       └── models/           # GpsData, ApiResponse, VehicleInfo
│
├── docker-compose.yml        # mysql, redis, ai-service
└── README.md
```

---

## API Documentation

### Authentication

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/auth/login` | — | Login (return token) |
| POST | `/api/auth/register` | — | Register |
| GET | `/api/auth/me` | Sanctum | Current user |
| POST | `/api/auth/logout` | Sanctum | Revoke token |

### Fleet Management

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| GET | `/api/vehicles` | Sanctum | List all vehicles |
| POST | `/api/vehicles` | Sanctum | Create vehicle |
| GET | `/api/vehicles/{id}` | Sanctum | Vehicle detail |
| GET | `/api/vehicles/{id}/locations` | Sanctum | Vehicle location history |

### GPS Tracking

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/location` | Sanctum | Kirim GPS data |

**Request:**
```json
{
    "vehicle_id": 1,
    "latitude": -6.2088,
    "longitude": 106.8456,
    "speed": 45.5,
    "heading": 180.0,
    "accuracy": 10.0
}
```

### Trips

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| GET | `/api/trips` | Sanctum | List all trips |
| POST | `/api/trips` | Sanctum | Create trip |
| PATCH | `/api/trips/{id}` | Sanctum | Start/end trip |

### Alerts

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| GET | `/api/alerts` | Sanctum | List all alerts |
| PATCH | `/api/alerts/{id}/read` | Sanctum | Mark as read |

### Dashboard

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| GET | `/api/dashboard/stats` | Sanctum | Dashboard statistics |

---

## Dashboard Pages

### Admin (`/admin/*`)

| Route | Halaman |
|-------|---------|
| `/login` | Login |
| `/admin` | Dashboard — stats overview |
| `/admin/fleet` | Fleet — map semua kendaraan + daftar |
| `/admin/fleet/{id}` | Detail kendaraan |
| `/admin/drivers` | Daftar driver |
| `/admin/drivers/{id}` | Detail driver |
| `/admin/trips` | Riwayat trip |
| `/admin/alerts` | Alert history |
| `/admin/settings` | Pengaturan |

### Driver (`/driver/*`)

| Route | Halaman |
|-------|---------|
| `/driver` | Dashboard — Start/End Trip, GPS live tracking, speed, distance |
| `/driver/trips` | Riwayat trip pribadi |
| `/driver/alerts` | Alert pribadi |

---

## Environment Variables

### Backend (.env)

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `DB_HOST` | `127.0.0.1` | Database host |
| `DB_DATABASE` | `fleetvision` | Database name |
| `DB_USERNAME` | `root` | Database user |
| `DB_PASSWORD` | — | Database password |

---

## AI Detectors

| Detector | Technology | Output |
|----------|-----------|--------|
| **FaceDetector** | MediaPipe Face Detection | `face_detected`, `face_bbox` |
| **SeatbeltDetector** | MediaPipe Pose | `seatbelt` (bool) |
| **FatigueDetector** | MediaPipe Face Mesh | `fatigue`, `eye_closed`, `yawning`, `ear`, `mar`, `perclos` |
| **PhoneDetector** | YOLOv8n | `phone` (bool), `confidence` |
| **DistractionDetector** | Head Pose (solvePnP) | `looking_away`, `yaw`, `pitch`, `roll` |

---

## License

MIT
