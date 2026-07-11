import numpy as np
import cv2
from .base_detector import BaseDetector

_HAS_MEDIAPIPE = False
try:
    import mediapipe as mp
    _HAS_MEDIAPIPE = hasattr(mp, 'solutions')
except ImportError:
    pass


class SeatbeltDetector(BaseDetector):
    """
    Seatbelt detection using MediaPipe Pose or OpenCV edge-based fallback.
    """

    LANDMARK_LEFT_SHOULDER = 11
    LANDMARK_RIGHT_SHOULDER = 12
    LANDMARK_LEFT_HIP = 23
    LANDMARK_RIGHT_HIP = 24

    def __init__(self, pose_confidence: float = 0.5):
        self.pose_confidence = pose_confidence
        self._pose = None
        self._use_opencv = False

    def initialize(self) -> None:
        if _HAS_MEDIAPIPE:
            try:
                self._pose = mp.solutions.pose.Pose(
                    static_image_mode=False,
                    model_complexity=1,
                    enable_segmentation=False,
                    min_detection_confidence=self.pose_confidence,
                    min_tracking_confidence=self.pose_confidence,
                )
                print("SeatbeltDetector: using MediaPipe")
                return
            except Exception as e:
                print(f"SeatbeltDetector: MediaPipe failed ({e}), falling back to OpenCV")

        self._use_opencv = True
        print("SeatbeltDetector: using OpenCV edge analysis")

    def _check_seatbelt_line(self, frame, shoulder_pt, hip_pt):
        h, w = frame.shape[:2]
        x1, y1 = int(shoulder_pt[0]), int(shoulder_pt[1])
        x2, y2 = int(hip_pt[0]), int(hip_pt[1])
        x1, y1 = max(0, min(x1, w - 1)), max(0, min(y1, h - 1))
        x2, y2 = max(0, min(x2, w - 1)), max(0, min(y2, h - 1))

        dx, dy = x2 - x1, y2 - y1
        angle_deg = abs(np.degrees(np.arctan2(dy, dx)))
        if angle_deg < 20 or angle_deg > 70:
            return False

        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.line(mask, (x1, y1), (x2, y2), 255, thickness=12)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        roi_edges = cv2.bitwise_and(edges, mask)
        edge_pixel_count = np.count_nonzero(roi_edges)
        line_length = int(np.sqrt(dx ** 2 + dy ** 2))
        roi_area = 12 * line_length if line_length > 0 else 1
        edge_density = edge_pixel_count / roi_area
        return edge_density > 0.15

    def detect(self, frame: np.ndarray) -> dict:
        if self._use_opencv:
            return self._detect_opencv(frame)
        return self._detect_mediapipe(frame)

    def _detect_mediapipe(self, frame: np.ndarray) -> dict:
        if self._pose is None:
            return {"seatbelt": False, "method": "pose_estimation", "confidence": 0.0, "landmarks_visible": False}
        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self._pose.process(rgb_frame)
            if not results.pose_landmarks:
                return {"seatbelt": False, "method": "pose_estimation", "confidence": 0.0, "landmarks_visible": False}

            landmarks = results.pose_landmarks.landmark
            h, w = frame.shape[:2]
            left_shoulder = (landmarks[self.LANDMARK_LEFT_SHOULDER].x * w, landmarks[self.LANDMARK_LEFT_SHOULDER].y * h)
            right_shoulder = (landmarks[self.LANDMARK_RIGHT_SHOULDER].x * w, landmarks[self.LANDMARK_RIGHT_SHOULDER].y * h)
            left_hip = (landmarks[self.LANDMARK_LEFT_HIP].x * w, landmarks[self.LANDMARK_LEFT_HIP].y * h)
            right_hip = (landmarks[self.LANDMARK_RIGHT_HIP].x * w, landmarks[self.LANDMARK_RIGHT_HIP].y * h)

            d1 = self._check_seatbelt_line(frame, left_shoulder, right_hip)
            d2 = self._check_seatbelt_line(frame, right_shoulder, left_hip)
            seatbelt = d1 or d2
            return {"seatbelt": seatbelt, "method": "pose_estimation", "confidence": 0.85 if seatbelt else 0.6, "landmarks_visible": True}
        except Exception as e:
            print(f"SeatbeltDetector mediapipe error: {e}")
            return {"seatbelt": False, "method": "pose_estimation", "confidence": 0.0, "landmarks_visible": False}

    def _detect_opencv(self, frame: np.ndarray) -> dict:
        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)

        roi = edges[int(h * 0.15):int(h * 0.85), int(w * 0.1):int(w * 0.9)]
        lines = cv2.HoughLinesP(roi, 1, np.pi / 180, threshold=50, minLineLength=50, maxLineGap=10)

        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                angle = abs(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
                if 25 < angle < 65:
                    return {"seatbelt": True, "method": "edge_analysis", "confidence": 0.6, "landmarks_visible": False}

        return {"seatbelt": False, "method": "edge_analysis", "confidence": 0.4, "landmarks_visible": False}

    def release(self) -> None:
        self._pose = None
