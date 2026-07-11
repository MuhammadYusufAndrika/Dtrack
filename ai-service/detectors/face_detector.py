import numpy as np
import cv2
from .base_detector import BaseDetector

_HAS_MEDIAPIPE = False
try:
    import mediapipe as mp
    _HAS_MEDIAPIPE = hasattr(mp, 'solutions')
except ImportError:
    pass


class FaceDetector(BaseDetector):
    """
    Face detection using MediaPipe (preferred) or OpenCV DNN fallback.
    """

    def __init__(self, min_detection_confidence: float = 0.5):
        self.min_detection_confidence = min_detection_confidence
        self._face_detection = None
        self._use_opencv = False
        self._net = None

    def initialize(self) -> None:
        if _HAS_MEDIAPIPE:
            try:
                self._face_detection = mp.solutions.face_detection.FaceDetection(
                    model_selection=0,
                    min_detection_confidence=self.min_detection_confidence,
                )
                print("FaceDetector: using MediaPipe")
                return
            except Exception as e:
                print(f"FaceDetector: MediaPipe failed ({e}), falling back to OpenCV")

        self._use_opencv = True
        try:
            self._net = cv2.dnn.readNetFromCaffe(
                "deploy.prototxt",
                "res10_300x300_ssd_iter_140000.caffemodel",
            )
            print("FaceDetector: using OpenCV DNN")
        except Exception:
            print("FaceDetector: OpenCV DNN model not found, using Haar cascade")
            self._net = None

    def detect(self, frame: np.ndarray) -> dict:
        if self._use_opencv:
            return self._detect_opencv(frame)
        return self._detect_mediapipe(frame)

    def _detect_mediapipe(self, frame: np.ndarray) -> dict:
        if self._face_detection is None:
            return {"face_detected": False, "face_bbox": None, "relative_keypoints": None}
        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self._face_detection.process(rgb_frame)
            if not results.detections:
                return {"face_detected": False, "face_bbox": None, "relative_keypoints": None}
            detection = results.detections[0]
            bbox = detection.location_data.relative_bounding_box
            keypoints = detection.location_data.relative_keypoints
            return {
                "face_detected": True,
                "face_bbox": {"xmin": bbox.xmin, "ymin": bbox.ymin, "width": bbox.width, "height": bbox.height},
                "relative_keypoints": [{"x": kp.x, "y": kp.y} for kp in keypoints],
                "score": detection.score[0],
            }
        except Exception as e:
            print(f"FaceDetector mediapipe error: {e}")
            return {"face_detected": False, "face_bbox": None, "relative_keypoints": None}

    def _detect_opencv(self, frame: np.ndarray) -> dict:
        h, w = frame.shape[:2]
        if self._net is not None:
            blob = cv2.dnn.blobFromImage(cv2.resize(frame, (300, 300)), 1.0, (300, 300), (104.0, 177.0, 123.0))
            self._net.setInput(blob)
            detections = self._net.forward()
            for i in range(detections.shape[2]):
                confidence = detections[0, 0, i, 2]
                if confidence >= self.min_detection_confidence:
                    box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                    x1, y1, x2, y2 = box.astype(int)
                    return {
                        "face_detected": True,
                        "face_bbox": {"xmin": x1 / w, "ymin": y1 / h, "width": (x2 - x1) / w, "height": (y2 - y1) / h},
                        "relative_keypoints": None,
                        "score": float(confidence),
                    }
            return {"face_detected": False, "face_bbox": None, "relative_keypoints": None}

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        faces = cascade.detectMultiScale(gray, 1.3, 5)
        if len(faces) > 0:
            x, y, fw, fh = faces[0]
            return {
                "face_detected": True,
                "face_bbox": {"xmin": x / w, "ymin": y / h, "width": fw / w, "height": fh / h},
                "relative_keypoints": None,
                "score": 0.9,
            }
        return {"face_detected": False, "face_bbox": None, "relative_keypoints": None}

    def release(self) -> None:
        self._face_detection = None
        self._net = None
