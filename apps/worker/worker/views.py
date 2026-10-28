"""Refresh de vistas materializadas (reemplaza pg_cron de RDS).

Desde la migración 000024 los reportes se calculan en vivo (tabla daily_account_totals mantenida
por trigger + funciones analysis_*): solo queda category_predictions.

- pg_try_advisory_lock por vista: dos refresh de la misma vista nunca se solapan (otro worker o
  una corrida lenta); si el lock está tomado se omite esa vuelta.
- CONCURRENTLY solo si la vista tiene índice único y ya está poblada; si no, refresh normal
  (y queda en el log).
"""

from __future__ import annotations

import time

from psycopg import sql

from worker import log
from worker.db import Database

logger = log.get(__name__)

PREDICTION_VIEWS = ("category_predictions",)
ALL_VIEWS = PREDICTION_VIEWS

LOCK_PREFIX = "topi:refresh:"


def _can_refresh_concurrently(conn, view: str) -> bool:
    row = conn.execute(
        """
        SELECT m.ispopulated AND EXISTS (
            SELECT 1 FROM pg_index i
            JOIN pg_class c ON c.oid = i.indrelid
            WHERE c.relname = m.matviewname AND i.indisunique AND i.indpred IS NULL
        ) AS ok
        FROM pg_matviews m WHERE m.matviewname = %s
        """,
        (view,),
    ).fetchone()
    if row is None:
        raise ValueError(f"la vista materializada {view!r} no existe")
    return bool(row["ok"])


def refresh_view(db: Database, view: str) -> str:
    """Refresca una vista. Devuelve 'concurrently', 'plain' o 'skipped' (lock tomado)."""
    if view not in ALL_VIEWS:
        raise ValueError(f"vista no permitida: {view!r}")

    with db.pool.connection() as conn:
        locked = conn.execute("SELECT pg_try_advisory_lock(hashtext(%s)) AS ok", (LOCK_PREFIX + view,)).fetchone()["ok"]
        if not locked:
            logger.info("refresh omitido: otro refresh en curso", extra={"view": view})
            return "skipped"
        try:
            started = time.monotonic()
            concurrent = _can_refresh_concurrently(conn, view)
            statement = "REFRESH MATERIALIZED VIEW CONCURRENTLY {}" if concurrent else "REFRESH MATERIALIZED VIEW {}"
            if not concurrent:
                logger.warning("vista sin índice único o sin poblar: refresh normal", extra={"view": view})
            conn.execute(sql.SQL(statement).format(sql.Identifier(view)))
            mode = "concurrently" if concurrent else "plain"
            logger.info("vista refrescada", extra={"view": view, "mode": mode,
                                                   "seconds": round(time.monotonic() - started, 3)})
            return mode
        finally:
            conn.execute("SELECT pg_advisory_unlock(hashtext(%s))", (LOCK_PREFIX + view,))


def refresh_views(db: Database, views=ALL_VIEWS) -> dict[str, str]:
    """Refresca varias vistas; un error en una no impide las demás."""
    results = {}
    for view in views:
        try:
            results[view] = refresh_view(db, view)
        except Exception as exc:  # noqa: BLE001
            logger.exception("error refrescando la vista", extra={"view": view})
            results[view] = f"error: {exc}"
    return results
