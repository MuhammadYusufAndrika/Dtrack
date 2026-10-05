from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class InferenceResult(BaseModel):
    vehicle_id: str          # String identifier used as frame-store key
    vehicle_db_id: Optional[int] = None  # Integer DB id for Laravel POST /ai/result
    seatbelt: bool
    fatigue: bool
    phone: bool
    smoking: bool = False
    # Metode penentu seatbelt (mis. yolo_seatbelt, pose_estimation+yolo_checked)
    # — untuk diagnosis, tidak disimpan ke database.
    seatbelt_method: str = ""
    eye_closed: float
    yawning: bool
    looking_away: bool
    face_detected: bool
    timestamp: datetime
