package com.fleetvisionai.api

import com.fleetvisionai.models.ApiResponse
import com.fleetvisionai.models.DriverInfo
import com.fleetvisionai.models.GpsData
import com.fleetvisionai.models.TripInfo
import com.fleetvisionai.models.VehicleInfo
import okhttp3.MultipartBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path

interface ApiService {

    @POST("api/location")
    suspend fun sendLocation(@Body gpsData: GpsData): ApiResponse<Any>

    @POST("api/location/batch")
    suspend fun sendLocationBatch(@Body locations: List<GpsData>): ApiResponse<Any>

    @POST("api/auth/login")
    suspend fun login(@Body credentials: Map<String, String>): ApiResponse<Map<String, String>>

    @GET("api/auth/me")
    suspend fun getMe(): ApiResponse<Map<String, Any>>

    @GET("api/vehicles")
    suspend fun getVehicles(): ApiResponse<List<VehicleInfo>>

    @GET("api/vehicles/{id}")
    suspend fun getVehicle(@Path("id") id: Int): ApiResponse<VehicleInfo>

    @GET("api/drivers")
    suspend fun getDrivers(): ApiResponse<List<DriverInfo>>

    @POST("api/trips")
    suspend fun createTrip(@Body body: Map<String, Any>): ApiResponse<TripInfo>

    @PATCH("api/trips/{id}")
    suspend fun updateTrip(@Path("id") id: Int, @Body body: Map<String, Any>): ApiResponse<TripInfo>

    @GET("api/trips/{id}")
    suspend fun getTrip(@Path("id") id: Int): ApiResponse<TripInfo>

    @Multipart
    @POST("api/inference")
    suspend fun sendFrame(
        @Part image: MultipartBody.Part,
        @Part("vehicle_id") vehicleId: okhttp3.RequestBody
    ): ApiResponse<Any>
}
