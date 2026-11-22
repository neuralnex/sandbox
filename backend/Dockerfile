FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY backend/gai.conf /etc/gai.conf
COPY pyproject.toml ./
COPY backend ./backend
RUN pip install --no-cache-dir --retries 10 --timeout 60 .
COPY alembic.ini ./
COPY migrations ./migrations

EXPOSE 8000
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
