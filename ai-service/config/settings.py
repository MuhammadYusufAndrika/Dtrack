from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    BACKEND_API_URL: str = "http://localhost:8000/api"
    BACKEND_API_KEY: str = ""
    STREAM_SOURCE: str = "0"
    VEHICLE_ID: str = "TRK001"
    INFERENCE_INTERVAL: float = 0.5
    REDIS_URL: str = "redis://localhost:6379/0"
    CONFIDENCE_THRESHOLD: float = 0.5
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
