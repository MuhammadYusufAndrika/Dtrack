package com.fleetvisionai.models

import com.google.gson.annotations.SerializedName

data class GpsData(
    // WAJIB id integer DB (vehicles.id), bukan kode "TRK001" — backend menolak string (422).
    @SerializedName("vehicle_id")
    val vehicleId: Int,

    val latitude: Double,

    val longitude: Double,

    val speed: Float,

    val heading: Float,

    val accuracy: Float,

    val timestamp: String
)
