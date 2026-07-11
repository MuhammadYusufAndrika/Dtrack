package com.fleetvisionai

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
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
import com.fleetvisionai.models.VehicleInfo
import com.google.android.gms.location.LocationServices
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.textview.MaterialTextView
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var gpsTracker: GpsTracker
    private lateinit var gpsRepository: GpsRepository
    private lateinit var cameraStreamer: CameraStreamer
    private lateinit var cameraPreview: CameraPreview

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

    private var vehicleList = listOf<VehicleInfo>()
    private var selectedVehicleId: String = "unknown"
    private var driverInfo: DriverInfo? = null
    private var currentTripId: Int? = null
    private var isTripActive = false

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.values.all { it }
        if (allGranted) {
            onPermissionsGranted()
        } else {
            Toast.makeText(this, "Required permissions not granted", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        initializeViews()
        initializeTrackers()
        setupClickListeners()
        checkAndRequestPermissions()
        restoreSession()
    }

    private fun initializeViews() {
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
    }

    private fun initializeTrackers() {
        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        gpsTracker = GpsTracker(fusedLocationClient)
        gpsRepository = GpsRepository(selectedVehicleId, lifecycleScope)
        cameraStreamer = CameraStreamer(this, selectedVehicleId, lifecycleScope)
        cameraPreview = CameraPreview(previewView, this).apply {
            cameraStreamer = this@MainActivity.cameraStreamer
        }

        gpsTracker.onLocationUpdate = { update ->
            runOnUiThread {
                tvLatitude.text = String.format("%.6f", update.latitude)
                tvLongitude.text = String.format("%.6f", update.longitude)
                tvSpeed.text = String.format("%.1f km/h", update.speedKmh)
                tvAccuracy.text = String.format("%.1f m", update.accuracy)
                tvGpsStatus.text = getString(R.string.gps_active)
                tvGpsStatus.setTextColor(getColor(R.color.status_active))
            }
            gpsRepository.queueLocation(update)
        }

        gpsRepository.onSendSuccess = { count ->
            runOnUiThread {
                tvConnectionStatus.text = getString(R.string.connected)
                tvConnectionStatus.setTextColor(getColor(R.color.status_connected))
                tvLastSync.text = java.text.SimpleDateFormat(
                    "HH:mm:ss", java.util.Locale.getDefault()
                ).format(java.util.Date())
            }
        }

        gpsRepository.onSendError = { error ->
            runOnUiThread {
                tvConnectionStatus.text = getString(R.string.disconnected)
                tvConnectionStatus.setTextColor(getColor(R.color.status_disconnected))
            }
        }

        cameraStreamer.onStreamingStatus = { active ->
            runOnUiThread {
                tvCameraStatus.text = if (active) getString(R.string.camera_streaming_active) else getString(R.string.camera_streaming_idle)
                tvCameraStatus.setTextColor(getColor(if (active) R.color.status_active else R.color.status_inactive))
                tvAiStatus.text = if (active) getString(R.string.ai_active) else getString(R.id.ai_idle)
                tvAiStatus.setTextColor(getColor(if (active) R.color.status_active else R.color.status_inactive))
                indicatorAi.setBackgroundResource(
                    if (active) R.drawable.circle_indicator_connected
                    else R.drawable.circle_indicator_disconnected
                )
            }
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
                    Toast.makeText(this, "Cannot change vehicle during an active trip", Toast.LENGTH_SHORT).show()
                }
            }
    }

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
    }

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
                    if (response.success && response.data != null && response.data.status == "IN_PROGRESS") {
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
                val vehiclesResponse = RetrofitClient.apiService.getVehicles()
                if (vehiclesResponse.success && vehiclesResponse.data != null) {
                    vehicleList = vehiclesResponse.data
                    if (vehicleList.isNotEmpty() && selectedVehicleId == "unknown") {
                        selectedVehicleId = vehicleList.first().vehicleId
                        tvPlateNumber.text = vehicleList.first().plateNumber
                    }
                }

                val driversResponse = RetrofitClient.apiService.getDrivers()
                if (driversResponse.success && driversResponse.data != null) {
                    val email = FleetVisionApp.instance.getUserEmail()
                    driverInfo = driversResponse.data.find { it.email == email }
                }
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Failed to load data", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun handleStartTrip() {
        if (selectedVehicleId == "unknown") {
            Toast.makeText(this, "Please select a vehicle first", Toast.LENGTH_SHORT).show()
            return
        }

        if (driverInfo == null) {
            Toast.makeText(this, "Driver profile not found", Toast.LENGTH_SHORT).show()
            return
        }

        val driverId = driverInfo!!.id
        val vehicleIdInt = vehicleList.find { it.vehicleId == selectedVehicleId }?.id

        if (vehicleIdInt == null) {
            Toast.makeText(this, "Invalid vehicle selected", Toast.LENGTH_SHORT).show()
            return
        }

        setTripLoading(true)

        lifecycleScope.launch {
            try {
                val fusedLocationClient = LocationServices.getFusedLocationProviderClient(this@MainActivity)
                @Suppress("MissingPermission")
                val location = fusedLocationClient.getCurrentLocation(
                    com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY,
                    null
                )

                val lat = location?.latitude ?: 0.0
                val lng = location?.longitude ?: 0.0

                val createResponse = RetrofitClient.apiService.createTrip(
                    mapOf(
                        "vehicle_id" to vehicleIdInt,
                        "driver_id" to driverId,
                        "start_latitude" to lat,
                        "start_longitude" to lng
                    )
                )

                if (!createResponse.success || createResponse.data == null) {
                    Toast.makeText(this@MainActivity, "Failed to create trip: ${createResponse.message}", Toast.LENGTH_SHORT).show()
                    setTripLoading(false)
                    return@launch
                }

                val tripId = createResponse.data.id

                val startResponse = RetrofitClient.apiService.updateTrip(
                    tripId,
                    mapOf("action" to "start")
                )

                if (!startResponse.success) {
                    Toast.makeText(this@MainActivity, "Failed to start trip: ${startResponse.message}", Toast.LENGTH_SHORT).show()
                    setTripLoading(false)
                    return@launch
                }

                currentTripId = tripId
                isTripActive = true

                FleetVisionApp.instance.saveActiveTrip(tripId, selectedVehicleId, driverId)

                startGpsTracking()
                startCameraStreaming()
                updateUiForActiveTrip()

                Toast.makeText(this@MainActivity, "Trip started", Toast.LENGTH_SHORT).show()
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
                val fusedLocationClient = LocationServices.getFusedLocationProviderClient(this@MainActivity)
                @Suppress("MissingPermission")
                val location = fusedLocationClient.getCurrentLocation(
                    com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY,
                    null
                )

                val lat = location?.latitude ?: 0.0
                val lng = location?.longitude ?: 0.0

                val response = RetrofitClient.apiService.updateTrip(
                    tripId,
                    mapOf(
                        "action" to "end",
                        "end_latitude" to lat,
                        "end_longitude" to lng
                    )
                )

                if (response.success) {
                    endTripCleanup()
                    Toast.makeText(this@MainActivity, "Trip ended", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this@MainActivity, "Failed to end trip: ${response.message}", Toast.LENGTH_SHORT).show()
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
        FleetVisionApp.instance.clearActiveTrip()

        stopCameraStreaming()
        stopGpsTracking()
        updateUiForIdleTrip()
    }

    private fun startGpsTracking() {
        try {
            gpsTracker.startTracking()
            gpsRepository.startAutoFlush()

            val serviceIntent = Intent(this, GpsTrackingService::class.java).apply {
                putExtra(GpsTrackingService.EXTRA_VEHICLE_ID, selectedVehicleId)
                putExtra(GpsTrackingService.EXTRA_TIMEOUT_MINUTES, 120L)
            }
            ContextCompat.startForegroundService(this, serviceIntent)

            tvGpsStatus.text = getString(R.string.gps_active)
            tvGpsStatus.setTextColor(getColor(R.color.status_active))
        } catch (e: SecurityException) {
            Toast.makeText(this, "Location permission required", Toast.LENGTH_LONG).show()
        }
    }

    private fun stopGpsTracking() {
        gpsTracker.stopTracking()
        gpsRepository.stopAutoFlush()
        tvGpsStatus.text = getString(R.string.gps_inactive)
        tvGpsStatus.setTextColor(getColor(R.color.status_inactive))
        stopService(Intent(this, GpsTrackingService::class.java))
    }

    private fun startCameraStreaming() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Toast.makeText(this, "Camera permission required for AI monitoring", Toast.LENGTH_LONG).show()
            return
        }

        cameraStreamer.startStreaming()
        cameraPreview.start()
        previewView.visibility = View.VISIBLE

        val serviceIntent = Intent(this, CameraStreamingService::class.java).apply {
            putExtra(CameraStreamingService.EXTRA_VEHICLE_ID, selectedVehicleId)
        }
        ContextCompat.startForegroundService(this, serviceIntent)
    }

    private fun stopCameraStreaming() {
        cameraStreamer.stopStreaming()
        cameraPreview.stop()
        previewView.visibility = View.GONE
        tvCameraStatus.text = getString(R.string.camera_streaming_idle)
        tvCameraStatus.setTextColor(getColor(R.color.status_inactive))
        tvAiStatus.text = getString(R.string.ai_idle)
        tvAiStatus.setTextColor(getColor(R.color.status_inactive))
        indicatorAi.setBackgroundResource(R.drawable.circle_indicator_disconnected)
        stopService(Intent(this, CameraStreamingService::class.java))
    }

    private fun updateUiForActiveTrip() {
        btnStartTrip.text = getString(R.string.end_trip)
        btnStartTrip.setBackgroundColor(getColor(R.color.error))
        tvTripStatus.text = getString(R.string.trip_in_progress)
        tvTripStatus.setTextColor(getColor(R.color.status_active))
        tvTripInfo.visibility = View.VISIBLE
        tvTripInfo.text = "Vehicle: $selectedVehicleId"
    }

    private fun updateUiForIdleTrip() {
        btnStartTrip.text = getString(R.string.start_trip)
        btnStartTrip.setBackgroundColor(getColor(R.color.secondary))
        tvTripStatus.text = getString(R.string.no_active_trip)
        tvTripStatus.setTextColor(getColor(R.color.text_secondary))
        tvTripInfo.visibility = View.GONE
    }

    private fun setTripLoading(loading: Boolean) {
        btnStartTrip.isEnabled = !loading
        btnStartTrip.text = if (loading) {
            if (isTripActive) getString(R.string.ending_trip) else getString(R.string.starting_trip)
        } else {
            if (isTripActive) getString(R.string.end_trip) else getString(R.string.start_trip)
        }
    }

    private fun loadVehicles() {
        lifecycleScope.launch {
            try {
                val response = RetrofitClient.apiService.getVehicles()
                if (response.success && response.data != null) {
                    vehicleList = response.data
                    if (vehicleList.isNotEmpty()) {
                        selectedVehicleId = vehicleList.first().vehicleId
                        tvPlateNumber.text = vehicleList.first().plateNumber
                    }
                }
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Failed to load vehicles", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun showVehicleSelector() {
        val items = vehicleList.map { "${it.plateNumber} (${it.vehicleId})" }.toTypedArray()
        if (items.isEmpty()) {
            Toast.makeText(this, "No vehicles available", Toast.LENGTH_SHORT).show()
            return
        }

        val builder = android.app.AlertDialog.Builder(this)
        builder.setTitle("Select Vehicle")
            .setItems(items) { _, which ->
                val vehicle = vehicleList[which]
                selectedVehicleId = vehicle.vehicleId
                tvPlateNumber.text = vehicle.plateNumber

                gpsRepository = GpsRepository(selectedVehicleId, lifecycleScope)
                cameraStreamer = CameraStreamer(this, selectedVehicleId, lifecycleScope)
                cameraPreview.cameraStreamer = cameraStreamer

                Toast.makeText(this, "Selected: ${vehicle.plateNumber}", Toast.LENGTH_SHORT).show()
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
