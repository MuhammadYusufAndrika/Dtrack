"""Perekam video timelapse dari frame kamera yang masuk ke AI service.

Sumber frame: WebSocket driver web (~2 FPS), POST /inference APK (~1.25 FPS),
atau loop kontinu stream server. Semua framesudah tiba sebagai numpy array,
jadi perekaman tidak butuh perubahan di klien mana pun.

Organisasi file:  {RECORDINGS_DIR}/{vehicle_id}/{YYYYMMDDTHHMMSS}.mp4
- 1 file per segmen (default 10 menit) atau bila jeda frame > 60 detik.
- Resolusi diseragamkan (default 640x480), codec mp4v -> putar langsung di browser.
- Daftar segmen dibaca dari nama file + mtime (tanpa database/manifest).
- Retensi: file lebih tua dari RECORD_RETENTION_DAYS dihapus otomatis.
"""
import os
import re
import threading
import time
from datetime import datetime, timedelta

import cv2
import numpy as np

from config.settings import settings
from utils.logger import setup_logger

logger = setup_logger(__name__)

_VEHICLE_SAFE = re.compile(r"[^A-Za-z0-9_-]")
# mp4 (mp4v) tidak diputar Chrome Android/Desktop -> pakai WebM/VP8 yang universal.
# File .mp4 lama tetap terbaca (unduh/VLC), rekaman baru selalu .webm.
_FILENAME_RE = re.compile(r"^(\d{8}T\d{6})\.(mp4|webm)$")
_RECORD_EXT = ".webm"
_RECORD_FOURCC = "VP80"
_RECORD_MIME = {"webm": "video/webm", "mp4": "video/mp4"}
_SEGMENT_GAP_SECONDS = 60.0
# File MP4 tak bisa diputar selama writer masih terbuka (moov belum ditulis).
# Sweeper menutup segmen yang menganggur agar rekaman trip yang baru selesai
# langsung bisa diputar (±20 detik setelah frame terakhir).
_SWEEP_INTERVAL_SECONDS = 10.0
_IDLE_CLOSE_SECONDS = 20.0


def _safe_vehicle(vehicle_id: str) -> str:
    cleaned = _VEHICLE_SAFE.sub("", str(vehicle_id or "unknown"))
    return cleaned[:64] or "unknown"


def _now_stamp() -> str:
    # SELALU UTC: server (WIB) vs trip (UTC dari Laravel) vs browser (ISO-Z)
    # harus dibandingkan dalam satu acuan yang sama.
    return datetime.utcnow().strftime("%Y%m%dT%H%M%S")


def _stamp_to_dt(stamp: str) -> datetime:
    return datetime.strptime(stamp, "%Y%m%dT%H%M%S")


def _file_end_utc(path: str) -> datetime:
    return datetime.utcfromtimestamp(os.path.getmtime(path))


class _VehicleRecorder:
    """Satu writer aktif per kendaraan. Semua method dipanggil di bawah lock."""

    def __init__(self, vehicle_id: str):
        self.vehicle_id = vehicle_id
        self.writer = None
        self.segment_start = None
        self.current_file = None
        self.last_write_ts = 0.0

    def _dir(self) -> str:
        d = os.path.join(settings.RECORDINGS_DIR, self.vehicle_id)
        os.makedirs(d, exist_ok=True)
        return d

    def _close(self):
        if self.writer is not None:
            try:
                self.writer.release()
            except Exception:
                pass
            self.writer = None
            self.segment_start = None
            self.current_file = None

    def _open(self, now_ts: float):
        self._close()
        stamp = datetime.utcfromtimestamp(now_ts).strftime("%Y%m%dT%H%M%S")
        path = os.path.join(self._dir(), f"{stamp}{_RECORD_EXT}")
        fourcc = cv2.VideoWriter_fourcc(*_RECORD_FOURCC)
        writer = cv2.VideoWriter(
            path,
            fourcc,
            float(settings.RECORD_FPS),
            (int(settings.RECORD_FRAME_WIDTH), int(settings.RECORD_FRAME_HEIGHT)),
        )
        if not writer.isOpened():
            logger.warning(f"Recording: gagal membuka {path}")
            return
        self.writer = writer
        self.segment_start = now_ts
        self.current_file = path
        purge_old()  # bersih-bersih retensi sekalian tiap segmen baru

    def record(self, frame: np.ndarray, now_ts: float):
        if frame is None or frame.size == 0:
            return
        try:
            norm = cv2.resize(
                frame,
                (int(settings.RECORD_FRAME_WIDTH), int(settings.RECORD_FRAME_HEIGHT)),
                interpolation=cv2.INTER_AREA,
            )
        except Exception:
            return
        gap_new_segment = (
            self.writer is None
            or (now_ts - (self.segment_start or 0)) >= int(settings.RECORD_SEGMENT_SECONDS)
            or (now_ts - self.last_write_ts) > _SEGMENT_GAP_SECONDS
        )
        if gap_new_segment:
            self._open(now_ts)
            if self.writer is None:
                return
        try:
            self.writer.write(norm)
            self.last_write_ts = now_ts
        except Exception as e:
            logger.warning(f"Recording write gagal: {e}")
            self._close()

    def close(self):
        self._close()


