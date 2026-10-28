"""Tareas programadas (APScheduler, hora Bogotá). Reemplaza el programador de AWS (EventBridge + Lambda) y pg_cron.

- cada hora en punto: encolar una lectura por (conexión, remitente)
- cada 2 días a las 00:00: refresh de category_predictions
- diario a las 03:00: limpieza de email_jobs y processed_emails viejos
- diario a las 03:30: reconciliar daily_account_totals con transactions (red de seguridad)
- diario a las 19:00: tasas de cambio (TRM del día siguiente ya publicada, BCE del día) y
  completar las transacciones que esperaban una tasa

Los reportes ya no dependen de vistas materializadas (migración 000024): se calculan en vivo.
"""

from __future__ import annotations

from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from worker import fx, log
from worker.api_client import TopiApi
from worker.config import Settings
from worker.db import Database
from worker.mapping import dedupe_key, transform_automations_msgs
from worker.views import PREDICTION_VIEWS, refresh_views

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


def sync_fx(settings: Settings, db: Database) -> dict:
    """Tasas recientes y, si falta, el histórico (base nueva o transacciones viejas importadas);
    después completa las transacciones que habían quedado sin tasa."""
    http, today = fx.default_http(), fx.today_in(settings.timezone)
    history = fx.ensure_history(db, http, today)
    summary = fx.sync_recent(db, http, today, settings.fx_lookback_days)
    for source, result in history.items():
        summary[f"{source}_history"] = result
    filled = db.fill_pending_fx()
    logger.info("transacciones sin tasa completadas", extra={"filled": filled})
    return {**summary, "pending_fx_filled": filled}


def reconcile_totals(db: Database) -> list[str]:
    """Recalcula los usuarios cuyos totales diarios no cuadran con transactions. No debería
    encontrar ninguno: si aparece, el trigger se saltó algo y queda en el log."""
    fixed = db.reconcile_daily_totals()
    if fixed:
        logger.warning("totales diarios descuadrados: recalculados", extra={"users": len(fixed)})
    else:
        logger.info("totales diarios al día")
    return fixed


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
                      CronTrigger(minute=0, timezone=tz), id="enqueue_hourly", name="enqueue_hourly")
    scheduler.add_job(_safe("refresh_predictions", refresh_views, db, PREDICTION_VIEWS),
                      CronTrigger(day="*/2", hour=0, minute=0, timezone=tz), id="refresh_predictions", name="refresh_predictions")
    scheduler.add_job(_safe("cleanup", cleanup, settings, db),
                      CronTrigger(hour=3, minute=0, timezone=tz), id="cleanup", name="cleanup")
    scheduler.add_job(_safe("reconcile_totals", reconcile_totals, db),
                      CronTrigger(hour=3, minute=30, timezone=tz), id="reconcile_totals", name="reconcile_totals")
    if settings.fx_sync_enabled:
        scheduler.add_job(_safe("fx_sync", sync_fx, settings, db),
                          CronTrigger(hour=19, minute=0, timezone=tz), id="fx_sync", name="fx_sync")
        # también al arrancar: una base sin tasas no espera hasta las 19:00 para poder convertir
        scheduler.add_job(_safe("fx_sync_startup", sync_fx, settings, db), id="fx_sync_startup", name="fx_sync_startup")
    return scheduler
