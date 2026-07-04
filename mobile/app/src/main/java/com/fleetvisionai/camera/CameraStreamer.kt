package com.fleetvisionai.camera

import android.content.ContentResolver
import android.content.Context
import android.graphics.Bitmap
import android.graphics.ImageFormat
import android.graphics.YuvImage
import android.net.Uri
import android.util.Log
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.fleetvisionai.BuildConfig
import com.fleetvisionai.api.RetrofitClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer

class CameraStreamer(
    private val context: Context,
    private val vehicleId: String,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO)
) {
    private var streamingJob: Job? = null
    private var isStreaming = false
    private var frameIntervalMs = 2000L
    private var latestBitmap: Bitmap? = null

    var onStreamingStatus: ((Boolean) -> Unit)? = null
    var onFrameSent: ((Boolean) -> Unit)? = null
    var onError: ((Exception) -> Unit)? = null

    val imageAnalyzer: ImageAnalysis by lazy {
        ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
            .also { analysis ->
                analysis.setAnalyzer({ it }, FrameAnalyzer())
            }
    }

    fun setFrameInterval(intervalMs: Long) {
        frameIntervalMs = intervalMs
    }

    fun startStreaming() {
        if (isStreaming) return
        isStreaming = true
        onStreamingStatus?.invoke(true)

        streamingJob = scope.launch {
            while (isActive && isStreaming) {
                val bitmap = synchronized(this@CameraStreamer) { latestBitmap }
                if (bitmap != null) {
                    sendFrame(bitmap)
                }
                delay(frameIntervalMs)
            }
        }
    }

    fun stopStreaming() {
        isStreaming = false
        streamingJob?.cancel()
        streamingJob = null
        onStreamingStatus?.invoke(false)
    }

    private suspend fun sendFrame(bitmap: Bitmap) {
        try {
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 80, stream)
            val imageData = stream.toByteArray()

            val requestBody = imageData.toRequestBody("image/jpeg".toMediaTypeOrNull())
            val imagePart = MultipartBody.Part.createFormData("image", "frame.jpg", requestBody)
            val vehicleIdPart = vehicleId.toRequestBody("text/plain".toMediaTypeOrNull())

            val response = RetrofitClient.apiService.sendFrame(imagePart, vehicleIdPart)
            onFrameSent?.invoke(response.success)
        } catch (e: Exception) {
            Log.e("CameraStreamer", "Failed to send frame", e)
            onError?.invoke(e)
            onFrameSent?.invoke(false)
        }
    }

    fun isStreamingActive(): Boolean = isStreaming

    @ExperimentalGetImage
    private inner class FrameAnalyzer : ImageAnalysis.Analyzer {
        override fun analyze(imageProxy: ImageProxy) {
            val bitmap = imageProxyToBitmap(imageProxy) ?: return
            synchronized(this@CameraStreamer) {
                latestBitmap = bitmap
            }
            imageProxy.close()
        }

        private fun imageProxyToBitmap(imageProxy: ImageProxy): Bitmap? {
            return try {
                val buffer: ByteBuffer? = imageProxy.planes[0].buffer
                val bytes = ByteArray(buffer?.remaining() ?: return null)
                buffer!!.get(bytes)

                val yuvImage = YuvImage(bytes, ImageFormat.NV21,
                    imageProxy.width, imageProxy.height, null)
                val out = ByteArrayOutputStream()
                yuvImage.compressToJpeg(
                    android.graphics.Rect(0, 0, imageProxy.width, imageProxy.height),
                    80, out
                )
                val jpegData = out.toByteArray()
                android.graphics.BitmapFactory.decodeByteArray(jpegData, 0, jpegData.size)
            } catch (e: Exception) {
                Log.e("FrameAnalyzer", "Bitmap conversion failed", e)
                null
            }
        }
    }
}
