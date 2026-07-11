import numpy as np
import cv2
from .base_detector import BaseDetector

_HAS_MEDIAPIPE = False
try:
    import mediapipe as mp
    _HAS_MEDIAPIPE = hasattr(mp, 'solutions')
except ImportError:
    pass


class DistractionDetector(BaseDetector):
    """
    Driver distraction detection using MediaPipe Face Mesh or OpenCV fallback.
    """

    _MODEL_POINTS_3D = np.array([
        [0.0, 0.0, 0.0],
        [0.0, -330.0, -65.0],
        [-225.0, 170.0, -135.0],
        [225.0, 170.0, -135.0],
        [-150.0, -150.0, -125.0],
        [150.0, -150.0, -125.0],
    ], dtype=np.float64)

    _LANDMARK_INDICES = [1, 199, 33, 263, 61, 291]

    def __init__(self):
        self._face_mesh = None
        self._use_opencv = False
        self._face_cascade = None

    def initialize(self) -> None:
        if _HAS_MEDIAPIPE:
            try:
                self._face_mesh = mp.solutions.face_mesh.FaceMesh(
                    static_image_mode=False, max_num_faces=1, refine_landmarks=True,
                    min_detection_confidence=0.5, min_tracking_confidence=0.5,
                )
                print("DistractionDetector: using MediaPipe")
                return
            except Exception as e:
                print(f"DistractionDetector: MediaPipe failed ({e}), falling back to OpenCV")

        self._use_opencv = True
        self._face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        print("DistractionDetector: using OpenCV Haar cascade")

    def _estimate_head_pose(self, landmarks_2d, image_size):
        h, w = image_size
        focal_length = w
        center = (w / 2, h / 2)
        camera_matrix = np.array([[focal_length, 0, center[0]], [0, focal_length, center[1]], [0, 0, 1]], dtype=np.float64)
        dist_coeffs = np.zeros((4, 1), dtype=np.float64)
        image_points = np.array([landmarks_2d[idx] for idx in self._LANDMARK_INDICES], dtype=np.float64)

        success, rotation_vector, translation_vector = cv2.solvePnP(
            self._MODEL_POINTS_3D, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE,
        )
        if not success:
            return {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}

        rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
        proj_matrix = np.hstack((rotation_matrix, translation_vector))
        _, _, _, _, _, euler_angles = cv2.decomposeProjectionMatrix(proj_matrix)
        if euler_angles is None:
            return {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}

        return {
            "yaw": round(float(euler_angles[1]), 2),
            "pitch": round(float(euler_angles[0]), 2),
            "roll": round(float(euler_angles[2]), 2),
        }

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
                return self._empty_result(face_detected=False)

            landmarks_raw = results.multi_face_landmarks[0].landmark
            h, w = frame.shape[:2]
            landmarks_2d = np.array([(lm.x * w, lm.y * h) for lm in landmarks_raw], dtype=np.float64)
            pose = self._estimate_head_pose(landmarks_2d, (w, h))
            looking_away = abs(pose["yaw"]) > 30 or abs(pose["pitch"]) > 20

            return {
                "distracted": looking_away, "looking_away": looking_away,
                "yaw": pose["yaw"], "pitch": pose["pitch"], "roll": pose["roll"],
                "face_detected": True,
            }
        except Exception as e:
            print(f"DistractionDetector mediapipe error: {e}")
            return self._empty_result()

    def _detect_opencv(self, frame: np.ndarray) -> dict:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        h, w = frame.shape[:2]

        if self._face_cascade is None:
            return self._empty_result(face_detected=False)

        faces = self._face_cascade.detectMultiScale(gray, 1.1, 5)
        if len(faces) == 0:
            return self._empty_result(face_detected=False)

        x, y, fw, fh = faces[0]
        cx = x + fw / 2
        cy = y + fh / 2

        image_center_x = w / 2
        image_center_y = h / 2

        yaw = ((cx - image_center_x) / image_center_x) * 45
        pitch = ((cy - image_center_y) / image_center_y) * 30

        looking_away = abs(yaw) > 30 or abs(pitch) > 20

        return {
            "distracted": looking_away, "looking_away": looking_away,
            "yaw": round(yaw, 2), "pitch": round(pitch, 2), "roll": 0.0,
            "face_detected": True,
        }

    def _empty_result(self, face_detected: bool = True) -> dict:
        return {
            "distracted": False, "looking_away": False,
            "yaw": 0.0, "pitch": 0.0, "roll": 0.0,
            "face_detected": face_detected,
        }

    def release(self) -> None:
        self._face_mesh = None
        self._face_cascade = None
