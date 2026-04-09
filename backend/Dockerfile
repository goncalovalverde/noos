# ── Stage 1: build / install deps ────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# gcc + libpq-dev: needed to compile psycopg2 and scipy on ARM
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM python:3.12-slim

# libpq5: runtime PostgreSQL client library required by psycopg2-binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY . .

# Persistent data lives in a Docker volume mounted at /data
# DATABASE_URL and REPORTS_DIR should point there (set in .env)
RUN mkdir -p /data/reports

EXPOSE 8000

# Run Alembic migrations then start the server.
# Using a shell entrypoint so both commands run in sequence.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
