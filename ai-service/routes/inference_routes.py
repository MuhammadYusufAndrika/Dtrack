import asyncio
import base64
import json
import cv2
import numpy as np
import threading
from datetime import datetime
from typing import Optional, Dict

from fastapi import APIRouter, UploadFile, File, WebSocket, WebSocketDisconnect, Depends
from fastapi.responses import JSONResponse, StreamingResponse

from models.inference_result import InferenceResult
from utils.logger import setup_logger

logger = setup_logger(__name__)

router = APIRouter(prefix="/inference", tags=["Inference"])

# These will be set by the app on startup
detection_service = None
stream_service = None
start_time = datetime.utcnow()

# Frame storage: { vehicle_id: { "frame": jpeg_bytes, "timestamp": datetime, "result": dict } }
_frame_store: Dict[str, dict] = {}
_frame_lock = threading.Lock()


def set_services(ds, ss=None):
    """Dependency injection: set service instances from the main app."""
    global detection_service, stream_service
    detection_service = ds
    stream_service = ss


def _encode_frame(frame: np.ndarray, quality: int = 75, max_width: int = 640):
    """Encode frame to JPEG bytes. Downscale jika terlalu besar biar hemat bandwidth hosting."""
    try:
        h, w = frame.shape[:2]
        if w > max_width:
            scale = max_width / float(w)
            frame = cv2.resize(frame, (max_width, int(h * scale)), interpolation=cv2.INTER_AREA)
        ok, jpeg_buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
        if not ok:
            return None
        return jpeg_buffer.tobytes()
    except Exception:
        return None


def _store_frame(vehicle_id: str, frame: np.ndarray, result=None):
    """Store the latest frame for a vehicle as JPEG bytes."""
    try:
        jpeg_bytes = _encode_frame(frame)
        if jpeg_bytes is None:
            return
        with _frame_lock:
            prev = _frame_store.get(vehicle_id)
            _frame_store[vehicle_id] = {
                "frame": jpeg_bytes,
                # Kalau result None, pertahankan hasil AI sebelumnya biar admin tidak kedip No Data
                "timestamp": datetime.utcnow(),
                "result": result.model_dump(mode="json") if result else (prev.get("result") if prev else None),
            }
    except Exception as e:
        logger.error(f"Failed to store frame for {vehicle_id}: {e}")


def _store_frame_fast(vehicle_id: str, frame: np.ndarray):
    """Simpan frame mentah SEGERA sebelum inference (decouple display FPS dari AI latency)."""
    _store_frame(vehicle_id, frame, result=None)


def _update_result(vehicle_id: str, result):
    """Update hasil AI tanpa re-encode JPEG (hemat CPU)."""
    try:
        with _frame_lock:
            entry = _frame_store.get(vehicle_id)
            if entry is None:
                return
            entry["result"] = result.model_dump(mode="json") if result else entry.get("result")
    except Exception as e:
        logger.error(f"Failed to update result for {vehicle_id}: {e}")


@router.post("")
async def run_inference(file: UploadFile = File(...), vehicle_id: str = "") -> JSONResponse:
    """
    Accept an image upload and run all AI detectors on it.
    Stores the frame for admin live view.
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

        # Simpan duluan biar admin langsung lihat frame baru (tidak nunggu YOLO/MediaPipe)
        if vehicle_id:
            _store_frame_fast(vehicle_id, frame)

        result = detection_service.process_frame(frame)

        if vehicle_id:
            _update_result(vehicle_id, result)

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
    """Health check endpoint."""
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

    Accepts JSON messages with base64-encoded JPEG frames.
    Stores frames for admin live view.

    Message format: { "frame": "<base64>", "vehicle_id": "<id>" }
    Response format: { "result": { ... } }
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
            # Drain: driver kirim tiap 500ms tapi inference (YOLO+MediaPipe) butuh
            # ~1 detik di CPU — tanpa ini antrean WS tumbuh tanpa batas dan admin
            # melihat gambar basi yang menumpuk (makin lama makin patah).
            # Buang yang basi, proses hanya frame terbaru.
            while True:
                try:
                    data = await asyncio.wait_for(websocket.receive_json(), timeout=0.02)
                except asyncio.TimeoutError:
                    break
            frame_b64 = data.get("frame", "")
            vehicle_id = data.get("vehicle_id", "unknown")

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

                # Simpan cepat dulu, baru inference — admin dapat 2-5 FPS bukan 0.5 FPS
                _store_frame_fast(vehicle_id, frame)

                result = detection_service.process_frame(frame)

                _update_result(vehicle_id, result)

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


@router.get("/frame/{vehicle_id}")
async def get_vehicle_frame(vehicle_id: str):
    """Get the latest camera frame for a specific vehicle as JPEG image."""
    with _frame_lock:
        entry = _frame_store.get(vehicle_id)

    if entry is None:
        return JSONResponse(
            status_code=404,
            content={"error": f"No frame available for vehicle {vehicle_id}"},
        )

    age_seconds = (datetime.utcnow() - entry["timestamp"]).total_seconds()
    if age_seconds > 30:
        return JSONResponse(
            status_code=404,
            content={"error": f"Frame for {vehicle_id} is stale ({int(age_seconds)}s old)"},
        )

    # Kirim hasil AI lewat header biar admin cukup 1 request (hemat 50% RTT di hosting)
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Vehicle-ID": vehicle_id,
        "X-Timestamp": entry["timestamp"].isoformat(),
        "X-Age-Seconds": str(round(age_seconds, 1)),
    }
    try:
        if entry.get("result"):
            # Compact JSON, aman untuk header (<8KB)
            headers["X-AI-Result"] = json.dumps(entry["result"], separators=(",", ":"))
    except Exception:
        pass

    return StreamingResponse(
        iter([entry["frame"]]),
        media_type="image/jpeg",
        headers=headers,
    )


@router.get("/frames")
async def list_active_frames():
    """List all vehicles with available frames and their latest AI results."""
    with _frame_lock:
        frames = {}
        for vid, entry in _frame_store.items():
            age = (datetime.utcnow() - entry["timestamp"]).total_seconds()
            if age < 30:
                frames[vid] = {
                    "timestamp": entry["timestamp"].isoformat(),
                    "age_seconds": round(age, 1),
                    "result": entry["result"],
                }
    return JSONResponse(content={"vehicles": frames})


@router.get("/status")
async def service_status() -> JSONResponse:
    """Get comprehensive service status."""
    uptime = (datetime.utcnow() - start_time).total_seconds()
    stream_props = {}
    if stream_service is not None:
        try:
            stream_props = stream_service.get_properties()
        except Exception:
            pass

    with _frame_lock:
        active_vehicles = [
            vid for vid, entry in _frame_store.items()
            if (datetime.utcnow() - entry["timestamp"]).total_seconds() < 30
        ]

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
        "active_vehicles": active_vehicles,
        "timestamp": datetime.utcnow().isoformat(),
    })
