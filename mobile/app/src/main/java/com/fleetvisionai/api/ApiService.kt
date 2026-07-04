package com.fleetvisionai.api

import com.fleetvisionai.models.ApiResponse
import com.fleetvisionai.models.GpsData
import com.fleetvisionai.models.VehicleInfo
import okhttp3.MultipartBody
import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
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

    @GET("api/vehicles")
    suspend fun getVehicles(): ApiResponse<List<VehicleInfo>>

    @GET("api/vehicles/{id}")
    suspend fun getVehicle(@Path("id") id: Int): ApiResponse<VehicleInfo>

    @Multipart
    @POST("api/inference")
    suspend fun sendFrame(
        @Part image: MultipartBody.Part,
        @Part("vehicle_id") vehicleId: okhttp3.RequestBody
    ): ApiResponse<Any>
}
