package com.fleetvisionai.models

import com.google.gson.annotations.SerializedName

// Body typed (bukan Map) agar Retrofit/Gson stabil di semua HP.

data class LoginBody(
    val email: String,
    val password: String
)

data class TripCreateBody(
    @SerializedName("vehicle_id")
    val vehicleId: Int,

    @SerializedName("driver_id")
    val driverId: Int,

    @SerializedName("start_latitude")
    val startLatitude: Double?,

    @SerializedName("start_longitude")
    val startLongitude: Double?
)

data class TripUpdateBody(
    val action: String,

    @SerializedName("start_latitude")
    val startLatitude: Double? = null,

    @SerializedName("start_longitude")
    val startLongitude: Double? = null,

    @SerializedName("end_latitude")
    val endLatitude: Double? = null,

    @SerializedName("end_longitude")
    val endLongitude: Double? = null,

    @SerializedName("total_distance_km")
    val totalDistanceKm: Double? = null
)

data class ChatBody(
    val body: String
)
