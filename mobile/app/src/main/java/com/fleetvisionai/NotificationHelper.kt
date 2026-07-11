package com.fleetvisionai

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat

object NotificationHelper {

    private const val CHANNEL_GPS = "fleetvision_gps"
    private const val CHANNEL_CAMERA = "fleetvision_camera"
    private const val CHANNEL_TRIP = "fleetvision_trip"
    private const val CHANNEL_GENERAL = "fleetvision_general"

    const val NOTIFICATION_ID_GPS = 1001
    const val NOTIFICATION_ID_CAMERA = 1002
    const val NOTIFICATION_ID_TRIP = 1003

    fun createChannels(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val gpsChannel = NotificationChannel(
            CHANNEL_GPS,
            "GPS Tracking",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shows when GPS tracking is active"
            setShowBadge(false)
        }

        val cameraChannel = NotificationChannel(
            CHANNEL_CAMERA,
            "Camera Streaming",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shows when camera streaming is active"
            setShowBadge(false)
        }

        val tripChannel = NotificationChannel(
            CHANNEL_TRIP,
            "Trip Status",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shows when a trip is in progress"
            setShowBadge(false)
        }

        val generalChannel = NotificationChannel(
            CHANNEL_GENERAL,
            "FleetVision AI",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "General notifications"
        }

        manager.createNotificationChannel(gpsChannel)
        manager.createNotificationChannel(cameraChannel)
        manager.createNotificationChannel(tripChannel)
        manager.createNotificationChannel(generalChannel)
    }

    fun buildGpsNotification(context: Context): Notification {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(context, CHANNEL_GPS)
            .setContentTitle("FleetVision AI")
            .setContentText("GPS tracking active")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    fun buildCameraNotification(context: Context): Notification {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(context, CHANNEL_CAMERA)
            .setContentTitle("FleetVision AI")
            .setContentText("Camera streaming active")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    fun buildTripNotification(context: Context, duration: String = ""): Notification {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val text = if (duration.isNotEmpty()) {
            "Trip in progress — $duration"
        } else {
            "Trip in progress"
        }

        return NotificationCompat.Builder(context, CHANNEL_TRIP)
            .setContentTitle("FleetVision AI")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_recent_history)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}
