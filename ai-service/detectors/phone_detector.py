import numpy as np
import cv2
from ultralytics import YOLO
from .base_detector import BaseDetector
from config.settings import settings


class PhoneDetector(BaseDetector):
    """
    Detects cell phone usage by the driver using YOLOv8.

    Uses the COCO pre-trained YOLOv8n (nano) model which is fast enough for
    real-time inference on CPU. The cell phone class in COCO is class 67.

    The detector filters results by confidence threshold and returns the
    highest-confidence phone detection if found.
    """

    # COCO dataset class index for cell phone
    PHONE_CLASS_ID = 67

    def __init__(self, confidence_threshold: float = None):
        self.confidence_threshold = confidence_threshold or settings.CONFIDENCE_THRESHOLD
        self._model = None

    def initialize(self) -> None:
        """
        Load the YOLOv8 nano model pre-trained on COCO dataset.

        The model file (yolov8n.pt) is downloaded automatically by Ultralytics
        on first use from their official model hub.
        """
        self._model = YOLO("yolov8n.pt")

    def detect(self, frame: np.ndarray) -> dict:
        """
        Detect cell phones in the frame using YOLOv8.

        The frame is passed through the YOLOv8 model. Detections are filtered
        to only keep class 67 (cell phone) above the confidence threshold.

        Returns:
            dict with keys:
                - phone (bool): whether a phone was detected
                - confidence (float): confidence score of the detection
                - phone_bbox (dict|None): bounding box {x1, y1, x2, y2} or None
                - detections_raw (list): all phone detections above threshold
        """
        if self._model is None:
            return {
                "phone": False,
                "confidence": 0.0,
                "phone_bbox": None,
                "detections_raw": [],
            }

        try:
            results = self._model(frame, verbose=False)

            phone_detections = []
            for result in results:
                boxes = result.boxes
                if boxes is None:
                    continue

                for i in range(len(boxes)):
                    cls_id = int(boxes.cls[i].item())
                    conf = float(boxes.conf[i].item())

                    if cls_id == self.PHONE_CLASS_ID and conf >= self.confidence_threshold:
                        x1, y1, x2, y2 = boxes.xyxy[i].tolist()
                        phone_detections.append({
                            "bbox": {
                                "x1": int(x1),
                                "y1": int(y1),
                                "x2": int(x2),
                                "y2": int(y2),
                            },
                            "confidence": conf,
                        })

            if phone_detections:
                # Return the highest confidence detection
                best = max(phone_detections, key=lambda d: d["confidence"])
                return {
                    "phone": True,
                    "confidence": best["confidence"],
                    "phone_bbox": best["bbox"],
                    "detections_raw": phone_detections,
                }

            return {
                "phone": False,
                "confidence": 0.0,
                "phone_bbox": None,
                "detections_raw": [],
            }

        except Exception as e:
            print(f"PhoneDetector error: {e}")
            return {
                "phone": False,
                "confidence": 0.0,
                "phone_bbox": None,
                "detections_raw": [],
                "error": str(e),
            }

    def release(self) -> None:
        self._model = None
