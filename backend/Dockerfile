FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY pyproject.toml ./
COPY backend ./backend
RUN pip install --no-cache-dir .
COPY backend/gai.conf /etc/gai.conf
COPY alembic.ini ./
COPY migrations ./migrations

EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"]
