package com.fleetvisionai.gps

import android.location.Location
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.Priority
import java.time.Instant

class GpsTracker(
    private val fusedLocationClient: FusedLocationProviderClient
) {
    private var locationCallback: LocationCallback? = null
    private var isTracking = false

    var onLocationUpdate: ((GpsUpdate) -> Unit)? = null

    data class GpsUpdate(
        val latitude: Double,
        val longitude: Double,
        val speedKmh: Float,
        val bearing: Float,
        val accuracy: Float,
        val timestamp: String
    )

    fun startTracking() {
        if (isTracking) return
        isTracking = true

        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            3000L
        ).apply {
            setMinUpdateIntervalMillis(3000L)
            setMaxUpdateDelayMillis(5000L)
            setMinUpdateDistanceMeters(5f)
        }.build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                val location = locationResult.lastLocation ?: return
                val update = toGpsUpdate(location)
                onLocationUpdate?.invoke(update)
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback!!,
                null
            )
        } catch (e: SecurityException) {
            isTracking = false
            throw e
        }
    }

    fun stopTracking() {
        if (!isTracking) return
        locationCallback?.let {
            fusedLocationClient.removeLocationUpdates(it)
        }
        locationCallback = null
        isTracking = false
    }

    private fun toGpsUpdate(location: Location): GpsUpdate {
        val speedKmh = if (location.hasSpeed()) {
            location.speed * 3.6f
        } else {
            0f
        }

        return GpsUpdate(
            latitude = location.latitude,
            longitude = location.longitude,
            speedKmh = speedKmh,
            bearing = if (location.hasBearing()) location.bearing else 0f,
            accuracy = if (location.hasAccuracy()) location.accuracy else 0f,
            timestamp = Instant.now().toString()
        )
    }

    fun isTrackingActive(): Boolean = isTracking
}
