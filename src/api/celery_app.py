"""
Celery Application Configuration for JHJ Reverse Logistics DSS
Decouples heavy ML inference and TreeSHAP attribution from checkout ingress.
"""

import os
from celery import Celery

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}/0"

celery_app = Celery(
    "reverse_logistics_dss",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["src.api.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30,
    worker_prefetch_multiplier=1
)

if __name__ == "__main__":
    celery_app.start()
