package com.fleetvisionai.models

import com.google.gson.annotations.SerializedName

data class AlertInfo(
    val id: Int,
    val type: String?,
    val severity: String?,
    val message: String?,

    @SerializedName("driver_id")
    val driverId: Int?,

    @SerializedName("is_read")
    val isRead: Boolean?,

    @SerializedName("created_at")
    val createdAt: String?
)
