package com.fleetvisionai.gps

import com.fleetvisionai.api.RetrofitClient
import com.fleetvisionai.models.GpsData
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.LinkedList
import java.util.Queue

class GpsRepository(
    private val vehicleId: String,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO)
) {
    private val buffer: Queue<GpsData> = LinkedList()
    private val failedQueue: Queue<GpsData> = LinkedList()
    private var flushJob: Job? = null
    private var isRunning = false
    private val api = RetrofitClient.apiService

    var onSendError: ((Throwable) -> Unit)? = null
    var onSendSuccess: ((Int) -> Unit)? = null

    fun startAutoFlush() {
        if (isRunning) return
        isRunning = true
        flushJob = scope.launch {
            while (isActive && isRunning) {
                delay(5000L)
                flushBuffer()
                retryFailed()
            }
        }
    }

    fun stopAutoFlush() {
        isRunning = false
        flushJob?.cancel()
        flushJob = null
    }

    fun queueLocation(update: GpsTracker.GpsUpdate) {
        val gpsData = GpsData(
            vehicleId = vehicleId,
            latitude = update.latitude,
            longitude = update.longitude,
            speed = update.speedKmh,
            heading = update.bearing,
            accuracy = update.accuracy,
            timestamp = update.timestamp
        )
        synchronized(buffer) {
            buffer.offer(gpsData)
        }
    }

    suspend fun sendLocation(gpsData: GpsData): Result<Unit> {
        return try {
            val response = api.sendLocation(gpsData)
            if (response.success) {
                onSendSuccess?.invoke(1)
                Result.success(Unit)
            } else {
                Result.failure(Exception("API error: ${response.message}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun flushBuffer() {
        val batch = mutableListOf<GpsData>()
        synchronized(buffer) {
            while (buffer.isNotEmpty()) {
                batch.add(buffer.poll())
            }
        }
        if (batch.isEmpty()) return

        try {
            val response = api.sendLocationBatch(batch)
            if (response.success) {
                onSendSuccess?.invoke(batch.size)
            } else {
                synchronized(failedQueue) {
                    failedQueue.addAll(batch)
                }
                onSendError?.invoke(Exception("Batch send failed: ${response.message}"))
            }
        } catch (e: Exception) {
            synchronized(failedQueue) {
                failedQueue.addAll(batch)
            }
            onSendError?.invoke(e)
        }
    }

    private suspend fun retryFailed() {
        val retryBatch = mutableListOf<GpsData>()
        synchronized(failedQueue) {
            while (failedQueue.isNotEmpty()) {
                retryBatch.add(failedQueue.poll())
            }
        }
        if (retryBatch.isEmpty()) return

        try {
            val response = api.sendLocationBatch(retryBatch)
            if (response.success) {
                onSendSuccess?.invoke(retryBatch.size)
            } else {
                synchronized(failedQueue) {
                    failedQueue.addAll(retryBatch)
                }
            }
        } catch (e: Exception) {
            synchronized(failedQueue) {
                failedQueue.addAll(retryBatch)
            }
            onSendError?.invoke(e)
        }
    }

    fun getBufferedCount(): Int {
        return synchronized(buffer) { buffer.size } +
                synchronized(failedQueue) { failedQueue.size }
    }
}
