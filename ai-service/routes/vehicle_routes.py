from typing import List, Dict, Optional
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from config.settings import settings
from utils.logger import setup_logger

logger = setup_logger(__name__)

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])

# In-memory vehicle registry (replace with DB in production)
_vehicles: Dict[str, dict] = {
    settings.VEHICLE_ID: {
        "vehicle_id": settings.VEHICLE_ID,
        "status": "monitoring",
        "registered_at": datetime.utcnow().isoformat(),
    }
}


class VehicleRegisterRequest(BaseModel):
    vehicle_id: str
    plate_number: Optional[str] = None
    driver_name: Optional[str] = None
    notes: Optional[str] = None


@router.get("")
async def list_vehicles() -> JSONResponse:
    """
    List all registered vehicles in the AI monitoring system.

    Returns:
        JSON with list of vehicles and their current status
    """
    return JSONResponse(content={
        "vehicles": list(_vehicles.values()),
        "total": len(_vehicles),
    })


@router.post("/register")
async def register_vehicle(data: VehicleRegisterRequest) -> JSONResponse:
    """
    Register a new vehicle for AI-based driver monitoring.

    Args:
        data: Vehicle registration details (vehicle_id required)

    Returns:
        JSON with registration confirmation
    """
    if not data.vehicle_id or not data.vehicle_id.strip():
        return JSONResponse(
            status_code=400,
            content={"error": "vehicle_id is required"},
        )

    vehicle_id = data.vehicle_id.strip()

    if vehicle_id in _vehicles:
        return JSONResponse(
            status_code=409,
            content={
                "error": f"Vehicle '{vehicle_id}' is already registered",
                "vehicle": _vehicles[vehicle_id],
            },
        )

    vehicle_entry = {
        "vehicle_id": vehicle_id,
        "plate_number": data.plate_number or "",
        "driver_name": data.driver_name or "",
        "notes": data.notes or "",
        "status": "monitoring",
        "registered_at": datetime.utcnow().isoformat(),
    }

    _vehicles[vehicle_id] = vehicle_entry
    logger.info(f"Registered vehicle: {vehicle_id}")

    return JSONResponse(
        content={
            "message": f"Vehicle '{vehicle_id}' registered successfully",
            "vehicle": vehicle_entry,
        },
        status_code=201,
    )


@router.get("/{vehicle_id}")
async def get_vehicle(vehicle_id: str) -> JSONResponse:
    """
    Get details for a specific registered vehicle.

    Args:
        vehicle_id: The vehicle identifier

    Returns:
        JSON with vehicle details or 404
    """
    vehicle = _vehicles.get(vehicle_id)
    if vehicle is None:
        return JSONResponse(
            status_code=404,
            content={"error": f"Vehicle '{vehicle_id}' not found"},
        )

    return JSONResponse(content={"vehicle": vehicle})
