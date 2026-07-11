package com.fleetvisionai.models

import com.google.gson.annotations.SerializedName

data class TripInfo(
    val id: Int,

    @SerializedName("vehicle_id")
    val vehicleId: Int,

    @SerializedName("driver_id")
    val driverId: Int,

    val status: String,

    @SerializedName("start_time")
    val startTime: String?,

    @SerializedName("end_time")
    val endTime: String?,

    @SerializedName("start_latitude")
    val startLatitude: Double?,

    @SerializedName("start_longitude")
    val startLongitude: Double?,

    @SerializedName("end_latitude")
    val endLatitude: Double?,

    @SerializedName("end_longitude")
    val endLongitude: Double?,

    @SerializedName("total_distance_km")
    val totalDistanceKm: Double?
)
