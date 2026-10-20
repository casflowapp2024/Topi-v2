"""Acceso directo a Postgres (psycopg 3) solo para lo que es del worker:
email_jobs, email_sync_state, processed_emails, refresh de vistas y limpieza.
Las migraciones viven en la API (golang-migrate): el worker no migra."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

# estados de processed_emails que ya no hay que volver a extraer
DONE_STATUSES = ("transaction", "no_transaction")


@dataclass(frozen=True)
class Job:
    id: int
    payload: dict[str, Any]
    priority: int
    attempts: int
    dedupe_key: str | None


class Database:
    def __init__(self, dsn: str, max_size: int = 4, pool: ConnectionPool | None = None):
        self.pool = pool or ConnectionPool(
            dsn,
            min_size=1,
            max_size=max_size,
            kwargs={"row_factory": dict_row, "autocommit": True},
            open=True,
        )

    def close(self) -> None:
        self.pool.close()

    # ------------------------------------------------------------------ email_jobs

    def claim_job(self, worker_id: str, only_email_ids: Iterable[int] = ()) -> Job | None:
        """Toma el siguiente job pendiente (FOR UPDATE SKIP LOCKED: varios workers no chocan).
        Con `only_email_ids` (WORKER_ONLY_EMAIL_IDS) solo toma jobs de esas conexiones y no toca
        los demás."""
        email_ids = [int(i) for i in only_email_ids]
        with self.pool.connection() as conn:
            row = conn.execute(
                """
                UPDATE email_jobs
                SET status = 'running', locked_at = now(), locked_by = %(worker)s,
                    attempts = attempts + 1, updated_at = now()
                WHERE id = (
                    SELECT id FROM email_jobs
                    WHERE status = 'pending' AND run_after <= now()
                      AND (cardinality(%(email_ids)s::bigint[]) = 0
                           OR (payload->>'email_id')::bigint = ANY(%(email_ids)s::bigint[]))
                    ORDER BY priority DESC, run_after, id
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                )
                RETURNING id, payload, priority, attempts, dedupe_key
                """,
                {"worker": worker_id, "email_ids": email_ids},
            ).fetchone()
        if not row:
            return None
        return Job(row["id"], row["payload"], row["priority"], row["attempts"], row["dedupe_key"])

    def requeue_orphans(self, minutes: int) -> int:
        """Jobs `running` con locked_at viejo (el worker murió): vuelven a `pending`."""
        with self.pool.connection() as conn:
            cur = conn.execute(
                """
                UPDATE email_jobs
                SET status = 'pending', locked_at = NULL, locked_by = NULL, updated_at = now()
                WHERE status = 'running' AND locked_at < now() - make_interval(mins => %(minutes)s)
                """,
                {"minutes": minutes},
            )
            return cur.rowcount

    def complete_job(self, job_id: int) -> None:
        self._finish(job_id, "done", None)

    def fail_job(self, job_id: int, error: str) -> None:
        self._finish(job_id, "failed", error)

    def _finish(self, job_id: int, status: str, error: str | None) -> None:
        with self.pool.connection() as conn:
            conn.execute(
                """
                UPDATE email_jobs
                SET status = %(status)s, last_error = %(error)s, locked_at = NULL, updated_at = now()
                WHERE id = %(id)s
                """,
                {"id": job_id, "status": status, "error": error},
            )

    def retry_job(self, job_id: int, error: str, delay_seconds: int) -> None:
        with self.pool.connection() as conn:
            conn.execute(
                """
                UPDATE email_jobs
                SET status = 'pending', last_error = %(error)s, locked_at = NULL, locked_by = NULL,
                    run_after = now() + make_interval(secs => %(delay)s), updated_at = now()
                WHERE id = %(id)s
                """,
                {"id": job_id, "error": error, "delay": delay_seconds},
            )

    def enqueue_jobs(self, jobs: Iterable[tuple[dict[str, Any], str]], priority: int = 0) -> int:
        """Encola (payload, dedupe_key). Si ya hay un job pendiente o corriendo para la misma
        clave no se duplica (índice único parcial email_jobs_active_dedupe)."""
        inserted = 0
        with self.pool.connection() as conn:
            for payload, dedupe_key in jobs:
                cur = conn.execute(
                    """
                    INSERT INTO email_jobs (payload, priority, dedupe_key)
                    VALUES (%(payload)s, %(priority)s, %(key)s)
                    ON CONFLICT (dedupe_key) WHERE status IN ('pending','running') AND dedupe_key IS NOT NULL
                    DO NOTHING
                    """,
                    {"payload": Jsonb(payload), "priority": priority, "key": dedupe_key},
                )
                inserted += cur.rowcount
        return inserted

    # ------------------------------------------------------------------ email_sync_state

    def get_last_run(self, email_id: int, sender_email: str) -> datetime | None:
        with self.pool.connection() as conn:
            row = conn.execute(
                "SELECT last_run FROM email_sync_state WHERE email_id = %s AND sender_email = %s",
                (email_id, sender_email),
            ).fetchone()
        return row["last_run"] if row else None

    def set_last_run(self, email_id: int, sender_email: str, last_run: datetime) -> None:
        with self.pool.connection() as conn:
            conn.execute(
                """
                INSERT INTO email_sync_state (email_id, sender_email, last_run)
                VALUES (%s, %s, %s)
                ON CONFLICT (email_id, sender_email)
                DO UPDATE SET last_run = EXCLUDED.last_run, updated_at = now()
                """,
                (email_id, sender_email, last_run),
            )

    # ------------------------------------------------------------------ processed_emails

    def done_message_ids(self, email_id: int, message_ids: list[str]) -> set[str]:
        """Mensajes ya extraídos con éxito: se omiten sin llamar a Gemini.
        Los que quedaron en pending/error (p. ej. Gemini cayó) se vuelven a intentar."""
        if not message_ids:
            return set()
        with self.pool.connection() as conn:
            rows = conn.execute(
                """
                SELECT provider_message_id FROM processed_emails
                WHERE email_id = %s AND provider_message_id = ANY(%s) AND status = ANY(%s)
                """,
                (email_id, message_ids, list(DONE_STATUSES)),
            ).fetchall()
        return {row["provider_message_id"] for row in rows}

    def register_message(
        self,
        *,
        user_id: str,
        email_id: int,
        provider: str,
        message_id: str,
        sender: str | None,
        received_at: datetime | None,
        extractor: str,
    ) -> None:
        """Registra el mensaje (solo metadatos, nunca el cuerpo) antes de extraerlo."""
        with self.pool.connection() as conn:
            conn.execute(
                """
                INSERT INTO processed_emails
                    (user_id, email_id, provider, provider_message_id, sender, received_at, extractor, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending')
                ON CONFLICT (email_id, provider_message_id)
                DO UPDATE SET status = 'pending', error = NULL, extractor = EXCLUDED.extractor
                """,
                (user_id, email_id, provider, message_id, sender, received_at, extractor),
            )

    def update_message(
        self,
        email_id: int,
        message_id: str,
        status: str,
        transaction_ids: list[int] | None = None,
        error: str | None = None,
    ) -> None:
        with self.pool.connection() as conn:
            conn.execute(
                """
                UPDATE processed_emails
                SET status = %s, transaction_ids = %s, error = %s
                WHERE email_id = %s AND provider_message_id = %s
                """,
                (status, transaction_ids, error, email_id, message_id),
            )

    # ------------------------------------------------------------------ limpieza

    def cleanup(self, job_days: int, processed_days: int) -> dict[str, int]:
        with self.pool.connection() as conn:
            jobs = conn.execute(
                """
                DELETE FROM email_jobs
                WHERE status IN ('done','failed') AND updated_at < now() - make_interval(days => %s)
                """,
                (job_days,),
            ).rowcount
            processed = conn.execute(
                "DELETE FROM processed_emails WHERE created_at < now() - make_interval(days => %s)",
                (processed_days,),
            ).rowcount
        return {"email_jobs": jobs, "processed_emails": processed}
