import numpy as np
import cv2
from typing import List, Optional, Tuple


def preprocess_frame(
    frame: np.ndarray, target_size: Tuple[int, int] = (640, 640)
) -> np.ndarray:
    """
    Preprocess a frame for model inference: resize and normalize.

    Steps:
    1. Resize the frame to the target dimensions
    2. Convert from BGR to RGB
    3. Normalize pixel values to [0, 1]

    Args:
        frame: Input BGR frame (H, W, 3)
        target_size: Desired (width, height) for output

    Returns:
        Preprocessed RGB frame as float32 array (H, W, 3) with values in [0, 1]
    """
    resized = cv2.resize(frame, target_size, interpolation=cv2.INTER_LINEAR)
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    normalized = rgb.astype(np.float32) / 255.0
    return normalized


def draw_detections(
    frame: np.ndarray,
    detections: List[dict],
    color: Tuple[int, int, int] = (0, 255, 0),
) -> np.ndarray:
    """
    Draw bounding boxes and labels for each detection on the frame.

    Each detection dict should have:
        - bbox: dict with keys x1, y1, x2, y2
        - class_name: str (optional)
        - confidence: float (optional)

    Args:
        frame: Input image to draw on
        detections: List of detection dictionaries
        color: RGB color tuple for bounding box

    Returns:
        Frame with drawn bounding boxes (modified in-place)
    """
    for det in detections:
        bbox = det.get("bbox", {})
        x1, y1 = int(bbox.get("x1", 0)), int(bbox.get("y1", 0))
        x2, y2 = int(bbox.get("x2", 0)), int(bbox.get("y2", 0))

        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

        label = det.get("class_name", "")
        confidence = det.get("confidence", 0.0)
        if confidence > 0:
            label = f"{label} {confidence:.2f}"

        if label:
            (text_w, text_h), _ = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1
            )
            cv2.rectangle(
                frame,
                (x1, y1 - text_h - 4),
                (x1 + text_w + 4, y1),
                color,
                -1,
            )
            cv2.putText(
                frame, label, (x1 + 2, y1 - 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1,
            )

    return frame


def draw_face_landmarks(
    frame: np.ndarray,
    landmarks: np.ndarray,
    color: Tuple[int, int, int] = (0, 255, 255),
) -> np.ndarray:
    """
    Visualize face mesh landmarks on the frame.

    Draws each landmark as a small circle. Also draws connections (tesselation)
    for a more informative visualization.

    Args:
        frame: Input image to draw on
        landmarks: Array of (x, y) landmark positions
        color: RGB color for landmarks

    Returns:
        Frame with face landmarks drawn
    """
    for (x, y) in landmarks:
        cv2.circle(frame, (int(x), int(y)), 1, color, -1)

    return frame


def draw_info_panel(
    frame: np.ndarray,
    inference_result: dict,
    box_color: Tuple[int, int, int] = (0, 0, 0),
    text_color: Tuple[int, int, int] = (255, 255, 255),
) -> np.ndarray:
    """
    Overlay an information panel on the frame showing all detection results.

    The panel is displayed as a semi-transparent overlay in the top-right
    corner showing driver state: seatbelt, fatigue, phone, looking_away flags
    and their confidence values.

    Args:
        frame: Input image to draw on
        inference_result: dict containing all detection results
        box_color: Background color of panel
        text_color: Text color

    Returns:
        Frame with info panel drawn
    """
    h, w = frame.shape[:2]
    panel_w = 280
    panel_h = 220
    panel_x = w - panel_w - 10
    panel_y = 10

    # Draw semi-transparent background
    overlay = frame.copy()
    cv2.rectangle(overlay, (panel_x, panel_y), (panel_x + panel_w, panel_y + panel_h), box_color, -1)
    alpha = 0.5
    frame = cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)

    # Draw border
    cv2.rectangle(frame, (panel_x, panel_y), (panel_x + panel_w, panel_y + panel_h), (100, 100, 100), 1)

    lines = []
    lines.append(("FleetVision AI", True))
    lines.append(("", True))
    lines.append((f"Seatbelt: {'YES' if inference_result.get('seatbelt') else 'NO'}",
                   inference_result.get('seatbelt', False)))
    lines.append((f"Fatigue: {'YES' if inference_result.get('fatigue') else 'NO'}",
                   inference_result.get('fatigue', False)))
    lines.append((f"Phone: {'YES' if inference_result.get('phone') else 'NO'}",
                   inference_result.get('phone', False)))
    lines.append((f"Looking Away: {'YES' if inference_result.get('looking_away') else 'NO'}",
                   inference_result.get('looking_away', False)))
    lines.append((f"Yawning: {'YES' if inference_result.get('yawning') else 'NO'}",
                   inference_result.get('yawning', False)))
    lines.append(("", True))
    lines.append((f"Face: {'OK' if inference_result.get('face_detected') else 'NONE'}", True))

    y_offset = panel_y + 20
    for text, is_good in lines:
        if not text:
            y_offset += 15
            continue
        color = (0, 255, 0) if is_good else (0, 0, 255)
        if not isinstance(is_good, bool):
            color = text_color
        cv2.putText(
            frame, text, (panel_x + 10, y_offset),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1,
        )
        y_offset += 20

    return frame


