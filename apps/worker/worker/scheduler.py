"""Tareas programadas (APScheduler, hora Bogotá). Reemplaza el programador de AWS (EventBridge + Lambda) y pg_cron.

- cada hora en punto: encolar una lectura por (conexión, remitente)
- cada 5 min: refresh de las vistas de análisis
- cada 2 días a las 00:00: refresh de category_predictions
- diario a las 03:00: limpieza de email_jobs y processed_emails viejos
"""

from __future__ import annotations

from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from worker import log
from worker.api_client import TopiApi
from worker.config import Settings
from worker.db import Database
from worker.mapping import dedupe_key, transform_automations_msgs
from worker.views import FREQUENT_VIEWS, PREDICTION_VIEWS, refresh_views

logger = log.get(__name__)


def enqueue_hourly(settings: Settings, api: TopiApi, db: Database) -> dict[str, int]:
    """Encola un job por (conexión, remitente) con cuentas activas. Si ya hay uno pendiente o
    corriendo para el mismo par, no se duplica (dedupe_key)."""
    payloads = transform_automations_msgs(api.list_accounts())
    allowed = [p for p in payloads if settings.allows_email(p["email_id"])]
    for payload in allowed:
        payload.setdefault("onboarding", False)

    inserted = db.enqueue_jobs(((p, dedupe_key(p)) for p in allowed), priority=0)
    summary = {"groups": len(payloads), "allowed": len(allowed), "enqueued": inserted,
               "already_queued": len(allowed) - inserted}
    logger.info("encolado horario", extra=summary)
    return summary


def cleanup(settings: Settings, db: Database) -> dict[str, int]:
    deleted = db.cleanup(settings.job_retention_days, settings.processed_email_retention_days)
    logger.info("limpieza", extra=deleted)
    return deleted


def _safe(name, fn, *args):
    def run():
        try:
            fn(*args)
        except Exception:  # noqa: BLE001 - el scheduler sigue con la próxima vuelta
            logger.exception("tarea programada falló", extra={"task": name})
    run.__name__ = name
    return run


def build_scheduler(settings: Settings, api: TopiApi, db: Database) -> BackgroundScheduler:
    tz = ZoneInfo(settings.timezone)
    scheduler = BackgroundScheduler(
        timezone=tz,
        job_defaults={"coalesce": True, "max_instances": 1, "misfire_grace_time": 300},
    )
    scheduler.add_job(_safe("enqueue_hourly", enqueue_hourly, settings, api, db),
                      CronTrigger(minute=0, timezone=tz), id="enqueue_hourly")
    scheduler.add_job(_safe("refresh_views", refresh_views, db, FREQUENT_VIEWS),
                      IntervalTrigger(minutes=5, timezone=tz), id="refresh_views")
    scheduler.add_job(_safe("refresh_predictions", refresh_views, db, PREDICTION_VIEWS),
                      CronTrigger(day="*/2", hour=0, minute=0, timezone=tz), id="refresh_predictions")
    scheduler.add_job(_safe("cleanup", cleanup, settings, db),
                      CronTrigger(hour=3, minute=0, timezone=tz), id="cleanup")
    return scheduler
