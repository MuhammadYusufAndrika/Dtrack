package com.fleetvisionai.models

import com.google.gson.annotations.SerializedName

data class ChatMessage(
    val id: Int,

    @SerializedName("driver_id")
    val driverId: Int?,

    @SerializedName("sender_role")
    val senderRole: String?,

    val body: String?,

    @SerializedName("is_read")
    val isRead: Boolean?,

    @SerializedName("created_at")
    val createdAt: String?
)
