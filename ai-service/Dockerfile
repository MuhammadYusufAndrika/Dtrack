# =============================================================================
# Stage 1: Builder — install Python packages
# =============================================================================
FROM python:3.11-slim AS builder

WORKDIR /build

COPY requirements.txt ./

RUN pip install --no-cache-dir --user --upgrade pip && \
    pip install --no-cache-dir --user -r requirements.txt

# =============================================================================
# Stage 2: Runner — lightweight runtime image
# =============================================================================
FROM python:3.11-slim AS runner

WORKDIR /app

# System dependencies for OpenCV, MediaPipe
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy application code
COPY . .

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/inference/health')" || exit 1

CMD ["python", "run.py"]
