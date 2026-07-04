package com.fleetvisionai

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.ArrayAdapter
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
import com.fleetvisionai.models.VehicleInfo
import com.google.android.gms.location.LocationServices
import com.google.android.material.button.MaterialButtonToggleGroup
import com.google.android.material.card.MaterialCardView
import com.google.android.material.switchmaterial.SwitchMaterial
import com.google.android.material.textview.MaterialTextView
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var gpsTracker: GpsTracker
    private lateinit var gpsRepository: GpsRepository
    private lateinit var cameraStreamer: CameraStreamer
    private lateinit var cameraPreview: CameraPreview

    private lateinit var switchGps: SwitchMaterial
    private lateinit var switchCamera: SwitchMaterial
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
    private lateinit var cardGps: MaterialCardView
    private lateinit var cardCamera: MaterialCardView
    private lateinit var cardVehicle: MaterialCardView

    private var vehicleList = listOf<VehicleInfo>()
    private var selectedVehicleId: String = "unknown"
    private var isGpsActive = false
    private var isCameraActive = false

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
        loadVehicles()
    }

    private fun initializeViews() {
        switchGps = findViewById(R.id.switch_gps)
        switchCamera = findViewById(R.id.switch_camera)
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
        cardGps = findViewById(R.id.card_gps)
        cardCamera = findViewById(R.id.card_camera)
        cardVehicle = findViewById(R.id.card_vehicle)
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
                tvGpsStatus.text = "Active"
            }
            gpsRepository.queueLocation(update)
        }

        gpsRepository.onSendSuccess = { count ->
            runOnUiThread {
                tvConnectionStatus.text = "Connected"
                tvLastSync.text = java.text.SimpleDateFormat(
                    "HH:mm:ss", java.util.Locale.getDefault()
                ).format(java.util.Date())
            }
        }

        gpsRepository.onSendError = { error ->
            runOnUiThread {
                tvConnectionStatus.text = "Disconnected"
            }
        }

        cameraStreamer.onStreamingStatus = { active ->
            runOnUiThread {
                tvCameraStatus.text = if (active) "Streaming" else "Idle"
            }
        }
    }

    private fun setupClickListeners() {
        switchGps.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                startGpsTracking()
            } else {
                stopGpsTracking()
            }
        }

        switchCamera.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                startCameraStreaming()
            } else {
                stopCameraStreaming()
            }
        }

        findViewById<com.google.android.material.button.MaterialButton>(R.id.btn_select_vehicle)
            .setOnClickListener {
                showVehicleSelector()
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
        Toast.makeText(this, "All permissions granted", Toast.LENGTH_SHORT).show()
    }

    private fun startGpsTracking() {
        if (selectedVehicleId == "unknown") {
            Toast.makeText(this, "Please select a vehicle first", Toast.LENGTH_SHORT).show()
            switchGps.isChecked = false
            return
        }

        try {
            gpsTracker.startTracking()
            gpsRepository.startAutoFlush()
            isGpsActive = true

            val serviceIntent = Intent(this, GpsTrackingService::class.java).apply {
                putExtra(GpsTrackingService.EXTRA_VEHICLE_ID, selectedVehicleId)
                putExtra(GpsTrackingService.EXTRA_TIMEOUT_MINUTES, 30L)
            }
            ContextCompat.startForegroundService(this, serviceIntent)

            Toast.makeText(this, "GPS tracking started", Toast.LENGTH_SHORT).show()
        } catch (e: SecurityException) {
            Toast.makeText(this, "Location permission required", Toast.LENGTH_LONG).show()
            switchGps.isChecked = false
        }
    }

    private fun stopGpsTracking() {
        gpsTracker.stopTracking()
        gpsRepository.stopAutoFlush()
        isGpsActive = false
        tvGpsStatus.text = "Inactive"
        stopService(Intent(this, GpsTrackingService::class.java))
        Toast.makeText(this, "GPS tracking stopped", Toast.LENGTH_SHORT).show()
    }

    private fun startCameraStreaming() {
        if (selectedVehicleId == "unknown") {
            Toast.makeText(this, "Please select a vehicle first", Toast.LENGTH_SHORT).show()
            switchCamera.isChecked = false
            return
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Toast.makeText(this, "Camera permission required", Toast.LENGTH_LONG).show()
            switchCamera.isChecked = false
            return
        }

        isCameraActive = true
        cameraStreamer.startStreaming()
        cameraPreview.start()
        previewView.visibility = android.view.View.VISIBLE

        val serviceIntent = Intent(this, CameraStreamingService::class.java).apply {
            putExtra(CameraStreamingService.EXTRA_VEHICLE_ID, selectedVehicleId)
        }
        ContextCompat.startForegroundService(this, serviceIntent)

        Toast.makeText(this, "Camera streaming started", Toast.LENGTH_SHORT).show()
    }

    private fun stopCameraStreaming() {
        cameraStreamer.stopStreaming()
        cameraPreview.stop()
        isCameraActive = false
        previewView.visibility = android.view.View.GONE
        tvCameraStatus.text = "Idle"
        stopService(Intent(this, CameraStreamingService::class.java))
        Toast.makeText(this, "Camera streaming stopped", Toast.LENGTH_SHORT).show()
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

                if (isGpsActive) {
                    stopGpsTracking()
                }
                if (isCameraActive) {
                    stopCameraStreaming()
                }

                Toast.makeText(this, "Selected: ${vehicle.plateNumber}", Toast.LENGTH_SHORT).show()
            }
            .show()
    }

    override fun onDestroy() {
        if (isGpsActive) stopGpsTracking()
        if (isCameraActive) stopCameraStreaming()
        super.onDestroy()
    }
}
