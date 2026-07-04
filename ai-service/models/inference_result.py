from pydantic import BaseModel
from datetime import datetime


class InferenceResult(BaseModel):
    vehicle_id: str
    seatbelt: bool
    fatigue: bool
    phone: bool
    eye_closed: float
    yawning: bool
    looking_away: bool
    face_detected: bool
    timestamp: datetime
