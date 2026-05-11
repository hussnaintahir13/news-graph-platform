"""APScheduler-driven ingest + processing loop. Swap to Celery/BullMQ for distributed scale."""
from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from ..config import settings
from ..db import SessionLocal
from ..services import ingest_service, processing_service

log = logging.getLogger(__name__)
_scheduler: BackgroundScheduler | None = None


def _tick() -> None:
    with SessionLocal() as db:
        try:
            n_ingested = ingest_service.ingest_all(db)
            n_processed = processing_service.process_unprocessed(db, limit=100)
            log.info("scheduler tick: ingested=%s processed=%s", n_ingested, n_processed)
        except Exception as e:
            log.exception("scheduler tick failed: %s", e)


def start() -> None:
    global _scheduler
    if not settings.scheduler_enabled or _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(_tick, "interval", minutes=settings.scheduler_interval_minutes, id="news-tick",
                       max_instances=1, coalesce=True)
    _scheduler.start()
    log.info("APScheduler started, interval=%s min", settings.scheduler_interval_minutes)


def stop() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
