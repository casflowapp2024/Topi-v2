"""Job loop: toma jobs de email_jobs cada WORKER_POLL_SECONDS (reemplaza SQS)."""

from __future__ import annotations

import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor

from worker import log
from worker.config import Settings
from worker.db import Database
from worker.jobs import JobProcessor

logger = log.get(__name__)

ORPHAN_CHECK_SECONDS = 60


class JobLoop:
    def __init__(self, settings: Settings, db: Database, processor: JobProcessor):
        self.settings = settings
        self.db = db
        self.processor = processor
        self.stop_event = threading.Event()
        self._last_orphan_check = 0.0

    def _requeue_orphans(self) -> None:
        if time.monotonic() - self._last_orphan_check < ORPHAN_CHECK_SECONDS:
            return
        self._last_orphan_check = time.monotonic()
        count = self.db.requeue_orphans(self.settings.orphan_minutes)
        if count:
            logger.warning("jobs huérfanos devueltos a pending", extra={"count": count})

    def _claim(self):
        return self.db.claim_job(self.settings.worker_id, self.settings.only_email_ids)

    def run_once(self) -> int:
        """Procesa jobs disponibles hasta vaciar la cola (secuencial). Devuelve cuántos procesó."""
        self._last_orphan_check = 0.0
        self._requeue_orphans()
        processed = 0
        while (job := self._claim()) is not None:
            self.processor.handle(job)
            processed += 1
        return processed

    def run_forever(self) -> None:
        logger.info("job loop iniciado", extra={"concurrency": self.settings.concurrency,
                                                "poll_seconds": self.settings.poll_seconds,
                                                "dry_run": self.settings.dry_run,
                                                "only_email_ids": sorted(self.settings.only_email_ids)})
        running: set[Future] = set()
        with ThreadPoolExecutor(max_workers=self.settings.concurrency, thread_name_prefix="job") as pool:
            while not self.stop_event.is_set():
                try:
                    self._requeue_orphans()
                    running = {f for f in running if not f.done()}
                    claimed = False
                    while len(running) < self.settings.concurrency:
                        job = self._claim()
                        if job is None:
                            break
                        claimed = True
                        running.add(pool.submit(self._safe_handle, job))
                except Exception:  # noqa: BLE001 - p. ej. la DB se reinicia: seguir intentando
                    logger.exception("error en el job loop")
                    claimed = False
                # si hay trabajo, volver a mirar pronto; si no, esperar el intervalo
                self.stop_event.wait(0.5 if claimed else self.settings.poll_seconds)
        logger.info("job loop detenido")

    def _safe_handle(self, job) -> None:
        try:
            self.processor.handle(job)
        except Exception:  # noqa: BLE001 - handle ya clasifica; esto es un bug o la DB caída
            logger.exception("error inesperado procesando el job", extra={"job_id": job.id})

    def stop(self) -> None:
        self.stop_event.set()
