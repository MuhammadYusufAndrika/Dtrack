I'll conduct a thorough exploration of this codebase. Let me start with multiple parallel searches to understand the project structure and technology stack.
→Read . 
✱Glob "**/*.json" in . (4 matches)
✱Glob "**/*.md" in . (2 matches)
✱Glob "**/*.{js,ts,jsx,tsx}" in . (25 matches)
✱Glob "**/*.{py,rb,go,java}" in . (24 matches)
+ Thought: 815ms
Excellent! This is a multi-service project. Let me now read the key configuration and documentation files.
→Read README.md 
→Read docker-compose.yml 
→Read backend\package.json 
→Read backend\composer.json 
→Read ai-service\app.py 
→Read mobile 
+ Thought: 418ms
Now let me dive deeper into the backend structure, AI service, and mobile app.
→Read backend 
→Read backend\app 
→Read ai-service\detectors 
→Read ai-service\config\settings.py 
✱Glob "**/*.kt" in mobile (17 matches)
✱Glob "*.php" in backend\routes (4 matches)
+ Thought: 515ms
Let me now read the routes, backend models, services, and admin pages.
→Read backend\routes\web.php 
→Read backend\routes\api.php 
→Read backend\routes\channels.php 
→Read backend\app\Models 
→Read backend\app\Services 
→Read backend\app\Events 
→Read backend\app\Http 
+ Thought: 201ms
Let me now read the key backend services, models, and admin pages.
→Read backend\app\Services\AIService.php 
→Read backend\app\Services\LocationService.php 
→Read backend\app\Enums 
→Read backend\app\Events\AlertTriggered.php 
→Read backend\app\Events\LocationUpdated.php 
→Read backend\app\Events\DriverStatusChanged.php 
→Read backend\resources\js\Pages\Admin\Dashboard.jsx 
+ Thought: 48ms
Let me now read the remaining admin pages, AI service detectors, and key mobile app files.
→Read backend\resources\js\Pages\Admin\Fleet.jsx 
→Read backend\resources\js\Pages\Admin\Drivers.jsx 
→Read backend\resources\js\Pages\Admin\Alerts.jsx 
→Read backend\resources\js\Pages\Admin\Trips.jsx 
→Read backend\resources\js\Pages\Driver\Dashboard.jsx 
→Read backend\resources\js\Pages\Customer\Track.jsx 
→Read backend\resources\js\utils\api.js 
+ Thought: 241ms
Let me read the AI detectors, backend controllers, and models to complete the picture.
→Read ai-service\detectors\base_detector.py 
→Read ai-service\detectors\seatbelt_detector.py 
→Read ai-service\detectors\phone_detector.py 
→Read ai-service\detectors\fatigue_detector.py 
→Read ai-service\services\detection_service.py 
→Read ai-service\services\stream_service.py 
→Read ai-service\services\communication_service.py 
→Read ai-service\routes\inference_routes.py 
+ Thought: 29ms
Let me now read the backend controllers, models, and mobile app key files to complete the picture.
→Read backend\app\Http\Controllers 
→Read backend\app\Models\Vehicle.php 
→Read backend\app\Models\Driver.php 
→Read backend\app\Models\Trip.php 
→Read mobile\app\src\main\java\com\fleetvisionai\MainActivity.kt 
→Read mobile\app\src\main\java\com\fleetvisionai\camera\CameraStreamer.kt 
→Read mobile\app\src\main\java\com\fleetvisionai\api\ApiService.kt 
+ Thought: 252ms
Let me read the backend API controllers and the admin layout to complete the picture.
→Read backend\app\Http\Controllers\Api 
→Read backend\app\Enums\AlertType.php 
→Read backend\app\Enums\AlertSeverity.php 
→Read backend\resources\js\Layouts\AdminLayout.jsx 
→Read backend\resources\js\Layouts\DriverLayout.jsx 
→Read backend\resources\js\app.jsx 
+ Thought: 89ms
Let me read the bootstrap.js (for WebSocket/Echo config) and a few more backend files.
→Read backend\resources\js\bootstrap.js 
→Read backend\app\Http\Controllers\Api\AIController.php 
→Read backend\app\Http\Controllers\Api\LocationController.php 
→Read backend\app\Services\AlertService.php 
→Read ai-service\models\inference_result.py 
→Read ai-service\detectors\distraction_detector.py 
→Read ai-service\detectors\face_detector.py 
+ Thought: 477ms
Let me check the database migrations to complete the data model understanding.
✱Glob "**/*.php" in backend\database (14 matches)
→Read backend\app\Http\Controllers\Api\DashboardController.php 
+ Thought: 311ms
Now I have a comprehensive understanding of the entire codebase. Here is my detailed summary:
FleetVision AI -- Codebase Analysis
1. What Is This Project?
FleetVision AI is a multi-platform fleet management and driver monitoring system with real-time GPS tracking and AI-powered driver behavior detection. It consists of three major components:
- Web Dashboard (Admin + Driver + Public Tracking) -- browser-based
- Android Mobile App (Kotlin) -- for drivers in the field
- AI Detection Microservice (Python FastAPI) -- processes camera feeds for driver safety
2. Technology Stack
Backend (Web API + Frontend)
Layer	Technology
Language	PHP 8.2
Framework	Laravel 12
Frontend	React 19 via Inertia.js v3
CSS	Tailwind CSS v4
Build Tool	Vite 7
Maps	Leaflet + react-leaflet
Icons	lucide-react
Auth	Laravel Sanctum (token-based)
Real-time	Laravel Reverb (WebSocket) via Pusher JS + Laravel Echo
Database	MySQL 8.0
Cache/Queue	Redis 7
Package Manager	Composer (PHP), npm (JS)
Key file: D:\Code\dtrack\backend\composer.json, D:\Code\dtrack\backend\package.json
AI Microservice
Layer	Technology
Language	Python
Framework	FastAPI
AI/ML	YOLOv8n (Ultralytics), MediaPipe (Face Mesh, Pose, Face Detection), OpenCV
HTTP Client	httpx (async)
Config	Pydantic Settings
Communication	HTTP POST to Laravel API, WebSocket for real-time inference
Key file: D:\Code\dtrack\ai-service\app.py, D:\Code\dtrack\ai-service\config\settings.py
Mobile App
Layer	Technology
Language	Kotlin
Platform	Android
Camera	CameraX (ImageAnalysis)
Location	Google Fused Location Provider
Networking	Retrofit 2 + OkHttp
Async	Kotlin Coroutines
Key files: D:\Code\dtrack\mobile\app\src\main\java\com\fleetvisionai\MainActivity.kt
Infrastructure
Component	Technology
Containerization	Docker Compose
Services	MySQL 8.0, Redis 7, AI Service (FastAPI)
Key file: D:\Code\dtrack\docker-compose.yml
3. Directory Structure
D:\Code\dtrack\
├── backend/                          # Laravel + Inertia + React
│   ├── app/
│   │   ├── Enums/                    # AlertType, AlertSeverity, DriverStatus, VehicleStatus
│   │   ├── Events/                   # AlertTriggered, LocationUpdated, DriverStatusChanged (broadcast)
│   │   ├── Http/
│   │   │   ├── Controllers/Api/      # AI, Alert, Auth, Dashboard, Driver, Location, PublicTracking, Trip, Vehicle
│   │   │   ├── Requests/             # StoreLocationRequest, StoreAIResultRequest
│   │   │   └── Resources/            # VehicleResource, DriverResource, LocationResource, AlertResource
│   │   ├── Models/                   # Vehicle, Driver, Trip, DrivingSession, LocationHistory, DriverStatus, Alert, User
│   │   ├── Repositories/             # Base + specific repository implementations
│   │   └── Services/                 # AIService, AlertService, AuthService, LocationService, TripService, etc.
│   ├── database/
│   │   ├── migrations/               # 14 migration files
│   │   └── seeders/                  # Sample data (5 vehicles, 5 drivers)
│   ├── resources/js/
│   │   ├── Pages/
│   │   │   ├── Admin/                # Dashboard, Fleet, FleetShow, Drivers, DriversShow, Trips, Alerts, Settings
│   │   │   ├── Driver/               # Dashboard, Trips, Alerts
│   │   │   ├── Customer/             # Track (public vehicle tracking)
│   │   │   └── Login.jsx
│   │   ├── Layouts/                  # AdminLayout, DriverLayout, GuestLayout
│   │   ├── Components/               # DataTable, StatCard, StatusBadge, LoadingSpinner
│   │   ├── utils/api.js              # Authenticated fetch wrapper
│   │   ├── bootstrap.js              # Laravel Echo + Reverb WebSocket config
│   │   └── app.jsx                   # Inertia entry point
│   ├── routes/
│   │   ├── api.php                   # REST API routes (Sanctum auth)
│   │   ├── web.php                   # Inertia page routes
│   │   └── channels.php              # Broadcast channels: vehicle.{id}, driver.{id}, alerts
│   └── vite.config.js
│
├── ai-service/                       # Python FastAPI AI microservice
│   ├── app.py                        # FastAPI app with lifespan, continuous inference loop
│   ├── config/settings.py            # Pydantic config (BACKEND_API_URL, STREAM_SOURCE, etc.)
│   ├── detectors/                    # BaseDetector + 5 concrete detectors
│   │   ├── face_detector.py          # MediaPipe Face Detection / OpenCV DNN
│   │   ├── seatbelt_detector.py      # MediaPipe Pose / OpenCV edge analysis
│   │   ├── fatigue_detector.py       # MediaPipe Face Mesh (EAR, MAR, PERCLOS)
│   │   ├── phone_detector.py         # YOLOv8n (COCO class 67)
│   │   └── distraction_detector.py   # Head pose estimation (solvePnP)
│   ├── services/
│   │   ├── detection_service.py      # Orchestrates all detectors, aggregates results
│   │   ├── stream_service.py         # Video source abstraction (webcam/RTSP/API)
│   │   └── communication_service.py  # HTTP POST to Laravel backend with retry
│   ├── routes/
│   │   ├── inference_routes.py       # POST /inference, WS /inference/stream, GET /inference/frame/{id}
│   │   └── vehicle_routes.py         # Vehicle-related routes
│   └── models/
│       ├── inference_result.py       # Pydantic model: seatbelt, fatigue, phone, eye_closed, etc.
│       └── detection.py
│
├── mobile/                           # Android Kotlin app
│   └── app/src/main/java/com/fleetvisionai/
│       ├── MainActivity.kt           # Main screen: trip management, GPS, camera, AI
│       ├── LoginActivity.kt          # Auth screen
│       ├── FleetVisionApp.kt         # Application class (session persistence)
│       ├── GpsTrackingService.kt     # Foreground service for GPS
│       ├── CameraStreamingService.kt # Foreground service for camera
│       ├── NotificationHelper.kt
│       ├── gps/                      # GpsTracker, GpsRepository
│       ├── camera/                   # CameraStreamer, CameraPreview
│       ├── api/                      # ApiService (Retrofit), RetrofitClient
│       └── models/                   # GpsData, ApiResponse, VehicleInfo, TripInfo, DriverInfo
│
├── docker-compose.yml                # MySQL, Redis, AI Service
└── README.md
4. Admin View -- YES, Fully Implemented
The Admin View is completely implemented across multiple files:
Routes (D:\Code\dtrack\backend\routes\web.php)
Route	Page
/admin	Dashboard with stats overview
/admin/fleet	Fleet live map (all vehicles)
/admin/fleet/{id}	Individual vehicle detail
/admin/drivers	Driver list
/admin/drivers/{id}	Individual driver detail
/admin/trips	Trip history with filters
/admin/alerts	Alert history
/admin/settings	Settings page
Admin Pages
File	Purpose
D:\Code\dtrack\backend\resources\js\Pages\Admin\Dashboard.jsx	Stats cards (vehicles, drivers, alerts, trips) via /api/dashboard/stats
D:\Code\dtrack\backend\resources\js\Pages\Admin\Fleet.jsx	Live map with Leaflet, WebSocket-based real-time vehicle positions, vehicle sidebar
D:\Code\dtrack\backend\resources\js\Pages\Admin\FleetShow.jsx	Individual vehicle detail view
D:\Code\dtrack\backend\resources\js\Pages\Admin\Drivers.jsx	Data table of all drivers with search
D:\Code\dtrack\backend\resources\js\Pages\Admin\DriversShow.jsx	Individual driver detail view
D:\Code\dtrack\backend\resources\js\Pages\Admin\Trips.jsx	Trip history with status filters (All/Active/Completed/Cancelled)
D:\Code\dtrack\backend\resources\js\Pages\Admin\Alerts.jsx	Alert list with severity, mark-as-read
D:\Code\dtrack\backend\resources\js\Pages\Admin\Settings.jsx	Settings page
Admin Layout
D:\Code\dtrack\backend\resources\js\Layouts\AdminLayout.jsx -- Collapsible sidebar with navigation: Dashboard, Fleet, Drivers, Trips, Alerts, Settings. Includes logout functionality.
5. AI Behavior Detection -- YES, Extensively Implemented
AI behavior detection is a core feature with a full Python microservice and frontend integration.
AI Service (Python FastAPI) -- D:\Code\dtrack\ai-service\
5 Detection Modules (all inheriting from BaseDetector):
Detector	File	Technology	What It Detects
FaceDetector	D:\Code\dtrack\ai-service\detectors\face_detector.py	MediaPipe Face Detection / OpenCV DNN	Face presence, bounding box
SeatbeltDetector	D:\Code\dtrack\ai-service\detectors\seatbelt_detector.py	MediaPipe Pose / OpenCV edge analysis	Seatbelt fastened (shoulder-to-hip diagonal line detection)
FatigueDetector	D:\Code\dtrack\ai-service\detectors\fatigue_detector.py	MediaPipe Face Mesh	Drowsiness via EAR (Eye Aspect Ratio), MAR (Mouth Aspect Ratio), PERCLOS
PhoneDetector	D:\Code\dtrack\ai-service\detectors\phone_detector.py	YOLOv8n (COCO class 67)	Cell phone usage
DistractionDetector	D:\Code\dtrack\ai-service\detectors\distraction_detector.py	Head Pose Estimation (solvePnP)	Looking away (yaw > 30 or pitch > 20 degrees)
Detection Pipeline (D:\Code\dtrack\ai-service\services\detection_service.py):
1. Face detection (fast gate)
2. Fatigue detection (face mesh)
3. Distraction detection (head pose)
4. Seatbelt detection (pose)
5. Phone detection (YOLO)
6. Eye closure smoothing (running average over 5 frames)
7. Aggregated InferenceResult returned
InferenceResult Model (D:\Code\dtrack\ai-service\models\inference_result.py):
class InferenceResult(BaseModel):
    vehicle_id: str
    seatbelt: bool
    fatigue: bool
    phone: bool
    eye_closed: float
    yawning: bool
    looking_away: bool
    face_detected: bool
    timestamp: datetime
