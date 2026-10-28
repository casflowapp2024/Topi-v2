"""CLI del worker.

    python -m worker [run]             scheduler + job loop (proceso de larga duración)
    python -m worker enqueue-now       encola ya la corrida horaria (lo que haría el scheduler)
    python -m worker process-once      procesa los jobs pendientes y termina
    python -m worker refresh-views     refresca category_predictions (la única vista materializada que queda)
    python -m worker reconcile-totals  recalcula los totales diarios que no cuadren con transactions
    python -m worker fx-sync           trae las tasas de cambio recientes (lo que hace el job diario)
    python -m worker fx-backfill       tasas históricas desde la transacción más antigua
                                       (--from/--to YYYY-MM-DD para un rango; idempotente)
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import sys
from datetime import date

from worker import log
from worker.config import ConfigError, Settings


def _components(settings: Settings, processing: bool):
    from worker.api_client import TopiApi
    from worker.db import Database

    db = Database(settings.database_url, max_size=settings.concurrency + 2)
    api = TopiApi(settings.api_base_url, settings.internal_api_key)
    processor = None
    if processing:
        from worker.extractors import build_extractor
        from worker.jobs import JobProcessor

        settings.require_for_processing()
        missing = settings.missing_for_processing()
        if missing:
            log.get("worker").warning("faltan credenciales: los jobs que las necesiten fallarán sin marcar conexiones",
                                      extra={"missing": missing})
        processor = JobProcessor(settings, db, api, build_extractor(settings))
    return db, api, processor


def cmd_run(settings: Settings) -> int:
    from worker.loop import JobLoop
    from worker.scheduler import build_scheduler

    db, api, processor = _components(settings, processing=True)
    loop = JobLoop(settings, db, processor)
    scheduler = build_scheduler(settings, api, db) if settings.scheduler_enabled else None

    def stop(signum, _frame):
        log.get("worker").info("señal recibida, deteniendo", extra={"signal": signum})
        loop.stop()

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)

    if scheduler:
        scheduler.start()
        log.get("worker").info("scheduler iniciado",
                               extra={"jobs": [j.id for j in scheduler.get_jobs()], "timezone": settings.timezone})
    try:
        loop.run_forever()
    finally:
        if scheduler:
            scheduler.shutdown(wait=False)
        db.close()
    return 0


def cmd_enqueue_now(settings: Settings) -> int:
    from worker.scheduler import enqueue_hourly

    db, api, _ = _components(settings, processing=False)
    try:
        print(json.dumps(enqueue_hourly(settings, api, db)))
    finally:
        db.close()
    return 0


def cmd_process_once(settings: Settings) -> int:
    from worker.loop import JobLoop

    db, _, processor = _components(settings, processing=True)
    try:
        processed = JobLoop(settings, db, processor).run_once()
        print(json.dumps({"processed": processed}))
    finally:
        db.close()
    return 0


def cmd_refresh_views(settings: Settings) -> int:
    from worker.views import ALL_VIEWS, refresh_views

    db, _, _ = _components(settings, processing=False)
    try:
        results = refresh_views(db, ALL_VIEWS)
        print(json.dumps(results))
    finally:
        db.close()
    return 1 if any(v.startswith("error") for v in results.values()) else 0


def cmd_reconcile_totals(settings: Settings) -> int:
    from worker.scheduler import reconcile_totals

    db, _, _ = _components(settings, processing=False)
    try:
        print(json.dumps({"rebuilt_users": len(reconcile_totals(db))}))
    finally:
        db.close()
    return 0


def cmd_fx(settings: Settings, backfill: bool, start, end) -> int:
    from worker import fx

    db, _, _ = _components(settings, processing=False)
    try:
        http, today = fx.default_http(), fx.today_in(settings.timezone)
        if backfill:
            summary = fx.backfill(db, http, today, start, end)
        else:
            summary = fx.sync_recent(db, http, today, settings.fx_lookback_days)
        summary["pending_fx_filled"] = db.fill_pending_fx()
        print(json.dumps(summary))
    finally:
        db.close()
    return 1 if fx.has_errors(summary) else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m worker", description="Worker de correos de Topi")
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("run", help="scheduler + job loop")
    sub.add_parser("enqueue-now", help="encolar ya la corrida horaria")
    sub.add_parser("process-once", help="procesar los jobs pendientes y salir")
    refresh = sub.add_parser("refresh-views", help="refrescar category_predictions")
    refresh.add_argument("--all", action="store_true", help="(compatibilidad: ya no cambia nada)")
    sub.add_parser("reconcile-totals", help="recalcular totales diarios descuadrados")
    sub.add_parser("fx-sync", help="tasas de cambio recientes")
    backfill = sub.add_parser("fx-backfill", help="tasas de cambio históricas")
    backfill.add_argument("--from", dest="start", type=date.fromisoformat, help="desde (por defecto, la transacción más antigua)")
    backfill.add_argument("--to", dest="end", type=date.fromisoformat, help="hasta (por defecto, la TRM ya publicada)")
    args = parser.parse_args(argv)

    log.setup(os.environ.get("LOG_LEVEL", "INFO"))
    try:
        settings = Settings.from_env()
    except ConfigError as exc:
        log.get("worker").error(str(exc))
        return 2

    command = args.command or "run"
    try:
        if command == "run":
            return cmd_run(settings)
        if command == "enqueue-now":
            return cmd_enqueue_now(settings)
        if command == "process-once":
            return cmd_process_once(settings)
        if command == "reconcile-totals":
            return cmd_reconcile_totals(settings)
        if command in ("fx-sync", "fx-backfill"):
            return cmd_fx(settings, command == "fx-backfill", getattr(args, "start", None), getattr(args, "end", None))
        return cmd_refresh_views(settings)
    except ConfigError as exc:
        log.get("worker").error(str(exc))
        return 2


if __name__ == "__main__":
    sys.exit(main())