class RecordingService:
    """Singleton perekam. Thread-safe; gagal rekam tidak boleh ganggu inference."""

    def __init__(self):
        self._lock = threading.Lock()
        self._recorders = {}
        self._sweeper_started = False

    @property
    def enabled(self) -> bool:
        return bool(settings.RECORDINGS_ENABLED)

    def _ensure_sweeper(self):
        if self._sweeper_started:
            return
        self._sweeper_started = True
        t = threading.Thread(target=self._sweep_loop, daemon=True)
        t.start()

    def _sweep_loop(self):
        while True:
            time.sleep(_SWEEP_INTERVAL_SECONDS)
            try:
                with self._lock:
                    now = time.time()
                    for rec in self._recorders.values():
                        if rec.writer is not None and (now - rec.last_write_ts) > _IDLE_CLOSE_SECONDS:
                            rec.close()
            except Exception:
                pass

    def record(self, vehicle_id: str, frame: np.ndarray):
        if not self.enabled:
            return
        try:
            self._ensure_sweeper()
            vid = _safe_vehicle(vehicle_id)
            with self._lock:
                rec = self._recorders.get(vid)
                if rec is None:
                    rec = _VehicleRecorder(vid)
                    self._recorders[vid] = rec
                rec.record(frame, time.time())
        except Exception as e:
            logger.warning(f"Recording gagal ({vehicle_id}): {e}")

    def list_segments(self, vehicle_id: str, from_ts=None, to_ts=None):
        """Daftar segmen MP4 + rentang waktunya. Filter overlap opsional."""
        vid = _safe_vehicle(vehicle_id)
        d = os.path.join(settings.RECORDINGS_DIR, vid)
        out = []
        try:
            names = sorted(os.listdir(d))
        except FileNotFoundError:
            return out
        for name in names:
            m = _FILENAME_RE.match(name)
            if not m:
                continue
            try:
                start = _stamp_to_dt(m.group(1))
            except ValueError:
                continue
            path = os.path.join(d, name)
            try:
                end = _file_end_utc(path)
                size = os.path.getsize(path)
            except OSError:
                continue
            if size < 1024:  # segmen gagal/korup, sembunyikan
                continue
            if from_ts and end < from_ts:
                continue
            if to_ts and start > to_ts:
                continue
            ext = name.rsplit(".", 1)[-1].lower()
            out.append({
                "file": name,
                "start": start.isoformat() + "Z",  # UTC eksplisit -> browser tampilkan lokal benar
                "end": end.isoformat() + "Z",
                "size_kb": round(size / 1024, 1),
                "mime": _RECORD_MIME.get(ext, "video/mp4"),
            })
        return out

    def resolve_path(self, vehicle_id: str, filename: str):
        """Path absolut file segmen bila valid, else None (anti path traversal)."""
        if not _FILENAME_RE.match(filename or ""):
            return None
        vid = _safe_vehicle(vehicle_id)
        path = os.path.realpath(os.path.join(settings.RECORDINGS_DIR, vid, filename))
        base = os.path.realpath(settings.RECORDINGS_DIR)
        if not path.startswith(base + os.sep):
            return None
        return path if os.path.isfile(path) else None

    def delete_file(self, vehicle_id: str, filename: str) -> bool:
        """Hapus 1 segmen. Tutup dulu bila sedang ditulis."""
        if not _FILENAME_RE.match(filename or ""):
            return False
        try:
            with self._lock:
                vid = _safe_vehicle(vehicle_id)
                rec = self._recorders.get(vid)
                if rec is not None and rec.current_file and os.path.basename(rec.current_file) == filename:
                    rec.close()
                path = os.path.realpath(os.path.join(settings.RECORDINGS_DIR, vid, filename))
                base = os.path.realpath(settings.RECORDINGS_DIR)
                if not path.startswith(base + os.sep) or not os.path.isfile(path):
                    return False
                os.remove(path)
                return True
        except OSError:
            return False

    def delete_range(self, vehicle_id: str, from_ts=None, to_ts=None) -> int:
        """Hapus semua segmen yang overlap rentang. Tanpa filter = semua milik kendaraan."""
        count = 0
        for s in self.list_segments(vehicle_id, from_ts=from_ts, to_ts=to_ts):
            if self.delete_file(vehicle_id, s["file"]):
                count += 1
        return count


_recording_service = RecordingService()


def get_recording_service() -> RecordingService:
    return _recording_service


def purge_old():
    """Hapus file lebih tua dari retensi. Aman dipanggil berkala."""
    try:
        days = int(settings.RECORD_RETENTION_DAYS)
    except (TypeError, ValueError):
        return
    if days <= 0:
        return
    cutoff = datetime.utcnow() - timedelta(days=days)
    base = settings.RECORDINGS_DIR
    try:
        vehicles = os.listdir(base)
    except FileNotFoundError:
        return
    for vid in vehicles:
        d = os.path.join(base, vid)
        if not os.path.isdir(d):
            continue
        for name in os.listdir(d):
            if not _FILENAME_RE.match(name):
                continue
            path = os.path.join(d, name)
            try:
                if _file_end_utc(path) < cutoff:
                    os.remove(path)
            except OSError:
                pass
