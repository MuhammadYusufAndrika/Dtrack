from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class InferenceResult(BaseModel):
    vehicle_id: str          # String identifier used as frame-store key
    vehicle_db_id: Optional[int] = None  # Integer DB id for Laravel POST /ai/result
    seatbelt: bool
    smoking: bool
    phone: bool
    looking_away: bool
    face_detected: bool
    timestamp: datetime
