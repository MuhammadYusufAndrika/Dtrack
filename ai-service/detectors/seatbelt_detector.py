import os
import urllib.request
import numpy as np
import cv2
from collections import deque
from .base_detector import BaseDetector
from config.settings import settings

_HAS_MEDIAPIPE = False
try:
    import mediapipe as mp
    _HAS_MEDIAPIPE = hasattr(mp, 'solutions')
except ImportError:
    pass


def _download_if_missing(url: str, path: str) -> bool:
    """Unduh weights bila belum ada. Return True jika file siap dipakai."""
    if os.path.isfile(path):
        return True
    try:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        print(f"SeatbeltDetector: downloading weights from {url} ...")
        urllib.request.urlretrieve(url, path + ".tmp")
        os.replace(path + ".tmp", path)
        print(f"SeatbeltDetector: saved {path}")
        return True
    except Exception as e:
        print(f"SeatbeltDetector: download failed ({e})")
        try:
            if os.path.isfile(path + ".tmp"):
                os.remove(path + ".tmp")
        except Exception:
            pass
        return False


class SeatbeltDetector(BaseDetector):
    """
    Seatbelt detection — YOLO khusus sebagai primer, klasik sebagai fallback:

    PRIMER: YOLOv8n terlatih khusus (kelas person_with_seatbelt /
    person_without_seatbelt, mAP50 82.3%). Jauh lebih akurat daripada
    analisis edge untuk variasi baju, cahaya, dan sudut kamera.

    FALLBACK: pipeline klasik (MediaPipe Pose visibility-gated + CLAHE +
    Canny adaptif + Hough) bila model tidak ada / tidak menemukan orang.

    Di atas keduanya: majority vote temporal anti-kedip + status "unknown"
    menahan nilai stabil terakhir (bukan memaksa False = alert palsu).

    Output tetap kompatibel: {"seatbelt": bool, "method": str,
    "confidence": float, "landmarks_visible": bool}
    """

    # Kelas model YOLO khusus sabuk
    CLS_WITHOUT = 0  # person_without_seatbelt
    CLS_WITH = 1     # person_with_seatbelt

    LANDMARK_LEFT_SHOULDER = 11
    LANDMARK_RIGHT_SHOULDER = 12
    LANDMARK_LEFT_HIP = 23
    LANDMARK_RIGHT_HIP = 24

    ANGLE_MIN = 15.0
    ANGLE_MAX = 80.0
    VIS_THRESHOLD = 0.5
    DENSITY_HIGH = 0.12
    DENSITY_LOW = 0.06
    HOUGH_MIN_SUPPORT = 2

    def __init__(self, pose_confidence: float = 0.5, smooth_window: int = 5,
                 yolo_fallback: bool = True):
        self.pose_confidence = pose_confidence
        self.smooth_window = max(3, smooth_window)
        self.yolo_fallback = yolo_fallback  # fallback klasik bila YOLO bisu
        self.confidence_threshold = settings.CONFIDENCE_THRESHOLD
        self._pose = None
        self._use_opencv = False
        self._yolo = None        # YOLO COCO kecil untuk ROI fallback klasik
        self._belt_model = None  # YOLO khusus sabuk (primer)
        self._history = deque(maxlen=self.smooth_window)
        self._last_stable = False

    def initialize(self) -> None:
        if _HAS_MEDIAPIPE:
            try:
                self._pose = mp.solutions.pose.Pose(
                    static_image_mode=False,
                    model_complexity=1,
                    enable_segmentation=False,
                    min_detection_confidence=self.pose_confidence,
                    min_tracking_confidence=self.pose_confidence,
                )
            except Exception as e:
                print(f"SeatbeltDetector: MediaPipe failed ({e})")
                self._pose = None

        if self._pose is None:
            self._use_opencv = True

        # Model YOLO khusus sabuk (primer)
        try:
            if _download_if_missing(settings.SEATBELT_MODEL_URL,
                                    settings.SEATBELT_MODEL_PATH):
                from ultralytics import YOLO
                self._belt_model = YOLO(settings.SEATBELT_MODEL_PATH)
                print("SeatbeltDetector: primary = YOLO seatbelt model")
            else:
                print("SeatbeltDetector: primary = classical pipeline (no weights)")
        except Exception as e:
            print(f"SeatbeltDetector: YOLO seatbelt model failed ({e}), classical primary")
            self._belt_model = None

    # ------------------------------------------------------------------ util
    @staticmethod
    def _adaptive_edges(gray: np.ndarray) -> np.ndarray:
        """CLAHE + Canny dengan threshold mengikuti median brightness."""
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        norm = clahe.apply(gray)
        med = float(np.median(norm))
        sigma = 0.33
        lower = max(0, int((1.0 - sigma) * med))
        upper = min(255, int((1.0 + sigma) * med))
        if upper - lower < 20:  # frame terlalu datar (gelap total/putih total)
            lower, upper = 50, 150
        return cv2.Canny(norm, lower, upper)

    @staticmethod
    def _diag_angle(p1, p2) -> float:
        return abs(float(np.degrees(np.arctan2(p2[1] - p1[1], p2[0] - p1[0]))))

    def _score_diagonal(self, edges: np.ndarray, p1, p2):
        """Skor satu diagonal bahu->pinggul berlawanan.

        Return True (belt), False (jelas tidak ada), atau None (tak bisa dinilai).
        """
        h, w = edges.shape[:2]
        x1, y1 = int(round(p1[0])), int(round(p1[1]))
        x2, y2 = int(round(p2[0])), int(round(p2[1]))
        x1, y1 = max(0, min(x1, w - 1)), max(0, min(y1, h - 1))
        x2, y2 = max(0, min(x2, w - 1)), max(0, min(y2, h - 1))

        length = float(np.hypot(x2 - x1, y2 - y1))
        if length < 0.15 * min(h, w):
            return None  # terlalu kecil untuk dinilai

        angle = self._diag_angle((x1, y1), (x2, y2))
        if angle < self.ANGLE_MIN or angle > self.ANGLE_MAX:
            return False

        thick = int(max(8, min(20, length // 28)))
        band = np.zeros((h, w), dtype=np.uint8)
        cv2.line(band, (x1, y1), (x2, y2), 255, thickness=thick)
        edge_pixel_count = int(np.count_nonzero(cv2.bitwise_and(edges, band)))
        density = edge_pixel_count / max(1.0, thick * length)

        # Garis Hough pendukung: sejajar diagonal & dekat garisnya.
        support = 0
        try:
            pad = thick * 2
            rx1, ry1 = max(0, min(x1, x2) - pad), max(0, min(y1, y2) - pad)
            rx2, ry2 = min(w, max(x1, x2) + pad), min(h, max(y1, y2) + pad)
            crop = edges[ry1:ry2, rx1:rx2]
            if crop.size > 0:
                lines = cv2.HoughLinesP(
                    crop, 1, np.pi / 180, threshold=20,
                    minLineLength=int(0.3 * length), maxLineGap=8,
                )
                if lines is not None:
                    for line in lines:
                        lx1, ly1, lx2, ly2 = (float(v) for v in line[0])
                        lang = abs(float(np.degrees(np.arctan2(ly2 - ly1, lx2 - lx1))))
                        if abs(lang - angle) > 12:
                            continue
                        # jarak titik tengah garis ke diagonal harus dekat
                        mx, my = (lx1 + lx2) / 2 + rx1, (ly1 + ly2) / 2 + ry1
                        dist = abs((y2 - y1) * mx - (x2 - x1) * my + x2 * y1 - y2 * x1) / max(1.0, length)
                        if dist <= thick:
                            support += 1
        except Exception:
            pass

        if density >= self.DENSITY_HIGH:
            return True
        if support >= self.HOUGH_MIN_SUPPORT and density >= self.DENSITY_LOW:
            return True
        return False

    # -------------------------------------------------------------- pipelines
    @staticmethod
    def _brighten(frame: np.ndarray) -> np.ndarray:
        """Naikkan exposure via CLAHE di kanal L (LAB) untuk frame kabin malam."""
        try:
            lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            return cv2.cvtColor(cv2.merge([clahe.apply(l), a, b]), cv2.COLOR_LAB2BGR)
        except Exception:
            return frame

    def _yolo_predict(self, frame: np.ndarray):
        """Satu pass YOLO. Return (True/False/None, confidence)."""
        if self._belt_model is None:
            return None, 0.0
        try:
            results = self._belt_model(frame, verbose=False)
            best_with, best_without = 0.0, 0.0
            for r in results:
                if r.boxes is None:
                    continue
                for i in range(len(r.boxes)):
                    cls_id = int(r.boxes.cls[i].item())
                    conf = float(r.boxes.conf[i].item())
                    if conf < self.confidence_threshold:
                        continue
                    if cls_id == self.CLS_WITH:
                        best_with = max(best_with, conf)
                    elif cls_id == self.CLS_WITHOUT:
                        best_without = max(best_without, conf)
            if best_with <= 0 and best_without <= 0:
                return None, 0.0  # tak ada orang terdeteksi
            if best_with >= best_without:
                return True, best_with
            return False, best_without
        except Exception as e:
            print(f"SeatbeltDetector YOLO error: {e}")
            return None, 0.0

    def _raw_yolo_belt(self, frame: np.ndarray):
        """Primer YOLO + TTA terang. Return True/False/None(butuh fallback)."""
        belt, conf = self._yolo_predict(frame)
        if belt is True:
            return True, conf, "yolo_seatbelt"
        # Coba versi terang (kabin malam / backlight): murah (~0.1 dtk).
        belt_b, conf_b = self._yolo_predict(self._brighten(frame))
        if belt_b is True:
            return True, conf_b, "yolo_seatbelt+bright"
        if belt is False or belt_b is False:
            return False, max(conf, conf_b), "yolo_seatbelt"
        return None, 0.0, "yolo_seatbelt"

    def _raw_classical(self, frame: np.ndarray, gray: np.ndarray,
                       edges: np.ndarray) -> dict:
        """Fallback klasik. seatbelt bisa True/False/None (unknown)."""
        if self._pose is not None and not self._use_opencv:
            try:
                results = self._pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            except Exception as e:
                print(f"SeatbeltDetector mediapipe error: {e}")
                results = None
            if results is not None and results.pose_landmarks:
                h, w = frame.shape[:2]
                lm = results.pose_landmarks.landmark
                pts = {
                    "ls": (lm[self.LANDMARK_LEFT_SHOULDER].x * w,
                           lm[self.LANDMARK_LEFT_SHOULDER].y * h,
                           lm[self.LANDMARK_LEFT_SHOULDER].visibility),
                    "rs": (lm[self.LANDMARK_RIGHT_SHOULDER].x * w,
                           lm[self.LANDMARK_RIGHT_SHOULDER].y * h,
                           lm[self.LANDMARK_RIGHT_SHOULDER].visibility),
                    "lh": (lm[self.LANDMARK_LEFT_HIP].x * w,
                           lm[self.LANDMARK_LEFT_HIP].y * h,
                           lm[self.LANDMARK_LEFT_HIP].visibility),
                    "rh": (lm[self.LANDMARK_RIGHT_HIP].x * w,
                           lm[self.LANDMARK_RIGHT_HIP].y * h,
                           lm[self.LANDMARK_RIGHT_HIP].visibility),
                }
                votes = []
                for a, b in (("ls", "rh"), ("rs", "lh")):
                    if pts[a][2] >= self.VIS_THRESHOLD and pts[b][2] >= self.VIS_THRESHOLD:
                        s = self._score_diagonal(edges, pts[a][:2], pts[b][:2])
                        if s is not None:
                            votes.append(s)
                if votes:
                    belt = any(votes)
                    return {"seatbelt": belt, "method": "pose_estimation",
                            "confidence": 0.85 if belt else 0.7,
                            "landmarks_visible": True}
            elif results is not None:
                pass  # pose tidak menemukan orang -> coba YOLO ROI di bawah

        if self.yolo_fallback:
            return self._detect_yolo_person(frame, gray)

        if self._use_opencv:
            return self._detect_opencv_legacy(frame, edges)

        return {"seatbelt": None, "method": "no_evidence",
                "confidence": 0.0, "landmarks_visible": False}

    def _raw_detect(self, frame: np.ndarray) -> dict:
        """Ensemble recall-first: YOLO (asli+terang) ATAU klasik.

        - Salah satu bilang True -> True (sabuk jangan sampai luput).
        - Keduanya False -> False. Semua unknown -> None (tahan status lama).
        """
        h, w = frame.shape[:2]
        if h < 160 or w < 160:
            return {"seatbelt": None, "method": "frame_too_small",
                    "confidence": 0.0, "landmarks_visible": False}

        # 1) YOLO khusus (asli + versi terang)
        yolo_belt, yolo_conf, yolo_method = self._raw_yolo_belt(frame)
        if yolo_belt is True:
            return {"seatbelt": True, "method": yolo_method,
                    "confidence": round(float(yolo_conf), 2),
                    "landmarks_visible": False}

        # 2) Klasik selalu dihitung sebagai pembanding (bukan cuma fallback).
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        edges = self._adaptive_edges(gray)
        cls = self._raw_classical(frame, gray, edges)
        cls_belt, cls_method = cls.get("seatbelt"), cls.get("method", "classical")
        if cls_belt is True:
            return {"seatbelt": True, "method": f"{cls_method}+yolo_checked",
                    "confidence": max(float(cls.get("confidence", 0.6)), float(yolo_conf)),
                    "landmarks_visible": bool(cls.get("landmarks_visible", False))}

        if yolo_belt is False or cls_belt is False:
            return {"seatbelt": False, "method": f"{yolo_method}+{cls_method}",
                    "confidence": round(float(max(yolo_conf, cls.get("confidence", 0.0))), 2),
                    "landmarks_visible": bool(cls.get("landmarks_visible", False))}

        return {"seatbelt": None, "method": f"{yolo_method}+{cls_method}",
                "confidence": 0.0, "landmarks_visible": False}

    def _ensure_yolo(self):
        if self._yolo is None:
            from ultralytics import YOLO
            self._yolo = YOLO("yolov8n.pt")
        return self._yolo

    def _detect_yolo_person(self, frame: np.ndarray, gray: np.ndarray) -> dict:
        """Fallback: crop torso orang terbesar (YOLO COCO class 0),
        cari garis diagonal sabuk di dalamnya."""
        h, w = frame.shape[:2]
        try:
            model = self._ensure_yolo()
            results = model(frame, verbose=False, classes=[0])
            best = None
            best_area = 0
            for r in results:
                if r.boxes is None:
                    continue
                for i in range(len(r.boxes)):
                    if float(r.boxes.conf[i].item()) < 0.4:
                        continue
                    x1, y1, x2, y2 = (int(v) for v in r.boxes.xyxy[i].tolist())
                    area = max(0, x2 - x1) * max(0, y2 - y1)
                    if area > best_area:
                        best_area = area
                        best = (x1, y1, x2, y2)
        except Exception as e:
            print(f"SeatbeltDetector YOLO fallback error: {e}")
            return {"seatbelt": None, "method": "yolo_error",
                    "confidence": 0.0, "landmarks_visible": False}

        if best is None:
            return {"seatbelt": None, "method": "no_person",
                    "confidence": 0.0, "landmarks_visible": False}

        x1, y1, x2, y2 = best
        pad = int(0.1 * (x2 - x1))
        x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
        x2, y2 = min(w, x2 + pad), min(h, y2 + pad)
        # Sabuk ada di torso atas (bahu -> pinggang).
        torso_h = int((y2 - y1) * 0.7)
        crop = gray[y1:y1 + torso_h, x1:x2]
        if crop.size == 0 or torso_h < 60:
            return {"seatbelt": None, "method": "roi_too_small",
                    "confidence": 0.0, "landmarks_visible": False}

        edges = self._adaptive_edges(crop)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=25,
                                minLineLength=int(0.35 * torso_h), maxLineGap=10)
        belt_like = 0
        if lines is not None:
            for line in lines:
                lx1, ly1, lx2, ly2 = (float(v) for v in line[0])
                ang = abs(float(np.degrees(np.arctan2(ly2 - ly1, lx2 - lx1))))
                if 20 < ang < 70:
                    belt_like += 1

        if belt_like >= 1:
            return {"seatbelt": True, "method": "yolo_person_roi",
                    "confidence": 0.65, "landmarks_visible": False}
        return {"seatbelt": False, "method": "yolo_person_roi",
                "confidence": 0.4, "landmarks_visible": False}

    def _detect_opencv_legacy(self, frame: np.ndarray, edges: np.ndarray) -> dict:
        h, w = frame.shape[:2]
        roi = edges[int(h * 0.15):int(h * 0.85), int(w * 0.1):int(w * 0.9)]
        lines = cv2.HoughLinesP(roi, 1, np.pi / 180, threshold=50,
                                minLineLength=50, maxLineGap=10)
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = (float(v) for v in line[0])
                angle = abs(float(np.degrees(np.arctan2(y2 - y1, x2 - x1))))
                if 25 < angle < 65:
                    return {"seatbelt": True, "method": "edge_analysis",
                            "confidence": 0.6, "landmarks_visible": False}
        return {"seatbelt": None, "method": "edge_analysis",
                "confidence": 0.3, "landmarks_visible": False}

    # ------------------------------------------------------------------ detect
    def detect(self, frame: np.ndarray) -> dict:
        raw = self._raw_detect(frame)
        vote = raw.get("seatbelt")  # True / False / None(unknown)
        self._history.append(vote)

        known = [v for v in self._history if v is not None]
        if not known:
            stable, conf = self._last_stable, 0.3
        else:
            trues = sum(1 for v in known if v)
            falses = len(known) - trues
            if trues > falses:
                stable = True
            elif falses > trues:
                stable = False
            else:
                stable = self._last_stable  # seri -> tahan terakhir
            conf = max(trues, falses) / len(known)
            self._last_stable = stable

        return {
            "seatbelt": bool(stable),
            "method": raw.get("method", "unknown") + "+temporal",
            "confidence": round(float(conf), 2),
            "landmarks_visible": bool(raw.get("landmarks_visible", False)),
        }

    def release(self) -> None:
        self._pose = None
        self._yolo = None
        self._belt_model = None
        self._history.clear()
