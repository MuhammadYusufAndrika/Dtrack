package com.fleetvisionai

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import com.fleetvisionai.camera.CameraStreamer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

class CameraStreamingService : Service() {

    companion object {
        const val EXTRA_VEHICLE_ID = "extra_vehicle_id"
        private const val TAG = "CameraStreamingService"
    }

    private var cameraStreamer: CameraStreamer? = null
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var vehicleId: String = "unknown"

    override fun onCreate() {
        super.onCreate()
        NotificationHelper.createChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        vehicleId = intent?.getStringExtra(EXTRA_VEHICLE_ID) ?: "unknown"

        val notification = NotificationHelper.buildCameraNotification(this)
        startForeground(NotificationHelper.NOTIFICATION_ID_CAMERA, notification)

        cameraStreamer = CameraStreamer(this, vehicleId, serviceScope).apply {
            onStreamingStatus = { isActive ->
                Log.i(TAG, "Camera streaming active: $isActive")
            }
            onError = { error ->
                Log.e(TAG, "Camera streaming error", error)
            }
            startStreaming()
        }

        Log.i(TAG, "Camera streaming started for vehicle: $vehicleId")
        return START_STICKY
    }

    override fun onDestroy() {
        cameraStreamer?.stopStreaming()
        cameraStreamer = null
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
