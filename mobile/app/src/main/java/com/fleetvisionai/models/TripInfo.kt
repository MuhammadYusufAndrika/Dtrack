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
    val totalDistanceKm: Double?,

    val origin: String?,

    val destination: String?,

    @SerializedName("planned_distance_km")
    val plannedDistanceKm: Double?,

    @SerializedName("distance_km")
    val distanceKm: Double?
)

// Samakan backend: GET /api/trips/{id} -> data: { trip, session, path, ... }
data class TripDetailResponse(
    val trip: TripInfo?
)
