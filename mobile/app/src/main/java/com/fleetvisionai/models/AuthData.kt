package com.fleetvisionai.models

// Samakan dengan backend: POST /api/auth/login -> data: { user: {...}, token: "..." }
data class UserInfo(
    val id: Int,
    val name: String?,
    val email: String?,
    val role: String?
)

data class AuthData(
    val user: UserInfo?,
    val token: String?
)
