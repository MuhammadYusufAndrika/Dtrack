package com.fleetvisionai

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.fleetvisionai.api.RetrofitClient
import com.fleetvisionai.camera.CameraPreview
import com.fleetvisionai.camera.CameraStreamer
import com.fleetvisionai.gps.GpsRepository
import com.fleetvisionai.gps.GpsTracker
import com.fleetvisionai.models.DriverInfo
import com.fleetvisionai.models.TripCreateBody
import com.fleetvisionai.models.TripInfo
import com.fleetvisionai.models.TripUpdateBody
import com.fleetvisionai.models.VehicleInfo
import com.fleetvisionai.utils.RouteHelper
import com.google.android.gms.location.LocationServices
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.textview.MaterialTextView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline
import java.time.Instant

/**
 * Dashboard sopir — setara web /driver:
 * sapaan, tugas rute admin, statistik trip, peta live + rute,
 * kamera + 6 indikator AI, GPS, kendaraan, koneksi.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var gpsTracker: GpsTracker
    private lateinit var gpsRepository: GpsRepository
    private lateinit var cameraStreamer: CameraStreamer
    private lateinit var cameraPreview: CameraPreview

    private lateinit var tvGreeting: MaterialTextView
    private lateinit var btnLogout: MaterialButton
    private lateinit var btnStartTrip: MaterialButton
    private lateinit var tvTripStatus: MaterialTextView
    private lateinit var tvTripInfo: MaterialTextView
    private lateinit var tvGpsStatus: MaterialTextView
    private lateinit var tvLatitude: MaterialTextView
    private lateinit var tvLongitude: MaterialTextView
    private lateinit var tvSpeed: MaterialTextView
    private lateinit var tvAccuracy: MaterialTextView
    private lateinit var tvConnectionStatus: MaterialTextView
    private lateinit var tvLastSync: MaterialTextView
    private lateinit var previewView: PreviewView
    private lateinit var tvPlateNumber: MaterialTextView
    private lateinit var tvCameraStatus: MaterialTextView
    private lateinit var tvAiStatus: MaterialTextView
    private lateinit var indicatorAi: View
    private lateinit var cardTrip: MaterialCardView
    private lateinit var cardPlanned: MaterialCardView
    private lateinit var llPlannedList: LinearLayout
    private lateinit var cardStats: MaterialCardView
    private lateinit var tvStatDuration: MaterialTextView
    private lateinit var tvStatSpeed: MaterialTextView
    private lateinit var tvStatPlan: MaterialTextView
    private lateinit var tvStatUnit: MaterialTextView
    private lateinit var tvStatStatus: MaterialTextView
    private lateinit var tileAicam: TextView
    private lateinit var tvStatAicam: MaterialTextView
    private lateinit var mapView: MapView
    private lateinit var btnFollow: MaterialButton
    private lateinit var tvAiFace: TextView
    private lateinit var tvAiSeatbelt: TextView
    private lateinit var tvAiEyes: TextView
    private lateinit var tvAiPhone: TextView
    private lateinit var tvAiSmoke: TextView
    private lateinit var tvAiFocus: TextView
    private lateinit var tvAiEyesPct: TextView
    private lateinit var bottomNav: BottomNavigationView

    private var vehicleList = listOf<VehicleInfo>()
    private var selectedVehicleId: String = "unknown" // kode "TRK001" utk kamera/AI
    private var selectedVehicleDbId: Int? = null // id integer DB utk GPS/trip
    private var driverInfo: DriverInfo? = null
    private var currentTripId: Int? = null
    private var activeTrip: TripInfo? = null
    private var plannedTrips = listOf<TripInfo>()
    private var isTripActive = false
    private var followMap = true
    private var mapCentered = false
    private var tripStartMs: Long = 0L
    private var distanceDoneKm = 0.0
    private var lastDistLoc: GpsTracker.GpsUpdate? = null
    private var timerJob: Job? = null
    private var lastAiUiMs = 0L
    private var vehicleMarker: Marker? = null
    private var routeDrawnForTrip: Int? = null

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.values.all { it }
        if (allGranted) {
            onPermissionsGranted()
        } else {
            Toast.makeText(this, "Izin lokasi & kamera dibutuhkan", Toast.LENGTH_LONG).show()
        }
    }

    private val backgroundPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        Configuration.getInstance().userAgentValue = packageName

        initializeViews()
        initializeTrackers()
        setupClickListeners()
        setupMap()
        checkAndRequestPermissions()
        restoreSession()
    }

    override fun onResume() {
        super.onResume()
        mapView.onResume()
        bottomNav.selectedItemId = R.id.nav_dashboard
    }

    override fun onPause() {
        super.onPause()
        mapView.onPause()
    }

    // ---------------- views ----------------

    private fun initializeViews() {
        tvGreeting = findViewById(R.id.tv_greeting)
        btnLogout = findViewById(R.id.btn_logout)
        btnStartTrip = findViewById(R.id.btn_start_trip)
        tvTripStatus = findViewById(R.id.tv_trip_status)
        tvTripInfo = findViewById(R.id.tv_trip_info)
        tvGpsStatus = findViewById(R.id.tv_gps_status)
        tvLatitude = findViewById(R.id.tv_latitude)
        tvLongitude = findViewById(R.id.tv_longitude)
        tvSpeed = findViewById(R.id.tv_speed)
        tvAccuracy = findViewById(R.id.tv_accuracy)
        tvConnectionStatus = findViewById(R.id.tv_connection_status)
        tvLastSync = findViewById(R.id.tv_last_sync)
        previewView = findViewById(R.id.preview_view)
        tvPlateNumber = findViewById(R.id.tv_plate_number)
        tvCameraStatus = findViewById(R.id.tv_camera_status)
        tvAiStatus = findViewById(R.id.tv_ai_status)
        indicatorAi = findViewById(R.id.indicator_ai)
        cardTrip = findViewById(R.id.card_trip)
        cardPlanned = findViewById(R.id.card_planned)
        llPlannedList = findViewById(R.id.ll_planned_list)
        cardStats = findViewById(R.id.card_stats)
        tvStatDuration = findViewById(R.id.tv_stat_duration)
        tvStatSpeed = findViewById(R.id.tv_stat_speed)
        tvStatPlan = findViewById(R.id.tv_stat_plan)
        tvStatUnit = findViewById(R.id.tv_stat_unit)
        tvStatStatus = findViewById(R.id.tv_stat_status)
        tileAicam = findViewById(R.id.tile_aicam)
        tvStatAicam = findViewById(R.id.tv_stat_aicam)
        mapView = findViewById(R.id.map_view)
        btnFollow = findViewById(R.id.btn_follow)
        tvAiFace = findViewById(R.id.tv_ai_face)
        tvAiSeatbelt = findViewById(R.id.tv_ai_seatbelt)
        tvAiEyes = findViewById(R.id.tv_ai_eyes)
        tvAiPhone = findViewById(R.id.tv_ai_phone)
        tvAiSmoke = findViewById(R.id.tv_ai_smoke)
        tvAiFocus = findViewById(R.id.tv_ai_focus)
        tvAiEyesPct = findViewById(R.id.tv_ai_eyes_pct)
        bottomNav = findViewById(R.id.bottom_nav)
    }

    private fun initializeTrackers() {
        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        gpsTracker = GpsTracker(fusedLocationClient)
        gpsRepository = GpsRepository(selectedVehicleDbId ?: 0, lifecycleScope)
        cameraStreamer = CameraStreamer(this, selectedVehicleId, lifecycleScope)
        cameraPreview = CameraPreview(previewView, this).apply {
            cameraStreamer = this@MainActivity.cameraStreamer
        }

        gpsTracker.onLocationUpdate = { update ->
            if (isTripActive) {
                val prev = lastDistLoc
                if (prev != null) {
                    distanceDoneKm += RouteHelper.haversineKm(
                        prev.latitude, prev.longitude, update.latitude, update.longitude
                    )
                }
                lastDistLoc = update
            }
            runOnUiThread {
                tvLatitude.text = String.format("%.6f", update.latitude)
                tvLongitude.text = String.format("%.1f km/h", update.speedKmh)
                tvSpeed.text = String.format("%.1f km/h", update.speedKmh)
                tvAccuracy.text = String.format("%.1f m", update.accuracy)
                tvGpsStatus.text = getString(R.string.gps_active)
                tvGpsStatus.setTextColor(getColor(R.color.status_active))
                updateVehicleMarker(update.latitude, update.longitude)
                updateStatsUi(update.speedKmh)
            }
            gpsRepository.queueLocation(update)
        }

        gpsRepository.onSendSuccess = { _ ->
            runOnUiThread {
                tvConnectionStatus.text = getString(R.string.connected)
                tvConnectionStatus.setTextColor(getColor(R.color.status_connected))
                tvLastSync.text = java.text.SimpleDateFormat(
                    "HH:mm:ss", java.util.Locale.getDefault()
                ).format(java.util.Date())
            }
        }

        gpsRepository.onSendError = { _ ->
            runOnUiThread {
                tvConnectionStatus.text = getString(R.string.disconnected)
                tvConnectionStatus.setTextColor(getColor(R.color.status_disconnected))
            }
        }

        cameraStreamer.onStreamingStatus = { active ->
            runOnUiThread {
                tvCameraStatus.text = if (active) getString(R.string.camera_streaming_active) else getString(R.string.camera_streaming_idle)
                tvCameraStatus.setTextColor(getColor(if (active) R.color.status_active else R.color.status_inactive))
                tvAiStatus.text = if (active) getString(R.string.ai_active) else getString(R.string.ai_idle)
                tvAiStatus.setTextColor(getColor(if (active) R.color.status_active else R.color.status_inactive))
                indicatorAi.setBackgroundResource(
                    if (active) R.drawable.circle_indicator_connected
                    else R.drawable.circle_indicator_disconnected
                )
            }
        }

        cameraStreamer.onAiResult = { result ->
            runOnUiThread { updateAiUi(result) }
        }
    }

    private fun setupClickListeners() {
        btnStartTrip.setOnClickListener {
            if (isTripActive) {
                handleEndTrip()
            } else {
                handleStartTrip()
            }
        }

        findViewById<MaterialButton>(R.id.btn_select_vehicle)
            .setOnClickListener {
                if (!isTripActive) {
                    showVehicleSelector()
                } else {
                    Toast.makeText(this, "Tidak bisa ganti kendaraan saat trip berjalan", Toast.LENGTH_SHORT).show()
                }
            }

        btnFollow.setOnClickListener {
            followMap = !followMap
            btnFollow.text = getString(if (followMap) R.string.follow else R.string.free_map)
        }

        btnLogout.setOnClickListener { doLogout() }

        bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_dashboard -> true
                R.id.nav_trips -> {
                    startActivity(Intent(this, TripsActivity::class.java))
                    true
                }
                R.id.nav_alerts -> {
                    startActivity(Intent(this, AlertsActivity::class.java))
                    true
                }
                R.id.nav_chat -> {
                    startActivity(Intent(this, ChatActivity::class.java))
                    true
                }
                else -> false
            }
        }
    }

    private fun doLogout() {
        lifecycleScope.launch {
            try { RetrofitClient.apiService.logout() } catch (e: Exception) { }
            try {
                if (isTripActive) {
                    stopCameraStreaming()
                    stopGpsTracking()
                }
            } catch (e: Exception) { }
            RetrofitClient.clearAuthToken()
            FleetVisionApp.preferences.edit().remove("user_email").apply()
            FleetVisionApp.instance.clearActiveTrip()
            startActivity(Intent(this@MainActivity, LoginActivity::class.java))
            finish()
        }
    }

    // ---------------- permissions ----------------

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
            permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            permissions.add(Manifest.permission.CAMERA)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        if (permissions.isNotEmpty()) {
            requestPermissionLauncher.launch(permissions.toTypedArray())
        } else {
            onPermissionsGranted()
        }
    }

    private fun onPermissionsGranted() {
        loadDriverAndVehicles()
        ensureBackgroundLocation()
    }

    /**
     * Layar mati = GPS ikut mati kecuali izin "sepanjang waktu" diberikan.
     * Android 10: minta langsung. Android 11+: wajib lewat halaman Settings.
     */
    private fun ensureBackgroundLocation() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        ) return
        if (Build.VERSION.SDK_INT == Build.VERSION_CODES.Q) {
            backgroundPermissionLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        } else {
            android.app.AlertDialog.Builder(this)
                .setTitle("Izin lokasi sepanjang waktu")
                .setMessage("Agar GPS tetap jalan saat layar mati, pilih 'Allow all the time' di halaman berikutnya.")
                .setPositiveButton("Buka Pengaturan") { _, _ ->
                    startActivity(
                        Intent(
                            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.parse("package:$packageName")
                        )
                    )
                }
                .setNegativeButton("Nanti", null)
                .show()
        }
    }

    // ---------------- map ----------------

    private fun setupMap() {
        mapView.setTileSource(org.osmdroid.tileprovider.tilesource.TileSourceFactory.MAPNIK)
        mapView.setMultiTouchControls(true)
        mapView.controller.setZoom(13.0)
        mapView.controller.setCenter(GeoPoint(-6.2088, 106.8456))
        mapView.setOnTouchListener { v, event ->
            if (event.action == MotionEvent.ACTION_MOVE && isTripActive) {
                if (followMap) {
                    followMap = false
                    btnFollow.text = getString(R.string.free_map)
                }
            }
            if (event.action == MotionEvent.ACTION_DOWN) {
                v.parent.requestDisallowInterceptTouchEvent(true)
            }
            false
        }
    }

    private fun updateVehicleMarker(lat: Double, lng: Double) {
        var m = vehicleMarker
        if (m == null) {
            m = Marker(mapView)
            m.title = tvPlateNumber.text?.toString() ?: "Kendaraan"
            mapView.overlays.add(m)
            vehicleMarker = m
        }
        m.position = GeoPoint(lat, lng)
        if (followMap) {
            if (!mapCentered) {
                mapView.controller.setZoom(15.0)
                mapCentered = true
            }
            mapView.controller.setCenter(m.position)
        }
        mapView.invalidate()
    }

    private fun drawRouteForActiveTrip() {
        val trip = activeTrip ?: return
        val id = trip.id
        if (routeDrawnForTrip == id) return
        routeDrawnForTrip = id
        lifecycleScope.launch {
            val oLat = trip.startLatitude
            val oLng = trip.startLongitude
            val dLat = trip.destLatitude
            val dLng = trip.destLongitude
            if (oLat == null || oLng == null || dLat == null || dLng == null) return@launch
            val dest = Marker(mapView)
            dest.position = GeoPoint(dLat, dLng)
            dest.title = trip.destination ?: "Tujuan"
            mapView.overlays.add(dest)
            val route = RouteHelper.fetchRoadRoute(oLat, oLng, dLat, dLng)
                ?: RouteHelper.straightLine(oLat, oLng, dLat, dLng)
            val line = Polyline()
            line.setPoints(route)
            line.color = 0xFF2563EB.toInt()
            line.width = 8f
            mapView.overlays.add(line)
            mapView.invalidate()
        }
    }

    private fun clearRoute() {
        routeDrawnForTrip = null
        vehicleMarker = null
        mapCentered = false
        mapView.overlays.clear()
        mapView.invalidate()
    }

    // ---------------- data ----------------

    private fun restoreSession() {
        val app = FleetVisionApp.instance
        val savedTripId = app.getActiveTripId()

        if (savedTripId != null && app.isLoggedIn()) {
            currentTripId = savedTripId
            selectedVehicleId = app.getActiveVehicleId() ?: "unknown"
            isTripActive = true
            updateUiForActiveTrip()

            lifecycleScope.launch {
                try {
                    val response = RetrofitClient.apiService.getTrip(savedTripId)
                    val trip = response.data?.trip
                    if (response.success && trip != null && trip.status == "IN_PROGRESS") {
                        activeTrip = trip
                        selectedVehicleDbId = trip.vehicleId
                        selectedVehicleId = vehicleList.find { it.id == trip.vehicleId }?.vehicleId
                            ?: app.getActiveVehicleId() ?: "unknown"
                        gpsRepository.vehicleDbId = trip.vehicleId
                        cameraStreamer.vehicleId = selectedVehicleId
                        tvPlateNumber.text = vehicleList.find { it.id == trip.vehicleId }?.plateNumber
                            ?: selectedVehicleId
                        tvStatUnit.text = tvPlateNumber.text?.toString() ?: "—"
                        tvStatStatus.text = "On Trip"
                        tripStartMs = parseStartMs(trip.startTime)
                        distanceDoneKm = 0.0
                        drawRouteForActiveTrip()
                        startGpsTracking()
                        startCameraStreaming()
                    } else {
                        endTripCleanup()
                    }
                } catch (e: Exception) {
                    startGpsTracking()
                    startCameraStreaming()
                }
            }
        }
    }

    private fun loadDriverAndVehicles() {
        lifecycleScope.launch {
            try {
                val driversResponse = RetrofitClient.apiService.getDrivers()
                if (driversResponse.success && driversResponse.data != null) {
                    val email = FleetVisionApp.instance.getUserEmail()
                    driverInfo = driversResponse.data.find { it.email == email }
                }
                tvGreeting.text = driverInfo?.let { "Halo, ${it.name.split(" ").firstOrNull() ?: it.name}" }
                    ?: getString(R.string.app_name)

                val vehiclesResponse = RetrofitClient.apiService.getVehicles()
                if (vehiclesResponse.success && vehiclesResponse.data != null) {
                    vehicleList = vehiclesResponse.data
                    if (vehicleList.isNotEmpty() && selectedVehicleId == "unknown") {
                        // Utamakan unit assign-an admin; fallback ke unit pertama.
                        val assigned = driverInfo?.vehicleId?.let { aid ->
                            vehicleList.find { it.id == aid }
                        }
                        val pick = assigned ?: vehicleList.first()
                        selectedVehicleId = pick.vehicleId
                        selectedVehicleDbId = pick.id
                        gpsRepository.vehicleDbId = pick.id
                        cameraStreamer.vehicleId = pick.vehicleId
                        tvPlateNumber.text = pick.plateNumber
                        tvStatUnit.text = pick.plateNumber
                        tvStatStatus.text = driverInfo?.status ?: "Siaga"
                    }
                }
                loadPlannedTrips()
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Gagal memuat data", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun loadPlannedTrips() {
        val myId = driverInfo?.id ?: return
        lifecycleScope.launch {
            try {
                val res = RetrofitClient.apiService.getTrips()
                plannedTrips = (res.data ?: emptyList()).filter { it.driverId == myId && it.status == "PLANNED" }
                    .sortedByDescending { it.id }
                renderPlannedTrips()
            } catch (e: Exception) { }
        }
    }

    private fun renderPlannedTrips() {
        llPlannedList.removeAllViews()
        cardPlanned.visibility = if (plannedTrips.isEmpty() || isTripActive) View.GONE else View.VISIBLE
        if (plannedTrips.isEmpty() || isTripActive) return
        val inflater = LayoutInflater.from(this)
        for (t in plannedTrips) {
            val row = inflater.inflate(R.layout.item_planned_trip, llPlannedList, false)
            val title = row.findViewById<TextView>(R.id.tv_route_title)
            val sub = row.findViewById<TextView>(R.id.tv_route_sub)
            title.text = "${t.origin ?: "Titik awal"} → ${t.destination ?: "Tujuan"}"
            sub.text = "Estimasi ${RouteHelper.formatKm(t.plannedDistanceKm)}"
            row.findViewById<MaterialButton>(R.id.btn_start_route).setOnClickListener {
                handleStartPlannedTrip(t)
            }
            llPlannedList.addView(row)
        }
    }

    // ---------------- trip ----------------

    /**
     * Lokasi sekali-ambil. getCurrentLocation() mengembalikan Task (async),
     * jadi ditunggu di thread IO — tidak boleh di main thread.
     */
    private suspend fun getCurrentFix(): android.location.Location? {
        return try {
            withContext(Dispatchers.IO) {
                com.google.android.gms.tasks.Tasks.await(
                    LocationServices.getFusedLocationProviderClient(this@MainActivity)
                        .getCurrentLocation(
                            com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY,
                            null
                        )
                )
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun handleStartTrip() {
        if (selectedVehicleId == "unknown") {
            Toast.makeText(this, "Pilih kendaraan dulu", Toast.LENGTH_SHORT).show()
            return
        }

        if (driverInfo == null) {
            Toast.makeText(this, "Profil sopir tidak ditemukan", Toast.LENGTH_SHORT).show()
            return
        }

        val driverId = driverInfo!!.id
        val vehicleIdInt = vehicleList.find { it.vehicleId == selectedVehicleId }?.id

        if (vehicleIdInt == null) {
            Toast.makeText(this, "Kendaraan tidak valid", Toast.LENGTH_SHORT).show()
            return
        }

        selectedVehicleDbId = vehicleIdInt
        gpsRepository.vehicleDbId = vehicleIdInt
        cameraStreamer.vehicleId = selectedVehicleId

        setTripLoading(true)

        lifecycleScope.launch {
            try {
                val location = getCurrentFix()

                val lat = location?.latitude ?: 0.0
                val lng = location?.longitude ?: 0.0

                val createResponse = RetrofitClient.apiService.createTrip(
                    TripCreateBody(
                        vehicleId = vehicleIdInt,
                        driverId = driverId,
                        startLatitude = lat,
                        startLongitude = lng
                    )
                )

                if (!createResponse.success || createResponse.data == null) {
                    Toast.makeText(this@MainActivity, "Gagal membuat trip: ${createResponse.message}", Toast.LENGTH_SHORT).show()
                    setTripLoading(false)
                    return@launch
                }

                val tripId = createResponse.data.id

                val startResponse = RetrofitClient.apiService.updateTrip(
                    tripId,
                    TripUpdateBody(action = "start")
                )

                if (!startResponse.success) {
                    Toast.makeText(this@MainActivity, "Gagal memulai trip: ${startResponse.message}", Toast.LENGTH_SHORT).show()
                    setTripLoading(false)
                    return@launch
                }

                currentTripId = tripId
                isTripActive = true
                activeTrip = startResponse.data
                tripStartMs = System.currentTimeMillis()
                distanceDoneKm = 0.0
                lastDistLoc = null

                FleetVisionApp.instance.saveActiveTrip(tripId, selectedVehicleId, driverId)

                startGpsTracking()
                startCameraStreaming()
                drawRouteForActiveTrip()
                updateUiForActiveTrip()

                Toast.makeText(this@MainActivity, "Trip dimulai", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                setTripLoading(false)
            }
        }
    }

    private fun handleStartPlannedTrip(trip: TripInfo) {
        setTripLoading(true)
        lifecycleScope.launch {
            try {
                val fix = gpsTracker.lastUpdate
                val location = if (fix != null) {
                    mapOf("start_latitude" to fix.latitude, "start_longitude" to fix.longitude)
                } else {
                    val g = getCurrentFix()
                    mapOf("start_latitude" to (g?.latitude ?: 0.0), "start_longitude" to (g?.longitude ?: 0.0))
                }
                val body = TripUpdateBody(
                    action = "start",
                    startLatitude = location["start_latitude"] as? Double,
                    startLongitude = location["start_longitude"] as? Double
                )
                val startResponse = RetrofitClient.apiService.updateTrip(trip.id, body)
                if (!startResponse.success || startResponse.data == null) {
                    Toast.makeText(this@MainActivity, "Gagal memulai: ${startResponse.message}", Toast.LENGTH_SHORT).show()
                    setTripLoading(false)
                    return@launch
                }

                currentTripId = trip.id
                isTripActive = true
                activeTrip = startResponse.data
                tripStartMs = System.currentTimeMillis()
                distanceDoneKm = 0.0
                lastDistLoc = null
                val vid = activeTrip?.vehicleId ?: trip.vehicleId
                selectedVehicleDbId = vid
                gpsRepository.vehicleDbId = vid

                FleetVisionApp.instance.saveActiveTrip(trip.id, selectedVehicleId, trip.driverId)

                startGpsTracking()
                startCameraStreaming()
                drawRouteForActiveTrip()
                updateUiForActiveTrip()
                renderPlannedTrips()
                Toast.makeText(this@MainActivity, "Rute dimulai", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                setTripLoading(false)
            }
        }
    }

    private fun handleEndTrip() {
        val tripId = currentTripId ?: return

        setTripLoading(true)

        lifecycleScope.launch {
            try {
                val location = getCurrentFix()

                val lat = location?.latitude ?: 0.0
                val lng = location?.longitude ?: 0.0

                val response = RetrofitClient.apiService.updateTrip(
                    tripId,
                    TripUpdateBody(
                        action = "end",
                        endLatitude = lat,
                        endLongitude = lng,
                        totalDistanceKm = Math.round(distanceDoneKm * 100) / 100.0
                    )
                )

                if (response.success) {
                    endTripCleanup()
                    loadPlannedTrips()
                    Toast.makeText(this@MainActivity, "Trip selesai", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this@MainActivity, "Gagal mengakhiri trip: ${response.message}", Toast.LENGTH_SHORT).show()
                    setTripLoading(false)
                }
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                setTripLoading(false)
            }
        }
    }

    private fun endTripCleanup() {
        currentTripId = null
        isTripActive = false
        activeTrip = null
        distanceDoneKm = 0.0
        lastDistLoc = null
        FleetVisionApp.instance.clearActiveTrip()

        stopCameraStreaming()
        stopGpsTracking()
        clearRoute()
        updateUiForIdleTrip()
    }

    private fun startGpsTracking() {
        try {
            gpsTracker.startTracking()
            gpsRepository.startAutoFlush()

            val serviceIntent = Intent(this, GpsTrackingService::class.java).apply {
                putExtra(GpsTrackingService.EXTRA_VEHICLE_ID, selectedVehicleDbId ?: 0)
                // Batas pengaman 8 jam (trip logistik bisa lama).
                putExtra(GpsTrackingService.EXTRA_TIMEOUT_MINUTES, 480L)
            }
            ContextCompat.startForegroundService(this, serviceIntent)

            tvGpsStatus.text = getString(R.string.gps_active)
            tvGpsStatus.setTextColor(getColor(R.color.status_active))
            startTimer()
        } catch (e: SecurityException) {
            Toast.makeText(this, "Izin lokasi dibutuhkan", Toast.LENGTH_LONG).show()
        }
    }

    private fun stopGpsTracking() {
        gpsTracker.stopTracking()
        gpsRepository.stopAutoFlush()
        tvGpsStatus.text = getString(R.string.gps_inactive)
        tvGpsStatus.setTextColor(getColor(R.color.status_inactive))
        stopService(Intent(this, GpsTrackingService::class.java))
        timerJob?.cancel()
        timerJob = null
    }

    private fun startTimer() {
        timerJob?.cancel()
        timerJob = lifecycleScope.launch {
            while (isActive) {
                val sec = ((System.currentTimeMillis() - tripStartMs) / 1000).toInt().coerceAtLeast(0)
                tvStatDuration.text = formatDuration(sec)
                delay(1000L)
            }
        }
    }

    private fun formatDuration(sec: Int): String {
        val h = sec / 3600
        val m = (sec % 3600) / 60
        val s = sec % 60
        return String.format("%02d:%02d:%02d", h, m, s)
    }

    private fun parseStartMs(iso: String?): Long {
        if (iso.isNullOrEmpty()) return System.currentTimeMillis()
        return try {
            Instant.parse(iso).toEpochMilli()
        } catch (e: Exception) {
            System.currentTimeMillis()
        }
    }

    private fun updateStatsUi(speedKmh: Float) {
        if (!isTripActive) return
        tvStatSpeed.text = String.format("%.0f km/h", speedKmh)
        tvStatPlan.text = RouteHelper.formatKm(activeTrip?.plannedDistanceKm)
        val dLat = activeTrip?.destLatitude
        val dLng = activeTrip?.destLongitude
        val cur = lastDistLoc
        val sisa = if (dLat != null && dLng != null && cur != null) {
            RouteHelper.formatKm(RouteHelper.haversineKm(cur.latitude, cur.longitude, dLat, dLng))
        } else {
            null
        }
        val dest = activeTrip?.destination
        val route = if (!dest.isNullOrEmpty()) "🎯 ${activeTrip?.origin ?: "Awal"} → $dest · " else ""
        tvTripInfo.text = route + "Ditempuh ${String.format("%.2f km", distanceDoneKm)}" +
                (if (sisa != null) " · Sisa $sisa" else "")
    }

    private fun startCameraStreaming() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Toast.makeText(this, "Izin kamera dibutuhkan untuk AI monitoring", Toast.LENGTH_LONG).show()
            return
        }

        cameraStreamer.startStreaming()
        cameraPreview.start()
        previewView.visibility = View.VISIBLE
        tileAicam.setBackgroundResource(R.drawable.tile_green)
        tvStatAicam.text = "Aktif"

        val serviceIntent = Intent(this, CameraStreamingService::class.java).apply {
            putExtra(CameraStreamingService.EXTRA_VEHICLE_ID, selectedVehicleId)
        }
        ContextCompat.startForegroundService(this, serviceIntent)
    }

    private fun stopCameraStreaming() {
        cameraStreamer.stopStreaming()
        cameraPreview.stop()
        previewView.visibility = View.GONE
        tileAicam.setBackgroundResource(R.drawable.tile_red)
        tvStatAicam.text = "Mati"
        tvCameraStatus.text = getString(R.string.camera_streaming_idle)
        tvCameraStatus.setTextColor(getColor(R.color.status_inactive))
        tvAiStatus.text = getString(R.string.ai_idle)
        tvAiStatus.setTextColor(getColor(R.color.status_inactive))
        indicatorAi.setBackgroundResource(R.drawable.circle_indicator_disconnected)
        resetAiChips()
        stopService(Intent(this, CameraStreamingService::class.java))
    }

    // ---------------- AI indicators ----------------

    private fun Any?.toBool(): Boolean = (this as? Boolean) ?: false
    private fun Any?.toDoubleOrNullX(): Double? = (this as? Number)?.toDouble()

    private fun updateAiUi(result: Map<String, Any>?) {
        val now = System.currentTimeMillis()
        if (now - lastAiUiMs < 700) return
        lastAiUiMs = now
        if (result == null) return
        setChip(tvAiFace, result["face_detected"].toBool(), getString(R.string.ai_face))
        setChip(tvAiSeatbelt, result["seatbelt"].toBool(), getString(R.string.ai_seatbelt))
        val eyeClosed = result["eye_closed"].toDoubleOrNullX() ?: 0.0
        setChip(tvAiEyes, eyeClosed < 0.5, getString(R.string.ai_eyes_open))
        setChip(tvAiPhone, !(result["phone"].toBool()), getString(R.string.ai_no_phone))
        setChip(tvAiSmoke, !(result["smoking"].toBool()), getString(R.string.ai_no_smoke))
        setChip(tvAiFocus, !(result["looking_away"].toBool()), getString(R.string.ai_focus))
        tvAiEyesPct.text = "Mata: ${(eyeClosed * 100).toInt()}%"
    }

    private fun setChip(tv: TextView, ok: Boolean, label: String) {
        tv.text = (if (ok) "✓ " else "✗ ") + label
        tv.setTextColor(getColor(if (ok) R.color.status_active else R.color.status_disconnected))
    }

    private fun resetAiChips() {
        val labels = listOf(
            tvAiFace to getString(R.string.ai_face),
            tvAiSeatbelt to getString(R.string.ai_seatbelt),
            tvAiEyes to getString(R.string.ai_eyes_open),
            tvAiPhone to getString(R.string.ai_no_phone),
            tvAiSmoke to getString(R.string.ai_no_smoke),
            tvAiFocus to getString(R.string.ai_focus)
        )
        for ((tv, label) in labels) {
            tv.text = label
            tv.setTextColor(getColor(R.color.status_inactive))
        }
        tvAiEyesPct.text = "Mata: --"
    }

    // ---------------- ui states ----------------

    private fun updateUiForActiveTrip() {
        btnStartTrip.text = getString(R.string.end_trip)
        btnStartTrip.setBackgroundColor(getColor(R.color.error))
        tvTripStatus.text = getString(R.string.on_trip)
        tvTripStatus.setTextColor(getColor(R.color.status_active))
        tvStatStatus.text = "On Trip"
        val dest = activeTrip?.destination
        tvTripInfo.visibility = View.VISIBLE
        tvTripInfo.text = if (!dest.isNullOrEmpty()) {
            "🎯 ${activeTrip?.origin ?: "Titik awal"} → $dest"
        } else {
            "Kendaraan: $selectedVehicleId"
        }
        cardStats.visibility = View.VISIBLE
        cardPlanned.visibility = View.GONE
        tvStatPlan.text = RouteHelper.formatKm(activeTrip?.plannedDistanceKm)
        followMap = true
        mapCentered = false
        btnFollow.text = getString(R.string.follow)
    }

    private fun updateUiForIdleTrip() {
        btnStartTrip.text = getString(R.string.start_trip)
        btnStartTrip.setBackgroundResource(R.drawable.btn_primary)
        tvTripStatus.text = getString(R.string.ready_to_go)
        tvTripStatus.setTextColor(getColor(R.color.text_secondary))
        tvTripInfo.visibility = View.GONE
        cardStats.visibility = View.VISIBLE
        tvStatStatus.text = driverInfo?.status ?: "Siaga"
        tvStatUnit.text = vehicleList.find { it.id == selectedVehicleDbId }?.plateNumber
            ?: tvPlateNumber.text?.toString() ?: "—"
        tvStatDuration.text = "—"
        tvStatSpeed.text = "—"
        tvStatPlan.text = "—"
        renderPlannedTrips()
    }

    private fun setTripLoading(loading: Boolean) {
        btnStartTrip.isEnabled = !loading
        btnStartTrip.text = if (loading) {
            if (isTripActive) getString(R.string.ending_trip) else getString(R.string.starting_trip)
        } else {
            if (isTripActive) getString(R.string.end_trip) else getString(R.string.start_trip)
        }
    }

    private fun showVehicleSelector() {
        val items = vehicleList.map { "${it.plateNumber} (${it.vehicleId})" }.toTypedArray()
        if (items.isEmpty()) {
            Toast.makeText(this, "Belum ada kendaraan", Toast.LENGTH_SHORT).show()
            return
        }

        val builder = android.app.AlertDialog.Builder(this)
        builder.setTitle("Pilih Kendaraan")
            .setItems(items) { _, which ->
                val vehicle = vehicleList[which]
                selectedVehicleId = vehicle.vehicleId
                selectedVehicleDbId = vehicle.id
                tvPlateNumber.text = vehicle.plateNumber
                tvStatUnit.text = vehicle.plateNumber

                gpsRepository.vehicleDbId = vehicle.id
                cameraStreamer.vehicleId = vehicle.vehicleId
                cameraPreview.cameraStreamer = cameraStreamer

                Toast.makeText(this, "Dipilih: ${vehicle.plateNumber}", Toast.LENGTH_SHORT).show()
            }
            .show()
    }

    override fun onDestroy() {
        if (isTripActive) {
            gpsTracker.stopTracking()
            gpsRepository.stopAutoFlush()
            cameraStreamer.stopStreaming()
        }
        super.onDestroy()
    }
}