Backend AI Processing -- D:\Code\dtrack\backend\app\Services\AIService.php
The AIService::processAIResult() method:
- Creates a DriverStatus record with detection flags
- Broadcasts DriverStatusChanged event via WebSocket
- Generates alerts based on detection results:
- seatbelt === false -> HIGH severity alert
- fatigue === true -> CRITICAL severity alert
- phone_usage === true -> MEDIUM severity alert
- eye_closed > 0.7 -> HIGH severity alert
Alert Types (D:\Code\dtrack\backend\app\Enums\AlertType.php):
FATIGUE, SEATBELT, DISTRACTION, SPEEDING, DRIVING_TIME, PHONE_USAGE
Frontend AI Integration (Driver Dashboard)
D:\Code\dtrack\backend\resources\js\Pages\Driver\Dashboard.jsx (lines 129-221, 398-453):
- Camera captures frames via getUserMedia (facingMode: 'user')
- Frames sent as base64 JPEG over WebSocket to ws://{host}:5000/inference/stream
- AI results displayed in real-time with color-coded indicators:
- Face Detected, Seatbelt On, Eyes Open, No Fatigue, No Phone, Looking Ahead
- Eye Closure %, Yaw/Pitch angles
6. Camera/Image-Related Features -- YES, Multiple Implementations
Web Browser Camera (Driver Dashboard)
File: D:\Code\dtrack\backend\resources\js\Pages\Driver\Dashboard.jsx
- Uses navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } })
- Captures frames to canvas, converts to base64 JPEG
- Sends frames via WebSocket to AI service every 1 second
- Displays live video feed with mirrored view (scaleX(-1))
Android Camera
Files:
- D:\Code\dtrack\mobile\app\src\main\java\com\fleetvisionai\camera\CameraStreamer.kt -- CameraX ImageAnalysis, converts frames to JPEG, sends to AI service via multipart HTTP POST every 2 seconds
- D:\Code\dtrack\mobile\app\src\main\java\com\fleetvisionai\camera\CameraPreview.kt -- CameraX Preview display
- D:\Code\dtrack\mobile\app\src\main\java\com\fleetvisionai\CameraStreamingService.kt -- Foreground service for background camera streaming
AI Service Frame Handling
File: D:\Code\dtrack\ai-service\routes\inference_routes.py
- POST /inference -- Accepts image upload, runs detection, stores frame
- WS /inference/stream -- WebSocket for real-time frame processing
- GET /inference/frame/{vehicle_id} -- Returns latest JPEG frame for a vehicle (for admin live view)
- GET /inference/frames -- Lists all active vehicles with available frames
- Frame storage: In-memory _frame_store dict, frames expire after 30 seconds
Stream Service
File: D:\Code\dtrack\ai-service\services\stream_service.py
- Supports multiple video sources: webcam (integer ID), RTSP/HTTP URL, video file, image file, or API-only mode
- Default: STREAM_SOURCE=none (API-only mode, accepts frames via WebSocket)
7. Real-Time Functionality -- YES, Multiple Mechanisms
WebSocket (Laravel Reverb)
Configuration (D:\Code\dtrack\backend\resources\js\bootstrap.js):
window.Echo = new Echo({
    broadcaster: 'reverb',
    wsHost: import.meta.env.VITE_REVERB_HOST ?? 'localhost',
    wsPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
});
Broadcast Channels (D:\Code\dtrack\backend\routes\channels.php):
Channel	Purpose
vehicle.{id}	Real-time location updates per vehicle
driver.{id}	Real-time driver status changes (AI results)
alerts	Global alert notifications
Broadcast Events:
Event	File	Channel
LocationUpdated	D:\Code\dtrack\backend\app\Events\LocationUpdated.php	vehicle.{id}
DriverStatusChanged	D:\Code\dtrack\backend\app\Events\DriverStatusChanged.php	driver.{id}
AlertTriggered	D:\Code\dtrack\backend\app\Events\AlertTriggered.php	alerts
AI Service WebSocket
File: D:\Code\dtrack\ai-service\routes\inference_routes.py (line 109)
- Endpoint: ws://{ai-service}:5000/inference/stream
- Client sends base64-encoded JPEG frames
- Server returns JSON inference results
- Used by both web browser (Driver Dashboard) and potentially mobile
HTTP Polling (Fallback)
- Fleet page (Admin/Fleet.jsx): Polls /api/vehicles every 10 seconds as fallback
- Customer Track page (Customer/Track.jsx): Polls /api/public/track/{plate} every 10 seconds
- Driver pages: Polls various endpoints every 10 seconds
- Fleet page shows "Live" vs "Polling" indicator based on WebSocket connection status
Continuous Inference Loop
File: D:\Code\dtrack\ai-service\app.py (line 137)
- Background asyncio task reads frames from stream source
- Runs detection pipeline
- Sends results to Laravel backend via HTTP POST
- Configurable interval (INFERENCE_INTERVAL=0.5s)
8. Data Flow Architecture
Overall Architecture
Mobile App / Browser
        |
        | HTTP REST API (Sanctum auth)
        v
