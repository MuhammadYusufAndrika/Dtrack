import numpy as np
import cv2
import mediapipe as mp
from .base_detector import BaseDetector


class DistractionDetector(BaseDetector):
    """
    Driver distraction detection using head pose estimation.

    TECHNIQUE:
    ---------
    Uses MediaPipe Face Mesh to detect 468 facial landmarks in 3D.
    Head pose is estimated by solving the Perspective-n-Point (PnP) problem:
    we match known 3D face model coordinates of key landmarks (nose tip,
    chin, left eye corner, right eye corner, left mouth corner, right mouth
    corner) to their detected 2D positions in the image.

    Using OpenCV's solvePnP, we compute the rotation vector (converted to
    Euler angles: yaw, pitch, roll). The driver is classified as looking away
    when yaw exceeds 30 degrees or pitch exceeds 20 degrees in either direction.

    HEADS UP DISPLAY (HUD) NOTE:
    This approach assumes the driver's face is roughly frontal to the camera
    at initialization. For absolute head pose, camera intrinsic parameters
    should be calibrated.
    """

    # 3D model coordinates of key facial landmarks (in mm, relative to nose tip)
    # These are approximate positions from a generic face model
    _MODEL_POINTS_3D = np.array([
        [0.0, 0.0, 0.0],        # Nose tip
        [0.0, -330.0, -65.0],   # Chin
        [-225.0, 170.0, -135.0], # Left eye left corner
        [225.0, 170.0, -135.0], # Right eye right corner
        [-150.0, -150.0, -125.0], # Left mouth corner
        [150.0, -150.0, -125.0], # Right mouth corner
    ], dtype=np.float64)

    # Corresponding MediaPipe Face Mesh landmark indices
    _LANDMARK_INDICES = [1, 199, 33, 263, 61, 291]

    def __init__(self):
        self._face_mesh = None

    def initialize(self) -> None:
        self._face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    def _estimate_head_pose(
        self, landmarks_2d: np.ndarray, image_size: tuple
    ) -> dict:
        """
        Estimate head rotation (yaw, pitch, roll) using solvePnP.

        Args:
            landmarks_2d: Full array of 468 2D face landmarks (pixel coords)
            image_size: (width, height) of the frame

        Returns:
            dict with keys yaw, pitch, roll in degrees
        """
        h, w = image_size

        # Camera intrinsic matrix approximation
        # Assuming a typical webcam with ~60 degree FOV
        focal_length = w
        center = (w / 2, h / 2)
        camera_matrix = np.array(
            [
                [focal_length, 0, center[0]],
                [0, focal_length, center[1]],
                [0, 0, 1],
            ],
            dtype=np.float64,
        )

        dist_coeffs = np.zeros((4, 1), dtype=np.float64)

        # Get the 2D image points corresponding to the 3D model points
        image_points = np.array(
            [landmarks_2d[idx] for idx in self._LANDMARK_INDICES],
            dtype=np.float64,
        )

        # Solve PnP to find rotation and translation vectors
        success, rotation_vector, translation_vector = cv2.solvePnP(
            self._MODEL_POINTS_3D,
            image_points,
            camera_matrix,
            dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE,
        )

        if not success:
            return {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}

        # Convert rotation vector to rotation matrix
        rotation_matrix, _ = cv2.Rodrigues(rotation_vector)

        # Decompose rotation matrix into Euler angles
        # Using the XYZ convention (yaw around Z, pitch around Y, roll around X)
        proj_matrix = np.hstack((rotation_matrix, translation_vector))
        _, _, _, _, _, euler_angles = cv2.decomposeProjectionMatrix(proj_matrix)

        if euler_angles is None:
            return {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}

        # Extract Euler angles and convert from radians to degrees
        yaw = float(euler_angles[1])   # Yaw: left-right rotation
        pitch = float(euler_angles[0]) # Pitch: up-down rotation
        roll = float(euler_angles[2])  # Roll: tilt

        return {
            "yaw": round(yaw, 2),
            "pitch": round(pitch, 2),
            "roll": round(roll, 2),
        }

    def detect(self, frame: np.ndarray) -> dict:
        """
        Detect driver distraction by estimating head pose.

        Classification thresholds:
            - looking_away if |yaw| > 30 degrees
            - looking_away if |pitch| > 20 degrees
            - distracted if either condition is met

        Returns:
            dict with keys:
                - distracted (bool): overall distraction flag
                - looking_away (bool): specific head pose flag
                - yaw (float): head rotation around vertical axis (degrees)
                - pitch (float): head rotation around horizontal axis (degrees)
                - roll (float): head tilt (degrees)
                - face_detected (bool): whether a face was found
        """
        if self._face_mesh is None:
            return self._empty_result()

        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self._face_mesh.process(rgb_frame)

            if not results.multi_face_landmarks:
                return self._empty_result(face_detected=False)

            landmarks_raw = results.multi_face_landmarks[0].landmark
            h, w = frame.shape[:2]

            landmarks_2d = np.array(
                [(lm.x * w, lm.y * h) for lm in landmarks_raw],
                dtype=np.float64,
            )

            # Estimate head pose
            pose = self._estimate_head_pose(landmarks_2d, (w, h))

            yaw = pose["yaw"]
            pitch = pose["pitch"]

            # Classify distraction based on threshold angles
            looking_away = abs(yaw) > 30 or abs(pitch) > 20

            return {
                "distracted": looking_away,
                "looking_away": looking_away,
                "yaw": yaw,
                "pitch": pitch,
                "roll": pose["roll"],
                "face_detected": True,
            }

        except Exception as e:
            print(f"DistractionDetector error: {e}")
            return self._empty_result()

    def _empty_result(self, face_detected: bool = True) -> dict:
        return {
            "distracted": False,
            "looking_away": False,
            "yaw": 0.0,
            "pitch": 0.0,
            "roll": 0.0,
            "face_detected": face_detected,
        }

    def release(self) -> None:
        if self._face_mesh is not None:
            self._face_mesh.close()
            self._face_mesh = None
