import numpy as np
import cv2
import mediapipe as mp
from .base_detector import BaseDetector


class FaceDetector(BaseDetector):
    """
    Wrapper around MediaPipe Face Detection.
    Uses the lightweight BlazeFace model (short-range) for real-time face detection.
    Returns bounding box and relative keypoints for the detected face.
    """

    def __init__(self, min_detection_confidence: float = 0.5):
        self.min_detection_confidence = min_detection_confidence
        self._face_detection = None

    def initialize(self) -> None:
        self._face_detection = mp.solutions.face_detection.FaceDetection(
            model_selection=0,
            min_detection_confidence=self.min_detection_confidence,
        )

    def detect(self, frame: np.ndarray) -> dict:
        """
        Detect faces in the frame using MediaPipe Face Detection.

        The BlazeFace model used by MediaPipe is a lightweight face detector
        optimized for mobile GPU inference. It uses a single-shot detector
        architecture with a custom encoder.

        Returns:
            dict with keys:
                - face_detected (bool): whether a face was found
                - face_bbox (dict|None): normalized bounding box [x, y, w, h]
                - relative_keypoints (list|None): 6 keypoints [right_eye, left_eye,
                  nose, mouth_center, right_ear, left_ear] each as [x, y]
        """
        if self._face_detection is None:
            return {
                "face_detected": False,
                "face_bbox": None,
                "relative_keypoints": None,
            }

        try:
            # MediaPipe expects RGB input
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self._face_detection.process(rgb_frame)

            if not results.detections:
                return {
                    "face_detected": False,
                    "face_bbox": None,
                    "relative_keypoints": None,
                }

            # Take the first (most confident) detected face
            detection = results.detections[0]
            bbox = detection.location_data.relative_bounding_box
            keypoints = detection.location_data.relative_keypoints

            # bounding box values are normalized to [0, 1] relative to image dimensions
            face_bbox = {
                "xmin": bbox.xmin,
                "ymin": bbox.ymin,
                "width": bbox.width,
                "height": bbox.height,
            }

            # Extract the 6 keypoints (right eye, left eye, nose, mouth,
            # right ear tragion, left ear tragion)
            relative_keypoints = [
                {"x": kp.x, "y": kp.y} for kp in keypoints
            ]

            return {
                "face_detected": True,
                "face_bbox": face_bbox,
                "relative_keypoints": relative_keypoints,
                "score": detection.score[0],
            }

        except Exception as e:
            print(f"FaceDetector error: {e}")
            return {
                "face_detected": False,
                "face_bbox": None,
                "relative_keypoints": None,
                "error": str(e),
            }

    def release(self) -> None:
        if self._face_detection is not None:
            self._face_detection.close()
            self._face_detection = None
