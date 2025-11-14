# Multi-stage build for Web Reader
FROM python:3.11-slim as base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libxml2-dev \
    libxslt-dev \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/
COPY static/ ./static/

# Create data directory for file-based storage
RUN mkdir -p /app/data

# Expose port (Cloud Run will set PORT env variable)
EXPOSE 8000

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV DATA_PATH=/app/data

# Health check (checks if the app is responding)
# Note: Cloud Run has its own health checks, but this is useful for local testing
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

# Run the application
# Cloud Run will provide PORT env variable, default to 8000 for local development
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
