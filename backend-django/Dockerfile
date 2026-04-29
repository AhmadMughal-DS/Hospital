# ─────────────────────────────────────────────────────────────────
# MediCore HMS — Production Backend Dockerfile
# Multi-stage: builder → slim runtime
# ─────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --user -r requirements.txt

# ─── Runtime Stage ───────────────────────────────────────────────
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/root/.local/bin:$PATH"

WORKDIR /app

# Only runtime OS deps (libpq for psycopg2, curl for health check)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl \
 && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local

# Copy source code
COPY . .

# Collect static files (needs dummy SECRET_KEY)
RUN SECRET_KEY=collectstatic-dummy \
    python manage.py collectstatic --noinput --clear 2>/dev/null || true

EXPOSE 8000

# Use gunicorn in production (installed via requirements.txt)
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "4", \
     "--threads", "2", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
