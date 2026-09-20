import asyncio
import sys
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.settings import settings
from models.inference_result import InferenceResult
from detectors import create_detectors
from services.detection_service import DetectionService
from services.stream_service import StreamService
from services.communication_service import CommunicationService
from routes.inference_routes import router as inference_router, set_services, _store_frame
from routes.vehicle_routes import router as vehicle_router
from utils.logger import setup_logger

logger = setup_logger(__name__)

# Global service instances
detection_service: DetectionService = None
stream_service: StreamService = None
communication_service: CommunicationService = None
_continuous_inference_task: asyncio.Task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize and cleanup services."""
    global detection_service, stream_service, communication_service, _continuous_inference_task

    # Startup
    logger.info("=" * 60)
    logger.info("FleetVision AI Service starting...")
    logger.info("=" * 60)
    logger.info(f"STREAM_SOURCE = '{settings.STREAM_SOURCE}'")

    try:
        # 1. Initialize detectors
        logger.info("Initializing AI detectors...")
        detectors = create_detectors()
        logger.info(f"Detectors loaded: {list(detectors.keys())}")

        # 2. Create detection service
        detection_service = DetectionService(detectors)

        # 3. Initialize stream service
        stream_service = StreamService()
        stream_ok = stream_service.initialize()
        if not stream_ok:
            logger.warning("Stream source not available — will accept API/WebSocket frames only")
        else:
            logger.info("Stream source opened successfully")

        # 4. Initialize communication service
        communication_service = CommunicationService()
        await communication_service.initialize()

        # 5. Inject services into routes
        set_services(detection_service, stream_service)

        # 6. Start continuous inference loop only if a real stream source is active
        if stream_ok:
            _continuous_inference_task = asyncio.create_task(
                continuous_inference_loop()
            )
            logger.info("Continuous inference loop started")
        else:
            logger.info("Continuous inference loop skipped (API-only mode)")

        logger.info("FleetVision AI Service ready")
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise

    yield  # Application runs here

    # Shutdown
    logger.info("Shutting down FleetVision AI Service...")

    if _continuous_inference_task is not None:
        _continuous_inference_task.cancel()
        try:
            await _continuous_inference_task
        except asyncio.CancelledError:
            pass

    if detection_service is not None:
        detection_service.release_all()

    if stream_service is not None:
        stream_service.release()

    if communication_service is not None:
        await communication_service.release()

    logger.info("FleetVision AI Service stopped")


app = FastAPI(
    title="FleetVision AI Service",
    description="Real-time AI-powered driver monitoring service for fleet management. "
                "Provides seatbelt, fatigue, phone usage, and distraction detection "
                "using YOLOv8, MediaPipe, and OpenCV.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware — allow all origins for development
# expose_headers WAJIB: tanpa ini browser memblokir JS membaca X-AI-Result
# sehingga panel AI Behavior di admin selalu "No Data".
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-AI-Result", "X-Timestamp", "X-Age-Seconds", "X-Vehicle-ID"],
)

# Mount routers
app.include_router(inference_router)
app.include_router(vehicle_router)


@app.get("/")
async def root():
    """Root endpoint — service information."""
    return {
        "service": "FleetVision AI Service",
        "version": "1.0.0",
        "docs": "/docs",
        "openapi": "/openapi.json",
        "status": "/inference/status",
        "health": "/inference/health",
    }


async def continuous_inference_loop():
    """
    Background task that continuously reads frames from the stream,
    runs inference, and sends results to the backend.

    The loop:
    1. Reads a frame from the video stream
    2. Runs the detection service
    3. Sends results to the Laravel backend
    4. Sleeps for INFERENCE_INTERVAL seconds

    This runs as an asyncio task and is cancelled on shutdown.
    """
    global detection_service, stream_service, communication_service

    logger.info(
        f"Continuous inference started (interval={settings.INFERENCE_INTERVAL}s)"
    )

    while True:
        try:
            # Read next frame
            frame = stream_service.read_frame()
            if frame is None:
                logger.warning("No frame available — waiting for stream...")
                await asyncio.sleep(1.0)
                continue

            # Run detection pipeline
            result = detection_service.process_frame(frame)

            # Store frame for admin live view
            _store_frame(settings.VEHICLE_ID, frame, result)

            # Stamp the DB vehicle id for the backend payload
            result.vehicle_db_id = settings.VEHICLE_DB_ID

            # Log the result at debug level
            logger.debug(
                f"Inference: seatbelt={result.seatbelt}, "
                f"fatigue={result.fatigue}, phone={result.phone}, "
                f"looking_away={result.looking_away}, "
                f"eye_closed={result.eye_closed:.2f}"
            )

            # Send to backend
            if communication_service is not None:
                sent = await communication_service.send_result(result)
                if not sent:
                    logger.warning("Failed to send result to backend")

            # Wait for the configured interval
            await asyncio.sleep(settings.INFERENCE_INTERVAL)

        except asyncio.CancelledError:
            logger.info("Continuous inference loop cancelled")
            break
        except Exception as e:
            logger.error(f"Inference loop error: {e}")
            await asyncio.sleep(1.0)
