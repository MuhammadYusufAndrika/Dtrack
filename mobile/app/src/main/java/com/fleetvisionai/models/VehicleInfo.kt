package com.fleetvisionai.models

import com.google.gson.annotations.SerializedName

data class VehicleInfo(
    val id: Int,

    @SerializedName("vehicle_id")
    val vehicleId: String,

    @SerializedName("plate_number")
    val plateNumber: String
)
