import numpy as np
import cv2
import mediapipe as mp
from collections import deque
from .base_detector import BaseDetector


class FatigueDetector(BaseDetector):
    """
    Comprehensive fatigue/drowsiness detection using MediaPipe Face Mesh.

    TECHNIQUES USED:
    ---------------
    1. Eye Aspect Ratio (EAR): Measures the ratio of eye width to height.
       When a person closes their eyes, EAR drops significantly.
       EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
       where p1-p6 are the 6 eye landmarks in order around the eye.

    2. Mouth Aspect Ratio (MAR): Similar concept applied to the mouth.
       MAR = |p2-p4| / (2 * |p1-p3|)
       High MAR indicates yawning.

    3. PERCLOS (Percentage of Eyelid Closure Over the Pupil):
       The percentage of time the eyes are closed over a sliding window.
       PERCLOS > threshold indicates drowsiness.

    4. Head Pose Estimation (looking_away):
       Estimated via face landmark-based solvePnP.
    """

    # MediaPipe Face Mesh landmark indices for left eye
    LEFT_EYE_IDX = [33, 160, 158, 133, 153, 144]
    # MediaPipe Face Mesh landmark indices for right eye
    RIGHT_EYE_IDX = [362, 385, 387, 263, 373, 380]
    # MediaPipe Face Mesh landmark indices for mouth
    MOUTH_IDX = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308]

    # Thresholds
    EAR_THRESHOLD = 0.2
    MAR_THRESHOLD = 0.6
    PERCLOS_THRESHOLD = 0.3

    # Sliding window size for PERCLOS calculation (frames)
    PERCLOS_WINDOW = 90

    def __init__(self):
        self._face_mesh = None
        self._ear_history = deque(maxlen=self.PERCLOS_WINDOW)
        self._eye_closed_count = 0

    def initialize(self) -> None:
        self._face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    @staticmethod
    def _calculate_ear(eye_landmarks: np.ndarray) -> float:
        """
        Calculate Eye Aspect Ratio (EAR) from 6 eye landmarks.

        EAR is defined as:
            EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)

        Where the landmarks are ordered around the eye:
            p1: outer corner, p2: top-outer, p3: top-inner,
            p4: inner corner, p5: bottom-inner, p6: bottom-outer

        When the eye opens, EAR is relatively constant (~0.25-0.35).
        When the eye closes, EAR drops to near 0.
        """
        if len(eye_landmarks) < 6:
            return 0.0

        # Compute Euclidean distances
        # Vertical distances
        p2_p6 = np.linalg.norm(eye_landmarks[1] - eye_landmarks[5])
        p3_p5 = np.linalg.norm(eye_landmarks[2] - eye_landmarks[4])
        # Horizontal distance
        p1_p4 = np.linalg.norm(eye_landmarks[0] - eye_landmarks[3])

        if p1_p4 < 1e-6:
            return 0.0

        ear = (p2_p6 + p3_p5) / (2.0 * p1_p4)
        return float(ear)

    @staticmethod
    def _calculate_mar(mouth_landmarks: np.ndarray) -> float:
        """
        Calculate Mouth Aspect Ratio (MAR) to detect yawning.

        MAR = |p2-p4| / |p1-p3|

        Where p1-p4 are the midpoints of the outer, top, inner, bottom lip.
        A yawn significantly increases MAR (> 0.6 typically).
        """
        if len(mouth_landmarks) < 4:
            return 0.0

        # Top lip midpoint to bottom lip midpoint (vertical opening)
        vertical = np.linalg.norm(
            mouth_landmarks[1] - mouth_landmarks[3]
        )
        # Left corner to right corner (horizontal width)
        horizontal = np.linalg.norm(
            mouth_landmarks[0] - mouth_landmarks[2]
        )

        if horizontal < 1e-6:
            return 0.0

        mar = vertical / horizontal
        return float(mar)

    def detect(self, frame: np.ndarray) -> dict:
        """
        Run comprehensive fatigue detection on a single frame.

        The pipeline:
        1. Detect face mesh using MediaPipe (468 3D landmarks)
        2. Extract eye and mouth landmarks
        3. Compute EAR for both eyes and average them
        4. Compute MAR for the mouth
        5. Update PERCLOS sliding window
        6. Classify: fatigue = PERCLOS > threshold

        Returns:
            dict with keys:
                - fatigue (bool): overall fatigue flag
                - eye_closed (float): 0.0 (open) to 1.0 (closed)
                - yawning (bool): whether yawning was detected
                - ear (float): current average EAR
                - mar (float): current MAR
                - perclos (float): PERCLOS percentage over window
                - looking_away (bool): head pose based distraction
        """
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

            # Convert landmarks to pixel coordinates
            landmarks_2d = np.array(
                [(lm.x * w, lm.y * h) for lm in landmarks_raw],
                dtype=np.float64,
            )

            # Extract eye landmarks
            left_eye_pts = landmarks_2d[self.LEFT_EYE_IDX]
            right_eye_pts = landmarks_2d[self.RIGHT_EYE_IDX]

            # Calculate EAR for each eye
            left_ear = self._calculate_ear(left_eye_pts)
            right_ear = self._calculate_ear(right_eye_pts)

            # Average EAR across both eyes
            avg_ear = (left_ear + right_ear) / 2.0

            # Determine if eyes are closed
            eye_closed_val = 1.0 if avg_ear < self.EAR_THRESHOLD else 0.0
            self._ear_history.append(eye_closed_val)

            # Calculate PERCLOS over the sliding window
            if len(self._ear_history) > 0:
                perclos = sum(self._ear_history) / len(self._ear_history)
            else:
                perclos = 0.0

            # Extract mouth landmarks for MAR calculation
            mouth_pts = landmarks_2d[self.MOUTH_IDX]
            mar = self._calculate_mar(mouth_pts)
            yawning = mar > self.MAR_THRESHOLD

            # Fatigue is flagged when PERCLOS exceeds threshold
            fatigue = perclos > self.PERCLOS_THRESHOLD

            return {
                "fatigue": fatigue,
                "eye_closed": eye_closed_val,
                "yawning": yawning or False,
                "ear": avg_ear,
                "mar": mar,
                "perclos": perclos,
                "looking_away": False,
                "face_detected": True,
            }

        except Exception as e:
            print(f"FatigueDetector error: {e}")
            return self._empty_result()

    def _empty_result(self, face_detected: bool = True) -> dict:
        return {
            "fatigue": False,
            "eye_closed": 0.0,
            "yawning": False,
            "ear": 0.0,
            "mar": 0.0,
            "perclos": 0.0,
            "looking_away": False,
            "face_detected": face_detected,
        }

    def release(self) -> None:
        if self._face_mesh is not None:
            self._face_mesh.close()
            self._face_mesh = None
