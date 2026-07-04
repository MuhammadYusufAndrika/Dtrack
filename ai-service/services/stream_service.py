import cv2
import numpy as np
from typing import Optional, Union
from config.settings import settings
from utils.logger import setup_logger

logger = setup_logger(__name__)


class StreamService:
    """
    Manages video stream input from various sources.

    Supported sources:
    - Webcam: integer device ID (e.g., 0, 1)
    - IP Camera: RTSP/HTTP URL string
    - Video file: local file path
    - Image file: single image (yields one frame)

    The service abstracts the source type and provides a consistent
    read_frame() interface for the detection pipeline.
    """

    def __init__(self, source: Optional[Union[str, int]] = None):
        self._source = source if source is not None else settings.STREAM_SOURCE
        self._cap: Optional[cv2.VideoCapture] = None
        self._is_image = False
        self._image_frame: Optional[np.ndarray] = None

    def initialize(self) -> bool:
        """
        Open the video stream based on the configured source.

        Returns:
            bool: True if the stream opened successfully
        """
        try:
            # Try to parse source as integer (webcam device ID)
            source_int = int(self._source)
            self._cap = cv2.VideoCapture(source_int)
            self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            self._cap.set(cv2.CAP_PROP_FPS, 30)
        except (ValueError, TypeError):
            # Source is a string — could be URL or file path
            source_str = str(self._source)

            # Check if it's an image file (single frame)
            if source_str.lower().endswith((".jpg", ".jpeg", ".png", ".bmp", ".tiff")):
                self._image_frame = cv2.imread(source_str)
                if self._image_frame is not None:
                    self._is_image = True
                    logger.info(f"Loaded image source: {source_str}")
                    return True
                else:
                    logger.error(f"Failed to load image: {source_str}")
                    return False

            # Assume it's a video file or IP camera URL
            self._cap = cv2.VideoCapture(source_str)

        if self._cap is not None and not self._cap.isOpened():
            logger.error(f"Failed to open stream source: {self._source}")
            return False

        logger.info(f"Stream initialized from source: {self._source}")
        return True

    def read_frame(self) -> Optional[np.ndarray]:
        """
        Read the next frame from the video stream.

        For image sources, the same frame is returned on every call
        (useful for testing).

        Returns:
            np.ndarray: BGR frame, or None if stream ended / error
        """
        if self._is_image:
            return self._image_frame.copy() if self._image_frame is not None else None

        if self._cap is None or not self._cap.isOpened():
            return None

        ret, frame = self._cap.read()
        if not ret or frame is None:
            logger.warning("End of stream or read error")
            return None

        return frame

    def get_properties(self) -> dict:
        """
        Get stream properties (width, height, FPS, total frames).

        Returns:
            dict with keys: width, height, fps, frame_count, source_type
        """
        if self._is_image and self._image_frame is not None:
            h, w = self._image_frame.shape[:2]
            return {
                "width": w,
                "height": h,
                "fps": 0,
                "frame_count": 1,
                "source_type": "image",
            }

        if self._cap is None:
            return {
                "width": 0,
                "height": 0,
                "fps": 0,
                "frame_count": 0,
                "source_type": "none",
            }

        return {
            "width": int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            "height": int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
            "fps": self._cap.get(cv2.CAP_PROP_FPS),
            "frame_count": int(self._cap.get(cv2.CAP_PROP_FRAME_COUNT)),
            "source_type": "video",
        }

    def release(self) -> None:
        """Release the video stream and free resources."""
        if self._cap is not None:
            self._cap.release()
            self._cap = None
        self._image_frame = None
        self._is_image = False
        logger.info("Stream released")
