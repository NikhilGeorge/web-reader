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
COPY .env.example .env

# Create data directory for file-based storage
RUN mkdir -p /app/data

# Expose port
EXPOSE 8000

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV DATA_PATH=/app/data

# Health check (checks if the app is responding)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/auth/config')"

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
