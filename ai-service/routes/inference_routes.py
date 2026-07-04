import base64
import cv2
import numpy as np
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, UploadFile, File, WebSocket, WebSocketDisconnect, Depends
from fastapi.responses import JSONResponse

from models.inference_result import InferenceResult
from utils.logger import setup_logger

logger = setup_logger(__name__)

router = APIRouter(prefix="/inference", tags=["Inference"])

# These will be set by the app on startup
detection_service = None
stream_service = None
start_time = datetime.utcnow()


def set_services(ds, ss=None):
    """Dependency injection: set service instances from the main app."""
    global detection_service, stream_service
    detection_service = ds
    stream_service = ss


@router.post("")
async def run_inference(file: UploadFile = File(...)) -> JSONResponse:
    """
    Accept an image upload and run all AI detectors on it.

    The image is decoded from the uploaded file, processed through the
    detection pipeline, and the complete InferenceResult is returned as JSON.

    Args:
        file: Uploaded image file (jpg, png, etc.)

    Returns:
        JSON with inference results
    """
    if detection_service is None:
        return JSONResponse(
            status_code=503,
            content={"error": "Detection service not initialized"},
        )

    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None or frame.size == 0:
            return JSONResponse(
                status_code=400,
                content={"error": "Could not decode image"},
            )

        result = detection_service.process_frame(frame)
        return JSONResponse(
            content=result.model_dump(mode="json"),
            status_code=200,
        )

    except Exception as e:
        logger.error(f"Inference error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)},
        )


@router.get("/health")
async def health_check() -> JSONResponse:
    """
    Health check endpoint.

    Returns service status including uptime, detector availability,
    and communication stats.

    Returns:
        JSON with health status
    """
    uptime = (datetime.utcnow() - start_time).total_seconds()
    return JSONResponse(content={
        "status": "healthy" if detection_service is not None else "degraded",
        "service": "FleetVision AI Service",
        "version": "1.0.0",
        "uptime_seconds": uptime,
        "detectors_loaded": (
            list(detection_service.detectors.keys())
            if detection_service
            else []
        ),
        "timestamp": datetime.utcnow().isoformat(),
    })


@router.websocket("/stream")
async def inference_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for streaming real-time inference results.

    Accepts base64-encoded JPEG frames sent by the client, runs them
    through the detection pipeline, and returns JSON results.

    Message format (client -> server):
        { "frame": "<base64_encoded_jpeg>" }

    Response format (server -> client):
        { "result": { ... InferenceResult fields ... } }
    """
    await websocket.accept()
    logger.info("WebSocket client connected")

    if detection_service is None:
        await websocket.send_json({"error": "Detection service not initialized"})
        await websocket.close()
        return

    try:
        while True:
            data = await websocket.receive_json()
            frame_b64 = data.get("frame", "")

            if not frame_b64:
                await websocket.send_json({"error": "No frame data"})
                continue

            try:
                frame_bytes = base64.b64decode(frame_b64)
                nparr = np.frombuffer(frame_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                if frame is None:
                    await websocket.send_json({"error": "Invalid frame data"})
                    continue

                result = detection_service.process_frame(frame)
                await websocket.send_json({
                    "result": result.model_dump(mode="json"),
                })

            except Exception as e:
                logger.error(f"WebSocket frame processing error: {e}")
                await websocket.send_json({"error": str(e)})

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@router.get("/status")
async def service_status() -> JSONResponse:
    """
    Get comprehensive service status including uptime, loaded models,
    and communication statistics.

    Returns:
        JSON with detailed service status
    """
    uptime = (datetime.utcnow() - start_time).total_seconds()
    stream_props = {}
    if stream_service is not None:
        try:
            stream_props = stream_service.get_properties()
        except Exception:
            pass

    return JSONResponse(content={
        "service": "FleetVision AI Service",
        "version": "1.0.0",
        "uptime_seconds": uptime,
        "uptime_human": f"{int(uptime // 3600)}h {int((uptime % 3600) // 60)}m {int(uptime % 60)}s",
        "detectors_loaded": (
            list(detection_service.detectors.keys())
            if detection_service
            else []
        ),
        "stream": stream_props,
        "vehicle_id": (
            detection_service._empty_result().vehicle_id
            if detection_service
            else "unknown"
        ),
        "timestamp": datetime.utcnow().isoformat(),
    })
