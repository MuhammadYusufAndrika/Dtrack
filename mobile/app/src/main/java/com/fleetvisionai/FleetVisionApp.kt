package com.fleetvisionai

import android.app.Application
import android.content.SharedPreferences

class FleetVisionApp : Application() {

    override fun onCreate() {
        super.onCreate()
        instance = this
        preferences = getSharedPreferences("fleetvision_prefs", MODE_PRIVATE)
        NotificationHelper.createChannels(this)
    }

    fun saveActiveTrip(tripId: Int, vehicleId: String, driverId: Int) {
        preferences.edit()
            .putInt(KEY_TRIP_ID, tripId)
            .putString(KEY_VEHICLE_ID, vehicleId)
            .putInt(KEY_DRIVER_ID, driverId)
            .putLong(KEY_TRIP_START_TIME, System.currentTimeMillis())
            .apply()
    }

    fun clearActiveTrip() {
        preferences.edit()
            .remove(KEY_TRIP_ID)
            .remove(KEY_VEHICLE_ID)
            .remove(KEY_DRIVER_ID)
            .remove(KEY_TRIP_START_TIME)
            .apply()
    }

    fun getActiveTripId(): Int? {
        val id = preferences.getInt(KEY_TRIP_ID, -1)
        return if (id != -1) id else null
    }

    fun getActiveVehicleId(): String? = preferences.getString(KEY_VEHICLE_ID, null)

    fun getActiveDriverId(): Int? {
        val id = preferences.getInt(KEY_DRIVER_ID, -1)
        return if (id != -1) id else null
    }

    fun getTripStartTime(): Long = preferences.getLong(KEY_TRIP_START_TIME, 0L)

    fun isLoggedIn(): Boolean = !getAuthToken().isNullOrEmpty()

    fun getAuthToken(): String? = preferences.getString("auth_token", null)

    fun getUserEmail(): String? = preferences.getString("user_email", null)

    fun logout() {
        preferences.edit().clear().apply()
    }

    companion object {
        lateinit var instance: FleetVisionApp
            private set
        lateinit var preferences: SharedPreferences
            private set

        private const val KEY_TRIP_ID = "active_trip_id"
        private const val KEY_VEHICLE_ID = "active_vehicle_id"
        private const val KEY_DRIVER_ID = "active_driver_id"
        private const val KEY_TRIP_START_TIME = "active_trip_start_time"
    }
}
