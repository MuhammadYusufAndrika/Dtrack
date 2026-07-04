import numpy as np
import cv2
import mediapipe as mp
from .base_detector import BaseDetector


class SeatbeltDetector(BaseDetector):
    """
    Seatbelt detection using MediaPipe Pose estimation and geometric heuristics.

    APPROACH:
    --------
    A dedicated YOLO model trained on seatbelt datasets would be ideal but requires
    custom training data. Instead, this detector uses a two-step computer vision
    approach:

    1. Use MediaPipe Pose to detect 33 body landmarks including shoulders,
       chest, and hips.
    2. Extract the region of interest (ROI) between the shoulder and the
       opposite hip — the typical path of a seatbelt diagonal strap.
    3. Within this ROI, analyze edge/line orientations using a Hough transform
       or Canny edge detection.
    4. A seatbelt strap typically appears as a diagonal line with a specific
       orientation (~45 degrees from shoulder to opposite hip). If a strong
       diagonal edge is found in the ROI with the expected angle, we classify
       the seatbelt as fastened.

    LIMITATION:
    ----------
    This heuristic approach is not as accurate as a trained deep learning model.
    For production, a custom YOLO model fine-tuned on seatbelt images is recommended.
    """

    # MediaPipe Pose landmark indices
    LANDMARK_LEFT_SHOULDER = 11
    LANDMARK_RIGHT_SHOULDER = 12
    LANDMARK_LEFT_HIP = 23
    LANDMARK_RIGHT_HIP = 24

    def __init__(self, pose_confidence: float = 0.5):
        self.pose_confidence = pose_confidence
        self._pose = None

    def initialize(self) -> None:
        self._pose = mp.solutions.pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            enable_segmentation=False,
            min_detection_confidence=self.pose_confidence,
            min_tracking_confidence=self.pose_confidence,
        )

    def _check_seatbelt_line(
        self,
        frame: np.ndarray,
        shoulder_pt: tuple,
        hip_pt: tuple,
    ) -> bool:
        """
        Analyze the region between shoulder and opposite hip for seatbelt patterns.

        The seatbelt diagonal strap typically creates a visible diagonal edge
        crossing from shoulder to opposite hip. We extract this ROI and look for
        strong diagonal edges consistent with a seatbelt.

        Args:
            frame: Original BGR frame
            shoulder_pt: (x, y) of the shoulder landmark
            hip_pt: (x, y) of the opposite side hip landmark

        Returns:
            bool: True if a seatbelt-like diagonal is detected
        """
        h, w = frame.shape[:2]

        # Convert to integer pixel coordinates
        x1, y1 = int(shoulder_pt[0]), int(shoulder_pt[1])
        x2, y2 = int(hip_pt[0]), int(hip_pt[1])

        # Ensure points are within frame bounds
        x1 = max(0, min(x1, w - 1))
        y1 = max(0, min(y1, h - 1))
        x2 = max(0, min(x2, w - 1))
        y2 = max(0, min(y2, h - 1))

        # Calculate the angle of the line from shoulder to hip
        dx = x2 - x1
        dy = y2 - y1
        angle_deg = abs(np.degrees(np.arctan2(dy, dx)))

        # A seatbelt diagonal should be roughly 40-50 degrees for a seated person
        # The actual angle depends on camera perspective
        if angle_deg < 20 or angle_deg > 70:
            # Angle not diagonal enough — seatbelt likely not visible or not present
            return False

        # Extract a padded ROI along the shoulder-hip line
        # Create a mask for the line region
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.line(mask, (x1, y1), (x2, y2), 255, thickness=12)

        # Apply Canny edge detection to find edges
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)

        # Isolate edges within the ROI mask
        roi_edges = cv2.bitwise_and(edges, mask)

        # Count edge pixels in the ROI
        edge_pixel_count = np.count_nonzero(roi_edges)

        # Expected number of edge pixels for a seatbelt line
        # The line roi has about (12 * length) pixels
        line_length = int(np.sqrt(dx ** 2 + dy ** 2))
        roi_area = 12 * line_length if line_length > 0 else 1
        edge_density = edge_pixel_count / roi_area

        # If edge density is high enough and diagonal, seatbelt is likely present
        # A fastened seatbelt creates a continuous diagonal edge
        return edge_density > 0.15

    def detect(self, frame: np.ndarray) -> dict:
        """
        Detect whether the driver is wearing a seatbelt.

        Uses MediaPipe Pose to locate body landmarks, then analyzes the
        diagonal region between shoulder and opposite hip for seatbelt-like edges.

        Returns:
            dict with keys:
                - seatbelt (bool): whether seatbelt appears to be fastened
                - method (str): always "pose_estimation"
                - confidence (float): confidence estimate (0.0-1.0)
                - landmarks_visible (bool): whether pose landmarks were found
        """
        if self._pose is None:
            return {
                "seatbelt": False,
                "method": "pose_estimation",
                "confidence": 0.0,
                "landmarks_visible": False,
            }

        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self._pose.process(rgb_frame)

            if not results.pose_landmarks:
                return {
                    "seatbelt": False,
                    "method": "pose_estimation",
                    "confidence": 0.0,
                    "landmarks_visible": False,
                }

            landmarks = results.pose_landmarks.landmark
            h, w = frame.shape[:2]

            # Get key landmark coordinates (in pixel space)
            left_shoulder = (
                landmarks[self.LANDMARK_LEFT_SHOULDER].x * w,
                landmarks[self.LANDMARK_LEFT_SHOULDER].y * h,
            )
            right_shoulder = (
                landmarks[self.LANDMARK_RIGHT_SHOULDER].x * w,
                landmarks[self.LANDMARK_RIGHT_SHOULDER].y * h,
            )
            left_hip = (
                landmarks[self.LANDMARK_LEFT_HIP].x * w,
                landmarks[self.LANDMARK_LEFT_HIP].y * h,
            )
            right_hip = (
                landmarks[self.LANDMARK_RIGHT_HIP].x * w,
                landmarks[self.LANDMARK_RIGHT_HIP].y * h,
            )

            # Check both diagonal directions:
            # Left shoulder to right hip (most common seatbelt path)
            diagonal_1 = self._check_seatbelt_line(
                frame, left_shoulder, right_hip
            )
            # Right shoulder to left hip (driver-side variant)
            diagonal_2 = self._check_seatbelt_line(
                frame, right_shoulder, left_hip
            )

            seatbelt_detected = diagonal_1 or diagonal_2

            return {
                "seatbelt": seatbelt_detected,
                "method": "pose_estimation",
                "confidence": 0.85 if seatbelt_detected else 0.6,
                "landmarks_visible": True,
            }

        except Exception as e:
            print(f"SeatbeltDetector error: {e}")
            return {
                "seatbelt": False,
                "method": "pose_estimation",
                "confidence": 0.0,
                "landmarks_visible": False,
                "error": str(e),
            }

    def release(self) -> None:
        if self._pose is not None:
            self._pose.close()
            self._pose = None
