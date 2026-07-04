import asyncio
import httpx
from typing import Optional
from models.inference_result import InferenceResult
from config.settings import settings
from utils.logger import setup_logger

logger = setup_logger(__name__)


class CommunicationService:
    """
    Handles communication with the Laravel backend API.

    Responsibilities:
    - Send inference results as HTTP POST requests
    - Health check endpoint verification
    - Retry logic with exponential backoff on failure
    - API key authentication via X-API-Key header

    Uses httpx.AsyncClient for non-blocking HTTP requests.
    """

    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self._results_sent = 0
        self._results_failed = 0

    async def initialize(self) -> bool:
        """
        Create the HTTP client and verify backend connectivity.

        Returns:
            bool: True if backend is reachable
        """
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            headers=self._get_headers(),
        )

        healthy = await self.health_check()
        if healthy:
            logger.info("Backend connection established")
        else:
            logger.warning("Backend is not reachable — results will be queued locally")
        return healthy

    def _get_headers(self) -> dict:
        """Build request headers with API key authentication."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if settings.BACKEND_API_KEY:
            headers["X-API-Key"] = settings.BACKEND_API_KEY
        return headers

    async def health_check(self) -> bool:
        """
        Check if the backend API is healthy.

        Sends GET to {BACKEND_API_URL}/health and expects a 2xx response.

        Returns:
            bool: True if backend is healthy
        """
        if self._client is None:
            return False

        try:
            response = await self._client.get(
                f"{settings.BACKEND_API_URL}/health",
                timeout=5.0,
            )
            return response.is_success
        except (httpx.HTTPError, httpx.TimeoutException) as e:
            logger.debug(f"Health check failed: {e}")
            return False

    async def send_result(
        self,
        result: InferenceResult,
        max_retries: int = 3,
    ) -> bool:
        """
        Send an inference result to the backend API.

        Implements retry with exponential backoff:
        - Retry 1: wait 1 second
        - Retry 2: wait 2 seconds
        - Retry 3: wait 4 seconds

        Args:
            result: The InferenceResult to send
            max_retries: Number of retry attempts (default: 3)

        Returns:
            bool: True if the result was sent successfully
        """
        if self._client is None:
            logger.warning("Communication client not initialized")
            return False

        payload = result.model_dump(mode="json")
        url = f"{settings.BACKEND_API_URL}/ai/result"

        for attempt in range(1, max_retries + 1):
            try:
                response = await self._client.post(url, json=payload)

                if response.is_success:
                    self._results_sent += 1
                    logger.debug(
                        f"Result sent successfully (total: {self._results_sent})"
                    )
                    return True

                logger.warning(
                    f"Backend returned {response.status_code}: {response.text[:200]}"
                )

            except httpx.TimeoutException:
                logger.warning(f"Request timed out (attempt {attempt}/{max_retries})")
            except httpx.HTTPError as e:
                logger.warning(f"HTTP error (attempt {attempt}/{max_retries}): {e}")
            except Exception as e:
                logger.error(f"Unexpected error (attempt {attempt}/{max_retries}): {e}")

            if attempt < max_retries:
                # Exponential backoff: 1s, 2s, 4s
                backoff = 2 ** (attempt - 1)
                logger.debug(f"Retrying in {backoff}s...")
                await asyncio.sleep(backoff)

        self._results_failed += 1
        logger.error(f"Failed to send result after {max_retries} attempts")
        return False

    async def register_vehicle(self, vehicle_data: dict) -> bool:
        """
        Register a vehicle for AI monitoring with the backend.

        Args:
            vehicle_data: dict with vehicle_id, plate_number, etc.

        Returns:
            bool: True if registration was successful
        """
        if self._client is None:
            return False

        try:
            response = await self._client.post(
                f"{settings.BACKEND_API_URL}/vehicles/register",
                json=vehicle_data,
            )
            return response.is_success
        except Exception as e:
            logger.error(f"Vehicle registration failed: {e}")
            return False

    def get_stats(self) -> dict:
        """Get communication statistics."""
        return {
            "results_sent": self._results_sent,
            "results_failed": self._results_failed,
            "success_rate": (
                self._results_sent / (self._results_sent + self._results_failed)
                if (self._results_sent + self._results_failed) > 0
                else 0.0
            ),
        }

    async def release(self) -> None:
        """Close the HTTP client."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None
            logger.info("Communication client released")