def calculate_ear(eye_landmarks: np.ndarray) -> float:
    """
    Calculate Eye Aspect Ratio (EAR) from 6 eye landmarks.

    EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)

    Where landmarks are ordered: [p1, p2, p3, p4, p5, p6] corresponding to:
        p1: outer corner, p2: top-outer, p3: top-inner,
        p4: inner corner, p5: bottom-inner, p6: bottom-outer

    Args:
        eye_landmarks: Array of 6 (x, y) landmark points

    Returns:
        EAR value (typically 0.2-0.35 for open eyes, near 0 for closed)
    """
    if len(eye_landmarks) < 6:
        return 0.0

    vertical_1 = np.linalg.norm(eye_landmarks[1] - eye_landmarks[5])
    vertical_2 = np.linalg.norm(eye_landmarks[2] - eye_landmarks[4])
    horizontal = np.linalg.norm(eye_landmarks[0] - eye_landmarks[3])

    if horizontal < 1e-6:
        return 0.0

    return float((vertical_1 + vertical_2) / (2.0 * horizontal))


def calculate_mar(mouth_landmarks: np.ndarray) -> float:
    """
    Calculate Mouth Aspect Ratio (MAR) for yawn detection.

    MAR = ||p2 - p4|| / ||p1 - p3||

    Where landmarks are: [p1, p2, p3, p4] = [left_corner, top_lip_mid,
                                               right_corner, bottom_lip_mid]

    Args:
        mouth_landmarks: Array of 4 (x, y) landmark points

    Returns:
        MAR value (> 0.6 typically indicates yawning)
    """
    if len(mouth_landmarks) < 4:
        return 0.0

    vertical = np.linalg.norm(mouth_landmarks[1] - mouth_landmarks[3])
    horizontal = np.linalg.norm(mouth_landmarks[0] - mouth_landmarks[2])

    if horizontal < 1e-6:
        return 0.0

    return float(vertical / horizontal)


def get_head_pose(
    face_landmarks: np.ndarray, image_size: Tuple[int, int]
) -> dict:
    """
    Estimate head rotation (yaw, pitch, roll) from facial landmarks.

    Uses OpenCV's solvePnP with a generic 3D face model and the detected
    2D landmarks to compute rotation angles.

    Args:
        face_landmarks: Full array of 468 face mesh landmarks in pixel coords
        image_size: (width, height) of the image

    Returns:
        dict with keys 'yaw', 'pitch', 'roll' in degrees
    """
    w, h = image_size

    # Corresponding indices in MediaPipe Face Mesh for the 6 model points
    landmark_indices = [1, 199, 33, 263, 61, 291]

    # 3D model points (in mm)
    model_points = np.array([
        [0.0, 0.0, 0.0],
        [0.0, -330.0, -65.0],
        [-225.0, 170.0, -135.0],
        [225.0, 170.0, -135.0],
        [-150.0, -150.0, -125.0],
        [150.0, -150.0, -125.0],
    ], dtype=np.float64)

    # Extract corresponding 2D image points
    image_points = np.array(
        [face_landmarks[idx] for idx in landmark_indices],
        dtype=np.float64,
    )

    # Approximate camera intrinsic matrix
    focal_length = w
    center = (w / 2, h / 2)
    camera_matrix = np.array(
        [[focal_length, 0, center[0]],
         [0, focal_length, center[1]],
         [0, 0, 1]],
        dtype=np.float64,
    )

    dist_coeffs = np.zeros((4, 1), dtype=np.float64)

    success, rotation_vector, _ = cv2.solvePnP(
        model_points, image_points, camera_matrix, dist_coeffs,
        flags=cv2.SOLVEPNP_ITERATIVE,
    )

    if not success:
        return {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}

    rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
    proj_matrix = np.hstack((rotation_matrix, np.zeros((3, 1))))
    _, _, _, _, _, euler = cv2.decomposeProjectionMatrix(proj_matrix)

    if euler is None:
        return {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}

    return {
        "yaw": float(euler[1]),
        "pitch": float(euler[0]),
        "roll": float(euler[2]),
    }
