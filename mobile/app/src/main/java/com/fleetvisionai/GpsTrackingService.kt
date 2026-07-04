package com.fleetvisionai

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.fleetvisionai.gps.GpsRepository
import com.fleetvisionai.gps.GpsTracker
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import java.util.concurrent.TimeUnit

class GpsTrackingService : Service() {

    companion object {
        const val EXTRA_VEHICLE_ID = "extra_vehicle_id"
        const val EXTRA_TIMEOUT_MINUTES = "extra_timeout_minutes"
        private const val TAG = "GpsTrackingService"
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var gpsTracker: GpsTracker
    private lateinit var gpsRepository: GpsRepository
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var vehicleId: String = "unknown"
    private var timeoutMinutes: Long = 30

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        NotificationHelper.createChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        vehicleId = intent?.getStringExtra(EXTRA_VEHICLE_ID) ?: "unknown"
        timeoutMinutes = intent?.getLongExtra(EXTRA_TIMEOUT_MINUTES, 30) ?: 30

        val notification = NotificationHelper.buildGpsNotification(this)
        startForeground(NotificationHelper.NOTIFICATION_ID_GPS, notification)

        gpsTracker = GpsTracker(fusedLocationClient)
        gpsRepository = GpsRepository(vehicleId, serviceScope)

        gpsRepository.onSendError = { error ->
            Log.e(TAG, "Location send error", error)
        }

        gpsTracker.onLocationUpdate = { update ->
            gpsRepository.queueLocation(update)
        }

        try {
            gpsTracker.startTracking()
            gpsRepository.startAutoFlush()
            Log.i(TAG, "GPS tracking started for vehicle: $vehicleId")
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission missing", e)
            stopSelf()
            return START_NOT_STICKY
        }

        scheduleAutoStop()

        return START_STICKY
    }

    private fun scheduleAutoStop() {
        val handler = android.os.Handler(mainLooper)
        handler.postDelayed({
            Log.i(TAG, "Auto-stopping GPS tracking after $timeoutMinutes minutes")
            stopSelf()
        }, TimeUnit.MINUTES.toMillis(timeoutMinutes))
    }

    override fun onDestroy() {
        gpsTracker.stopTracking()
        gpsRepository.stopAutoFlush()
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
