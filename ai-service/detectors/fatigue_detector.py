import numpy as np
import cv2
from collections import deque
from .base_detector import BaseDetector

_HAS_MEDIAPIPE = False
try:
    import mediapipe as mp
    _HAS_MEDIAPIPE = hasattr(mp, 'solutions')
except ImportError:
    pass


class FatigueDetector(BaseDetector):
    """
    Fatigue/drowsiness detection using MediaPipe Face Mesh or OpenCV fallback.
    """

    LEFT_EYE_IDX = [33, 160, 158, 133, 153, 144]
    RIGHT_EYE_IDX = [362, 385, 387, 263, 373, 380]
    MOUTH_IDX = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308]

    EAR_THRESHOLD = 0.2
    MAR_THRESHOLD = 0.6
    PERCLOS_THRESHOLD = 0.3
    PERCLOS_WINDOW = 90

    def __init__(self):
        self._face_mesh = None
        self._use_opencv = False
        self._ear_history = deque(maxlen=self.PERCLOS_WINDOW)
        self._eye_closed_count = 0
        self._eye_cascade = None
        self._mouth_cascade = None

    def initialize(self) -> None:
        if _HAS_MEDIAPIPE:
            try:
                self._face_mesh = mp.solutions.face_mesh.FaceMesh(
                    static_image_mode=False,
                    max_num_faces=1,
                    refine_landmarks=True,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5,
                )
                print("FatigueDetector: using MediaPipe")
                return
            except Exception as e:
                print(f"FatigueDetector: MediaPipe failed ({e}), falling back to OpenCV")

        self._use_opencv = True
        self._eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")
        self._mouth_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_smile.xml")
        print("FatigueDetector: using OpenCV Haar cascade")

    @staticmethod
    def _calculate_ear(eye_landmarks: np.ndarray) -> float:
        if len(eye_landmarks) < 6:
            return 0.0
        p2_p6 = np.linalg.norm(eye_landmarks[1] - eye_landmarks[5])
        p3_p5 = np.linalg.norm(eye_landmarks[2] - eye_landmarks[4])
        p1_p4 = np.linalg.norm(eye_landmarks[0] - eye_landmarks[3])
        if p1_p4 < 1e-6:
            return 0.0
        return float((p2_p6 + p3_p5) / (2.0 * p1_p4))

    @staticmethod
    def _calculate_mar(mouth_landmarks: np.ndarray) -> float:
        if len(mouth_landmarks) < 4:
            return 0.0
        vertical = np.linalg.norm(mouth_landmarks[1] - mouth_landmarks[3])
        horizontal = np.linalg.norm(mouth_landmarks[0] - mouth_landmarks[2])
        if horizontal < 1e-6:
            return 0.0
        return float(vertical / horizontal)

    def detect(self, frame: np.ndarray) -> dict:
        if self._use_opencv:
            return self._detect_opencv(frame)
        return self._detect_mediapipe(frame)

    def _detect_mediapipe(self, frame: np.ndarray) -> dict:
        if self._face_mesh is None:
            return self._empty_result()
        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self._face_mesh.process(rgb_frame)
            if not results.multi_face_landmarks:
                self._ear_history.append(1.0)
                return self._empty_result(face_detected=False)

            landmarks_raw = results.multi_face_landmarks[0].landmark
            h, w = frame.shape[:2]
            landmarks_2d = np.array([(lm.x * w, lm.y * h) for lm in landmarks_raw], dtype=np.float64)

            left_eye_pts = landmarks_2d[self.LEFT_EYE_IDX]
            right_eye_pts = landmarks_2d[self.RIGHT_EYE_IDX]
            left_ear = self._calculate_ear(left_eye_pts)
            right_ear = self._calculate_ear(right_eye_pts)
            avg_ear = (left_ear + right_ear) / 2.0

            eye_closed_val = 1.0 if avg_ear < self.EAR_THRESHOLD else 0.0
            self._ear_history.append(eye_closed_val)
            perclos = sum(self._ear_history) / len(self._ear_history) if self._ear_history else 0.0

            mouth_pts = landmarks_2d[self.MOUTH_IDX]
            mar = self._calculate_mar(mouth_pts)

            return {
                "fatigue": perclos > self.PERCLOS_THRESHOLD,
                "eye_closed": eye_closed_val,
                "yawning": mar > self.MAR_THRESHOLD,
                "ear": avg_ear,
                "mar": mar,
                "perclos": perclos,
                "looking_away": False,
                "face_detected": True,
            }
        except Exception as e:
            print(f"FatigueDetector mediapipe error: {e}")
            return self._empty_result()

    def _detect_opencv(self, frame: np.ndarray) -> dict:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        h, w = frame.shape[:2]

        eyes = self._eye_cascade.detectMultiScale(gray, 1.1, 5) if self._eye_cascade is not None else []
        eye_closed_val = 0.0 if len(eyes) >= 2 else 1.0
        self._ear_history.append(eye_closed_val)
        perclos = sum(self._ear_history) / len(self._ear_history) if self._ear_history else 0.0

        mouth_region = frame[int(h * 0.6):, int(w * 0.25):int(w * 0.75)]
        mouth_gray = cv2.cvtColor(mouth_region, cv2.COLOR_BGR2GRAY) if mouth_region.size > 0 else gray
        mouths = self._mouth_cascade.detectMultiScale(mouth_gray, 1.7, 20) if self._mouth_cascade is not None else []

        return {
            "fatigue": perclos > self.PERCLOS_THRESHOLD,
            "eye_closed": eye_closed_val,
            "yawning": len(mouths) > 0,
            "ear": 0.3 if len(eyes) >= 2 else 0.1,
            "mar": 0.7 if len(mouths) > 0 else 0.3,
            "perclos": perclos,
            "looking_away": False,
            "face_detected": len(eyes) > 0,
        }

    def _empty_result(self, face_detected: bool = True) -> dict:
        return {
            "fatigue": False, "eye_closed": 0.0, "yawning": False,
            "ear": 0.0, "mar": 0.0, "perclos": 0.0,
            "looking_away": False, "face_detected": face_detected,
        }

    def release(self) -> None:
        self._face_mesh = None
        self._eye_cascade = None
        self._mouth_cascade = None
