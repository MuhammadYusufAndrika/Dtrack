package com.fleetvisionai.models

import com.google.gson.annotations.SerializedName

data class DriverInfo(
    val id: Int,
    val name: String,
    val email: String,

    @SerializedName("vehicle_id")
    val vehicleId: Int?,

    val phone: String?,

    @SerializedName("license_number")
    val licenseNumber: String?,

    val status: String?
)
