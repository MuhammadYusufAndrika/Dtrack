from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    BACKEND_API_URL: str = "http://localhost:8000/api"
    BACKEND_API_KEY: str = ""
    STREAM_SOURCE: str = "none"
    VEHICLE_ID: str = "TRK001"       # String identifier used as frame-store key
    VEHICLE_DB_ID: int = 1           # Integer DB id sent to Laravel POST /ai/result
    INFERENCE_INTERVAL: float = 0.5
    REDIS_URL: str = "redis://localhost:6379/0"
    CONFIDENCE_THRESHOLD: float = 0.5
    LOG_LEVEL: str = "INFO"
    # Model YOLO khusus sabuk (kelas person_with/without_seatbelt).
    # Bila file tidak ada, diunduh otomatis saat init; gagal unduh -> fallback klasik.
    SEATBELT_MODEL_PATH: str = "models/weights/seatbelt_yolov8n.pt"
    SEATBELT_MODEL_URL: str = "https://github.com/JonathanMar/seatbelt-training/releases/download/v1.0.0/best.pt"
    # Model YOLO rokok (kelas smoke). Asap tipis -> threshold default lebih rendah.
    SMOKING_MODEL_PATH: str = "models/weights/smoking_yolo.pt"
    SMOKING_MODEL_URL: str = "https://huggingface.co/basant18/Smoking-detection-YOLO26s/resolve/main/weights/best.pt"
    SMOKING_CONFIDENCE: float = 0.4

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


def get_settings() -> Settings:
    return Settings()


settings = get_settings()
