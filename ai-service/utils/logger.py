import logging
import sys
from logging.handlers import RotatingFileHandler
from config.settings import settings


def setup_logger(name: str = "FleetVision") -> logging.Logger:
    """
    Configure a logger with rotating file handler and colored console output.

    The logger writes to both stdout (colored, detailed format) and a rotating
    file (ai-service.log) for persistent logging. Log level is read from
    application settings.

    Args:
        name: Logger name, defaults to 'FleetVision'

    Returns:
        Configured logging.Logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))

    # Prevent duplicate handlers on repeated calls
    if logger.handlers:
        return logger

    # Console handler with colored output
    console_handler = logging.StreamHandler(sys.stdout)
    console_format = (
        "\033[36m%(asctime)s\033[0m | "
        "\033[32m%(levelname)-8s\033[0m | "
        "\033[33m%(name)s\033[0m | "
        "\033[35m%(module)s:%(lineno)d\033[0m | "
        "%(message)s"
    )
    console_formatter = logging.Formatter(console_format, datefmt="%Y-%m-%d %H:%M:%S")
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    # Rotating file handler (10 MB per file, keep 5 backups)
    file_handler = RotatingFileHandler(
        "ai-service.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    file_format = (
        "%(asctime)s | %(levelname)-8s | %(name)s | "
        "%(module)s:%(lineno)d | %(message)s"
    )
    file_formatter = logging.Formatter(file_format, datefmt="%Y-%m-%d %H:%M:%S")
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)

    return logger
