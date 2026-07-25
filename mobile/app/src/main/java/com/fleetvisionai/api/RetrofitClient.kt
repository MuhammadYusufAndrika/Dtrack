package com.fleetvisionai.api

import com.fleetvisionai.BuildConfig
import com.fleetvisionai.FleetVisionApp
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {

    private var authToken: String? = null

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) {
            HttpLoggingInterceptor.Level.BODY
        } else {
            HttpLoggingInterceptor.Level.NONE
        }
    }

    private val authInterceptor = Interceptor { chain ->
        val original = chain.request()
        val token = authToken
        val request = if (!token.isNullOrEmpty()) {
            original.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            original
        }
        chain.proceed(request)
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    val apiService: ApiService = retrofit.create(ApiService::class.java)

    private val aiOkHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    private val aiRetrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.INFERENCE_URL)
        .client(aiOkHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    val aiApiService: AiApiService = aiRetrofit.create(AiApiService::class.java)

    fun setAuthToken(token: String?) {
        authToken = token
        FleetVisionApp.preferences.edit()
            .putString("auth_token", token)
            .apply()
    }

    fun getAuthToken(): String? {
        if (authToken == null) {
            authToken = FleetVisionApp.preferences.getString("auth_token", null)
        }
        return authToken
    }

    fun clearAuthToken() {
        authToken = null
        FleetVisionApp.preferences.edit()
            .remove("auth_token")
            .apply()
    }
}
