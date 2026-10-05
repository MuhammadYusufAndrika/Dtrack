package com.fleetvisionai.api

import com.fleetvisionai.models.ApiResponse
import com.fleetvisionai.models.AlertInfo
import com.fleetvisionai.models.AuthData
import com.fleetvisionai.models.ChatBody
import com.fleetvisionai.models.ChatMessage
import com.fleetvisionai.models.DriverInfo
import com.fleetvisionai.models.GpsData
import com.fleetvisionai.models.LoginBody
import com.fleetvisionai.models.TripCreateBody
import com.fleetvisionai.models.TripDetailResponse
import com.fleetvisionai.models.TripInfo
import com.fleetvisionai.models.TripUpdateBody
import com.fleetvisionai.models.VehicleInfo
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {

    @POST("location")
    suspend fun sendLocation(@Body gpsData: GpsData): ApiResponse<Any>

    @POST("location/batch")
    suspend fun sendLocationBatch(@Body locations: List<GpsData>): ApiResponse<Any>

    @POST("auth/login")
    suspend fun login(@Body credentials: LoginBody): ApiResponse<AuthData>

    @GET("auth/me")
    suspend fun getMe(): ApiResponse<Map<String, Any>>

    @GET("vehicles")
    suspend fun getVehicles(): ApiResponse<List<VehicleInfo>>

    @GET("vehicles/{id}")
    suspend fun getVehicle(@Path("id") id: Int): ApiResponse<VehicleInfo>

    @GET("drivers")
    suspend fun getDrivers(): ApiResponse<List<DriverInfo>>

    @POST("trips")
    suspend fun createTrip(@Body body: TripCreateBody): ApiResponse<TripInfo>

    @GET("trips")
    suspend fun getTrips(): ApiResponse<List<TripInfo>>

    @PATCH("trips/{id}")
    suspend fun updateTrip(@Path("id") id: Int, @Body body: TripUpdateBody): ApiResponse<TripInfo>

    @GET("trips/{id}")
    suspend fun getTrip(@Path("id") id: Int): ApiResponse<TripDetailResponse>

    @GET("alerts")
    suspend fun getAlerts(): ApiResponse<List<AlertInfo>>

    @PATCH("alerts/{id}/read")
    suspend fun markAlertRead(@Path("id") id: Int): ApiResponse<AlertInfo>

    @GET("chat")
    suspend fun getChat(): ApiResponse<List<ChatMessage>>

    @POST("chat")
    suspend fun sendChat(@Body body: ChatBody): ApiResponse<ChatMessage>

    @DELETE("chat/{id}")
    suspend fun deleteChat(@Path("id") id: Int): ApiResponse<Any>

    @DELETE("chat/thread")
    suspend fun clearChat(): ApiResponse<Any>

    @PATCH("chat/read")
    suspend fun markChatRead(): ApiResponse<Any>

    @POST("auth/logout")
    suspend fun logout(): ApiResponse<Any>

}
