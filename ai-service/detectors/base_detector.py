from abc import ABC, abstractmethod
import numpy as np


class BaseDetector(ABC):
    """Abstract base class for all AI detectors in FleetVision AI."""

    @abstractmethod
    def detect(self, frame: np.ndarray) -> dict:
        """Process a frame and return detection results as dict.

        Args:
            frame: BGR image from OpenCV as numpy array (H, W, 3)

        Returns:
            dict: Detection results with detector-specific keys
        """
        pass

    @abstractmethod
    def initialize(self) -> None:
        """Initialize detector resources (models, loaded weights, etc.)."""
        pass

    @abstractmethod
    def release(self) -> None:
        """Release detector resources (close models, free memory)."""
        pass
