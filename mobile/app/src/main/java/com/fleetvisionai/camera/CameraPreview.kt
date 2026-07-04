package com.fleetvisionai.camera

import android.Manifest
import android.content.pm.PackageManager
import android.util.Log
import android.view.View
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.common.util.concurrent.ListenableFuture
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CameraPreview(
    private val previewView: PreviewView,
    private val lifecycleOwner: LifecycleOwner
) {
    private var cameraProviderFuture: ListenableFuture<ProcessCameraProvider>? = null
    private var camera: Camera? = null
    private var cameraProvider: ProcessCameraProvider? = null
    private val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var isBound = false

    var cameraStreamer: CameraStreamer? = null

    fun start() {
        if (isBound) return

        val context = previewView.context
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w("CameraPreview", "Camera permission not granted")
            return
        }

        cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture?.addListener({
            try {
                cameraProvider = cameraProviderFuture?.get()
                bindCamera()
            } catch (e: Exception) {
                Log.e("CameraPreview", "Camera provider failed", e)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    private fun bindCamera() {
        val provider = cameraProvider ?: return

        val preview = Preview.Builder()
            .build()
            .also {
                it.surfaceProvider = previewView.surfaceProvider
            }

        val cameraSelector = CameraSelector.Builder()
            .requireLensFacing(CameraSelector.LENS_FACING_FRONT)
            .build()

        val useCases = mutableListOf(preview)

        val streamer = cameraStreamer
        if (streamer != null) {
            useCases.add(streamer.imageAnalyzer)
        }

        try {
            provider.unbindAll()
            camera = provider.bindToLifecycle(
                lifecycleOwner,
                cameraSelector,
                *useCases.toTypedArray()
            )
            isBound = true
        } catch (e: Exception) {
            Log.e("CameraPreview", "Failed to bind camera", e)
        }
    }

    fun stop() {
        cameraProvider?.unbindAll()
        isBound = false
        camera = null
        cameraExecutor.shutdown()
    }
}
