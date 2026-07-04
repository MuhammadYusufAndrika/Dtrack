import uvicorn
from config.settings import settings

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=5000,
        reload=True,
        log_level=settings.LOG_LEVEL.lower(),
    )