Laravel Backend (PHP)
   |-- Models: Vehicle, Driver, Trip, DrivingSession, LocationHistory, DriverStatus, Alert, User
   |-- Services: AIService, LocationService, TripService, AlertService, etc.
   |-- Repositories: Data access layer
   |-- Events: Broadcast via Laravel Reverb (WebSocket)
   |
   | HTTP POST /api/ai/result
   v
AI Service (Python FastAPI)
   |-- Detectors: Face, Seatbelt, Fatigue, Phone, Distraction
   |-- DetectionService: Orchestrates all detectors
   |-- StreamService: Video source management
   |-- CommunicationService: Sends results back to Laravel
State Management (Frontend)
- No global state library (no Redux, Zustand, etc.)
- Each page manages its own state via useState / useEffect
- Authentication state: localStorage (token, role)
- API calls: Custom apiFetch() wrapper in D:\Code\dtrack\backend\resources\js\utils\api.js that auto-attaches Bearer token and handles 401 redirects
- Real-time state: Laravel Echo subscriptions update React state directly via setLiveLocations(), setAiResults(), etc.
API Architecture
- Pattern: RESTful JSON API with resource-based endpoints
- Auth: Laravel Sanctum (token-based, stored in localStorage)
- Request Validation: Dedicated Form Request classes (StoreLocationRequest, StoreAIResultRequest)
- Response Format: Consistent { success: bool, message: string, data: any } envelope
- Repository Pattern: All database access goes through Repository classes (BaseRepository + specific repos)
- Service Layer: Business logic in Service classes, controllers are thin
Key Data Flow: GPS Tracking
1. Driver starts trip (mobile/browser) -> POST /api/trips + PATCH /api/trips/{id} (action: start)
2. GPS position captured (watchPosition) -> POST /api/location every 5 seconds
3. LocationService stores in location_histories, updates driving_sessions
4. LocationUpdated event broadcast via WebSocket to vehicle.{id} channel
5. Admin Fleet page receives update, moves marker on map in real-time
Key Data Flow: AI Monitoring
1. Trip starts -> Camera activates (browser getUserMedia or mobile CameraX)
2. Frames captured every 1-2 seconds
3. Web: Frames sent via WebSocket to AI service at ws://{host}:5000/inference/stream
4. Mobile: Frames sent via HTTP POST to POST /api/inference
5. AI service runs all 5 detectors, returns InferenceResult
6. Continuous loop mode: AI service also sends results to POST /api/ai/result on the Laravel backend
7. AIService::processAIResult() stores DriverStatus, creates alerts, broadcasts DriverStatusChanged
8. Admin receives real-time driver status updates via WebSocket