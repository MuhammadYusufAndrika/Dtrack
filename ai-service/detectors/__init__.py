from .base_detector import BaseDetector
from .face_detector import FaceDetector
from .seatbelt_detector import SeatbeltDetector
from .smoke_detector import SmokeDetector
from .phone_detector import PhoneDetector
from .distraction_detector import DistractionDetector
from typing import Dict


def create_detectors() -> Dict[str, BaseDetector]:
    """Factory function that initializes all detectors."""
    detectors = {
        "face": FaceDetector(),
        "seatbelt": SeatbeltDetector(),
        "smoking": SmokeDetector(),
        "phone": PhoneDetector(),
        "distraction": DistractionDetector(),
    }
    for name, detector in detectors.items():
        try:
            detector.initialize()
        except Exception as e:
            print(f"Warning: Failed to initialize detector '{name}': {e}")
    return detectors


__all__ = [
    "BaseDetector",
    "FaceDetector",
    "SeatbeltDetector",
    "SmokeDetector",
    "PhoneDetector",
    "DistractionDetector",
    "create_detectors",
]
