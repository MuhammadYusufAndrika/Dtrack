from pydantic import BaseModel
from typing import List, Optional


class BoundingBox(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int
    confidence: float


class Detection(BaseModel):
    class_name: str
    confidence: float
    bbox: BoundingBox
