package com.fleetvisionai.models

import com.google.gson.annotations.SerializedName

data class GpsData(
    @SerializedName("vehicle_id")
    val vehicleId: String,

    val latitude: Double,

    val longitude: Double,

    val speed: Float,

    val heading: Float,

    val accuracy: Float,

    val timestamp: String
)
