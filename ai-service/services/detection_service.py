import numpy as np
from datetime import datetime
from typing import Dict, Optional
from collections import deque

from models.inference_result import InferenceResult
from detectors import BaseDetector
from config.settings import settings


class DetectionService:
    """
    Core service that orchestrates all detectors and aggregates their results.

    This service:
    1. Takes all initialized detectors as dependencies
    2. Preprocesses each frame before passing to detectors
    3. Runs each detector and collects results
    4. Applies temporal smoothing (running average) to eye_closed values
    5. Constructs and returns a complete InferenceResult

    The aggregation logic:
    - seatbelt: from seatbelt detector OR logic
    - fatigue: from fatigue detector (PERCLOS-based)
    - phone: from phone detector with confidence threshold
    - eye_closed: smoothed running average over N frames
    - yawning: from fatigue detector MAR
    - looking_away: from distraction detector head pose
    - face_detected: from face detector
    """

    # Smoothing window for eye_closed value (frames)
    EYE_CLOSED_SMOOTHING = 5

    def __init__(self, detectors: Dict[str, BaseDetector]):
        self.detectors = detectors
        self._eye_closed_history = deque(
            maxlen=self.EYE_CLOSED_SMOOTHING
        )

    def process_frame(self, frame: np.ndarray) -> InferenceResult:
        """
        Process a single frame through all detectors.

        Pipeline:
        1. Run face detector (fast, gates other detectors)
        2. Run fatigue detector (face mesh-based)
        3. Run distraction detector (head pose from face mesh)
        4. Run seatbelt detector (pose-based)
        5. Run phone detector (YOLO-based)

        Args:
            frame: BGR image as numpy array

        Returns:
            Complete InferenceResult with all detection flags
        """
        if frame is None or frame.size == 0:
            return self._empty_result()

        try:
            # Run face detection first — it's fast and gates downstream detectors
            face_result = self._run_detector("face", frame)

            # Run fatigue detector (includes face mesh for EAR/MAR)
            fatigue_result = self._run_detector("fatigue", frame)

            # Run distraction detector (head pose from face mesh)
            distraction_result = self._run_detector("distraction", frame)

            # Run seatbelt detector (pose-based, works without face)
            seatbelt_result = self._run_detector("seatbelt", frame)

            # Run phone detector (YOLO, works without face)
            phone_result = self._run_detector("phone", frame)

            # Aggregate eye_closed with running average smoothing
            current_eye_closed = fatigue_result.get("eye_closed", 0.0)
            self._eye_closed_history.append(current_eye_closed)
            smoothed_eye_closed = (
                sum(self._eye_closed_history) / len(self._eye_closed_history)
                if self._eye_closed_history
                else 0.0
            )

            # Build the final inference result
            result = InferenceResult(
                vehicle_id=settings.VEHICLE_ID,
                seatbelt=seatbelt_result.get("seatbelt", False),
                fatigue=fatigue_result.get("fatigue", False),
                phone=phone_result.get("phone", False),
                eye_closed=round(smoothed_eye_closed, 2),
                yawning=fatigue_result.get("yawning", False),
                looking_away=(
                    distraction_result.get("looking_away", False)
                    or fatigue_result.get("looking_away", False)
                ),
                face_detected=face_result.get("face_detected", False),
                timestamp=datetime.utcnow(),
            )

            return result

        except Exception as e:
            print(f"DetectionService error: {e}")
            return self._empty_result()

    def _run_detector(self, name: str, frame: np.ndarray) -> dict:
        """Safely run a detector by name, returning empty results on failure."""
        detector = self.detectors.get(name)
        if detector is None:
            return {}
        try:
            return detector.detect(frame)
        except Exception as e:
            print(f"Detector '{name}' failed: {e}")
            return {}

    def _empty_result(self) -> InferenceResult:
        return InferenceResult(
            vehicle_id=settings.VEHICLE_ID,
            seatbelt=False,
            fatigue=False,
            phone=False,
            eye_closed=0.0,
            yawning=False,
            looking_away=False,
            face_detected=False,
            timestamp=datetime.utcnow(),
        )

    def release_all(self) -> None:
        """Release all detector resources."""
        for name, detector in self.detectors.items():
            try:
                detector.release()
            except Exception as e:
                print(f"Failed to release detector '{name}': {e}")
