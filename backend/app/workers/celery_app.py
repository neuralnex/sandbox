from celery import Celery

from backend.app.core.config import settings

celery_app = Celery(
    "sandbox",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["backend.app.workers.simulation_tasks"],
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_time_limit=settings.simulation_max_runtime_seconds,
    task_ignore_result=True,
    broker_connection_retry_on_startup=True,
)
