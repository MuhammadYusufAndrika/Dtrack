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

    companion object {
        lateinit var instance: FleetVisionApp
            private set
        lateinit var preferences: SharedPreferences
            private set
    }
}
