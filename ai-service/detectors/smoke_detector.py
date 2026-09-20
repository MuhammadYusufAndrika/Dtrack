import numpy as np
import cv2
from .base_detector import BaseDetector

_HAS_MEDIAPIPE = False
try:
    import mediapipe as mp
    _HAS_MEDIAPIPE = hasattr(mp, 'solutions')
except ImportError:
    pass


class SmokeDetector(BaseDetector):
    """
    Smoking detection via hand-to-mouth gesture heuristic (no extra model weights).

    A cigarette itself is far too small for YOLOv8n-COCO (COCO has no cigarette
    class), so this detector looks for the characteristic gesture instead:
    a wrist held close to the mouth, sustained over consecutive frames.

    Pipeline:
    1. MediaPipe FaceMesh -> mouth center (landmarks 13/14) + face width scale
    2. MediaPipe Pose (lite) -> left/right wrists (landmarks 15/16)
    3. If either wrist is within PROXIMITY_RATIO * face_width of the mouth,
       increment a temporal counter; otherwise decay it.
    4. smoking = True once the counter reaches TRIGGER_FRAMES.

    Limitations (jujur):
    - Eating, drinking, coughing into the hand, or resting chin on hand can
      trigger false positives. The consecutive-frame requirement reduces this.
    - The hand must be visible in frame; hands on the wheel are not detected
      (which is correct — that is not smoking).
    - OpenCV fallback cannot detect smoking and always returns False.
    """

    # MediaPipe Pose landmark ids
    WRIST_LEFT = 15
    WRIST_RIGHT = 16

    # MediaPipe FaceMesh landmark ids (upper / lower lip center)
    MOUTH_UPPER = 13
    MOUTH_LOWER = 14

    # Wrist-to-mouth distance below this fraction of face width counts as "near"
    PROXIMITY_RATIO = 0.5
    # Consecutive "near" frames required to flag smoking (hysteresis 0..10)
    TRIGGER_FRAMES = 5
    COUNTER_MAX = 10

    def __init__(self):
        self._pose = None
        self._face_mesh = None
        self._use_opencv = False
        self._near_count = 0

    def initialize(self) -> None:
        if _HAS_MEDIAPIPE:
            try:
                self._pose = mp.solutions.pose.Pose(
                    static_image_mode=False,
                    model_complexity=0,  # lite — cepat di CPU
                    enable_segmentation=False,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5,
                )
                self._face_mesh = mp.solutions.face_mesh.FaceMesh(
                    static_image_mode=False,
                    max_num_faces=1,
                    refine_landmarks=False,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5,
                )
                print("SmokeDetector: using MediaPipe")
                return
            except Exception as e:
                print(f"SmokeDetector: MediaPipe failed ({e}), falling back to OpenCV")
        self._use_opencv = True
        print("SmokeDetector: using OpenCV fallback (smoking detection disabled)")

    def detect(self, frame: np.ndarray) -> dict:
        if self._use_opencv:
            return self._empty_result()
        return self._detect_mediapipe(frame)

    def _detect_mediapipe(self, frame: np.ndarray) -> dict:
        if self._pose is None or self._face_mesh is None:
            return self._empty_result()
        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            h, w = frame.shape[:2]

            mesh_results = self._face_mesh.process(rgb_frame)
            if not mesh_results.multi_face_landmarks:
                self._decay()
                return self._empty_result(face_detected=False)

            face_lm = mesh_results.multi_face_landmarks[0].landmark
            mouth = np.array([
                ((face_lm[self.MOUTH_UPPER].x + face_lm[self.MOUTH_LOWER].x) / 2.0 * w,
                 (face_lm[self.MOUTH_UPPER].y + face_lm[self.MOUTH_LOWER].y) / 2.0 * h),
            ])
            xs = [lm.x * w for lm in face_lm]
            face_width = max(float(max(xs) - min(xs)), 1.0)

            pose_results = self._pose.process(rgb_frame)
            hand_near_mouth = False
            if pose_results.pose_landmarks:
                pose_lm = pose_results.pose_landmarks.landmark
                for wrist_id in (self.WRIST_LEFT, self.WRIST_RIGHT):
                    lm = pose_lm[wrist_id]
                    if lm.visibility < 0.5:
                        continue
                    wrist = np.array([lm.x * w, lm.y * h])
                    dist = float(np.linalg.norm(wrist - mouth[0]))
                    if dist < self.PROXIMITY_RATIO * face_width:
                        hand_near_mouth = True
                        break

            if hand_near_mouth:
                self._near_count = min(self._near_count + 1, self.COUNTER_MAX)
            else:
                self._decay()

            smoking = self._near_count >= self.TRIGGER_FRAMES
            return {
                "smoking": smoking,
                "confidence": round(self._near_count / self.COUNTER_MAX, 2),
                "hand_near_mouth": hand_near_mouth,
                "face_detected": True,
            }
        except Exception as e:
            print(f"SmokeDetector mediapipe error: {e}")
            return self._empty_result()

    def _decay(self):
        self._near_count = max(self._near_count - 1, 0)

    def _empty_result(self, face_detected: bool = True) -> dict:
        return {
            "smoking": False,
            "confidence": 0.0,
            "hand_near_mouth": False,
            "face_detected": face_detected,
        }

    def release(self) -> None:
        self._pose = None
        self._face_mesh = None
