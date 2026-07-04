from .inference_routes import router as inference_router
from .vehicle_routes import router as vehicle_router

__all__ = ["inference_router", "vehicle_router"]
