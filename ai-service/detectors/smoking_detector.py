import os
import urllib.request
import numpy as np
import cv2
from collections import deque
from ultralytics import YOLO
from .base_detector import BaseDetector
from config.settings import settings


class SmokingDetector(BaseDetector):
    """
    Deteksi merokok saat mengemudi memakai YOLO terlatih khusus.

    Model mendeteksi ASAP rokok (kelas `smoke`) — asap yang terlihat saat
    sopir menghembuskan rokok/vape. Asap tipis dan berkedip antar-frame,
    jadi output dilewatkan majority vote temporal agar stabil.

    Bila weights tidak ada, dicoba unduh otomatis sekali; bila tetap tidak
    ada, detector nonaktif dengan aman (selalu False, tanpa crash).

    Returns:
        dict with keys:
            - smoking (bool): apakah terdeteksi merokok
            - confidence (float): keyakinan vote 0..1
            - smoke_bbox (dict|None): bbox {x1, y1, x2, y2} atau None
            - detections_raw (list): semua deteksi di atas threshold
    """

    SMOKE_CLASS_ID = 0

    def __init__(self, confidence_threshold: float = None, smooth_window: int = 5):
        self.confidence_threshold = (
            confidence_threshold if confidence_threshold is not None
            else settings.SMOKING_CONFIDENCE
        )
        self.smooth_window = max(3, smooth_window)
        self._model = None
        self._history = deque(maxlen=self.smooth_window)
        self._last_stable = False
        self._disabled = False

    def initialize(self) -> None:
        """Load model YOLO rokok (unduh otomatis bila belum ada)."""
        try:
            path = settings.SMOKING_MODEL_PATH
            if not os.path.isfile(path):
                try:
                    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
                    print(f"SmokingDetector: downloading weights from {settings.SMOKING_MODEL_URL} ...")
                    urllib.request.urlretrieve(settings.SMOKING_MODEL_URL, path + ".tmp")
                    os.replace(path + ".tmp", path)
                    print(f"SmokingDetector: saved {path}")
                except Exception as e:
                    print(f"SmokingDetector: download failed ({e}) — disabled")
                    self._disabled = True
                    return
            self._model = YOLO(path)
            print("SmokingDetector: using YOLO smoking model")
        except Exception as e:
            print(f"SmokingDetector: init failed ({e}) — disabled")
            self._disabled = True

    def _raw_detect(self, frame: np.ndarray) -> dict:
        if self._disabled or self._model is None:
            return {"smoking": None, "confidence": 0.0,
                    "smoke_bbox": None, "detections_raw": []}
        try:
            # imgsz 480: model 60MB ~2x lebih cepat dari 640, asap tetap kedetek.
            results = self._model(frame, verbose=False, imgsz=480)
            smoke_detections = []
            for result in results:
                boxes = result.boxes
                if boxes is None:
                    continue
                for i in range(len(boxes)):
                    cls_id = int(boxes.cls[i].item())
                    conf = float(boxes.conf[i].item())
                    if cls_id == self.SMOKE_CLASS_ID and conf >= self.confidence_threshold:
                        x1, y1, x2, y2 = boxes.xyxy[i].tolist()
                        smoke_detections.append({
                            "bbox": {"x1": int(x1), "y1": int(y1),
                                     "x2": int(x2), "y2": int(y2)},
                            "confidence": conf,
                        })
            if smoke_detections:
                best = max(smoke_detections, key=lambda d: d["confidence"])
                return {"smoking": True, "confidence": best["confidence"],
                        "smoke_bbox": best["bbox"], "detections_raw": smoke_detections}
            return {"smoking": False, "confidence": 0.0,
                    "smoke_bbox": None, "detections_raw": []}
        except Exception as e:
            print(f"SmokingDetector error: {e}")
            return {"smoking": None, "confidence": 0.0,
                    "smoke_bbox": None, "detections_raw": []}

    def detect(self, frame: np.ndarray) -> dict:
        raw = self._raw_detect(frame)
        vote = raw.get("smoking")  # True / False / None(unknown)
        self._history.append(vote)

        known = [v for v in self._history if v is not None]
        if not known:
            stable, conf = self._last_stable, 0.0
        else:
            trues = sum(1 for v in known if v)
            falses = len(known) - trues
            if trues > falses:
                stable = True
            elif falses > trues:
                stable = False
            else:
                stable = self._last_stable
            conf = max(trues, falses) / len(known)
            self._last_stable = stable

        out = dict(raw)
        out["smoking"] = bool(stable)
        out["confidence"] = round(float(conf), 2)
        return out

    def release(self) -> None:
        self._model = None
        self._history.clear()
