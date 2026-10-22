"""Flujo de un job de lectura (reemplaza extract_emails_new + SQS). Ver plan/03, "Flujo de un job".

Idempotencia (lo más importante de la fase):
1. processed_emails: un mensaje ya extraído con éxito se omite **sin llamar a Gemini**;
2. transactions.source_message_id: la API inserta con ON CONFLICT DO NOTHING;
3. dedupe del empalme legado en la API (lo que AWS ya había guardado).
Por eso el solape de SYNC_OVERLAP_MINUTES al buscar es gratis.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable
from zoneinfo import ZoneInfo

from worker import log
from worker.api_client import TopiApi
from worker.config import Settings
from worker.db import Database, Job
from worker.errors import (
    CredentialError, PermanentJobError, TransientError, WorkerError, backoff_seconds, classify,
)
from worker.extractors.base import AccountRef, TransactionExtractor
from worker.mapping import map_account_ids, to_api_date
from worker.providers.base import MailProvider
from worker.providers.senders import split_senders

logger = log.get(__name__)

REQUIRED_FIELDS = ("user_id", "user_mail", "email_id", "user_provider", "sender_email", "accounts")

ProviderFactory = Callable[[str, dict, Settings], MailProvider]


def default_provider_factory(provider: str, tokens: dict, settings: Settings) -> MailProvider:
    if provider == "gmail" and not (settings.gmail_client_id and settings.gmail_client_secret):
        raise PermanentJobError("GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET no están configurados")
    if provider == "outlook" and not (settings.outlook_client_id and settings.outlook_client_secret):
        raise PermanentJobError("OUTLOOK_CLIENT_ID/OUTLOOK_CLIENT_SECRET no están configurados")
    if provider == "gmail":
        from worker.providers.gmail import GmailProvider

        return GmailProvider.from_tokens(tokens, settings.gmail_client_id, settings.gmail_client_secret,
                                         settings.gmail_token_uri)
    if provider == "outlook":
        from worker.providers.outlook import OutlookProvider

        return OutlookProvider.from_tokens(tokens, settings.outlook_client_id, settings.outlook_client_secret,
                                           settings.outlook_token_uri)
    raise PermanentJobError(f"proveedor de correo no soportado: {provider!r}")


@dataclass
class JobResult:
    listed: int = 0
    skipped_seen: int = 0
    extracted: int = 0
    no_transaction: int = 0
    failed_messages: int = 0
    created: list[int] = field(default_factory=list)
    skipped_api: list[dict] = field(default_factory=list)
    would_create: list[dict] = field(default_factory=list)  # dry run
    last_run_updated: bool = False


def first_day_of_month(now: datetime, tz: str) -> datetime:
    """Sin estado previo se lee desde el primer día del mes (comportamiento original), en hora Bogotá."""
    local = now.astimezone(ZoneInfo(tz))
    return local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


class JobProcessor:
    def __init__(
        self,
        settings: Settings,
        db: Database,
        api: TopiApi,
        extractor: TransactionExtractor,
        provider_factory: ProviderFactory = default_provider_factory,
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ):
        self.settings = settings
        self.db = db
        self.api = api
        self.extractor = extractor
        self.provider_factory = provider_factory
        self.now = now

    # ------------------------------------------------------------------ manejo del job

    def handle(self, job: Job) -> str:
        """Procesa el job y deja su estado en la cola. Devuelve el estado final."""
        payload = job.payload or {}
        context = {"job_id": job.id, "email_id": payload.get("email_id"), "attempt": job.attempts}
        try:
            result = self.process(payload)
        except Exception as exc:  # noqa: BLE001 - todo se clasifica
            return self._on_error(job, payload, classify(exc), context)

        self.db.complete_job(job.id)
        logger.info("job done", extra={**context, "listed": result.listed, "skipped_seen": result.skipped_seen,
                                       "extracted": result.extracted, "created": len(result.created),
                                       "skipped_api": len(result.skipped_api),
                                       "would_create": len(result.would_create), "dry_run": self.settings.dry_run})
        return "done"

    def _on_error(self, job: Job, payload: dict, error: WorkerError, context: dict) -> str:
        if isinstance(error, CredentialError):
            # único caso que marca la conexión: el usuario debe reconectar el correo
            if self.settings.dry_run:
                logger.warning("dry run: no se marca la conexión", extra={**context, "code": error.code})
            else:
                try:
                    self.api.report_email_error(int(payload["email_id"]), error.code)
                except Exception as exc:  # noqa: BLE001
                    logger.error("no se pudo reportar el error de la conexión", extra={**context, "error": str(exc)})
            self.db.fail_job(job.id, f"{error.code}: {error}")
            logger.warning("job failed: credentials", extra={**context, "code": error.code})
            return "failed"

        if isinstance(error, TransientError) and job.attempts < self.settings.max_attempts:
            delay = backoff_seconds(job.attempts)
            self.db.retry_job(job.id, str(error), delay)
            logger.warning("job retry", extra={**context, "delay_seconds": delay, "error": str(error)})
            return "retry"

        # permanente, o transitorio que agotó los intentos: falla sin marcar la conexión
        self.db.fail_job(job.id, str(error))
        logger.error("job failed", extra={**context, "error": str(error), "kind": type(error).__name__})
        return "failed"

    # ------------------------------------------------------------------ flujo

    def process(self, payload: dict[str, Any]) -> JobResult:
        missing = [f for f in REQUIRED_FIELDS if f not in payload]
        if missing:
            raise PermanentJobError(f"payload incompleto, faltan: {', '.join(missing)}")

        user_id = payload["user_id"]
        email_id = int(payload["email_id"])
        provider_name = payload["user_provider"]
        sender_email = payload["sender_email"]
        accounts: dict[str, str] = payload["accounts"] or {}
        if not accounts:
            raise PermanentJobError("el job no tiene cuentas")

        senders = split_senders(sender_email)
        if not senders:
            raise PermanentJobError(f"remitente vacío o inválido: {sender_email!r}")

        # 2. desde dónde leer
        last_run = self.db.get_last_run(email_id, sender_email) or first_day_of_month(self.now(), self.settings.timezone)
        since = last_run - timedelta(minutes=self.settings.sync_overlap_minutes)
        listing_started = self.now()

        # 3. tokens y listado paginado
        tokens = self.api.get_email_tokens(user_id, email_id)
        provider = self.provider_factory(provider_name, tokens, self.settings)
        refs = list(provider.list_messages(senders, since))

        result = JobResult(listed=len(refs))

        # onboarding: el correo ya se pudo leer (como en la Lambda, aunque falle algo después)
        if payload.get("onboarding") and not self.settings.dry_run:
            self.api.confirm_email_read(user_id)

        # 4. omitir lo ya extraído sin llamar a Gemini
        done = self.db.done_message_ids(email_id, [r.id for r in refs])
        pending_refs = [r for r in refs if r.id not in done]
        result.skipped_seen = len(refs) - len(pending_refs)

        account_refs = [AccountRef(last4, int(account_id)) for last4, account_id in accounts.items()]
        transactions: list[dict[str, Any]] = []
        messages_with_tx: dict[str, list[dict]] = {}
        failures: list[str] = []

        for ref in pending_refs:
            email = provider.get_message(ref)
            if email.received_at < since:
                continue

            if not self.settings.dry_run:
                self.db.register_message(
                    user_id=user_id, email_id=email_id, provider=provider_name, message_id=email.id,
                    sender=email.sender, received_at=email.received_at, extractor=self.extractor.name,
                )

            try:
                extracted = self.extractor.extract(email, account_refs)
            except Exception as exc:  # noqa: BLE001
                error = classify(exc)
                if isinstance(error, CredentialError):
                    raise error
                failures.append(email.id)
                result.failed_messages += 1
                if not self.settings.dry_run:
                    self.db.update_message(email_id, email.id, "error", error=str(error)[:1000])
                logger.warning("extraction failed", extra={"email_id": email_id, "message_id": email.id,
                                                           "error": str(error)})
                continue

            found = [t for t in extracted if t.is_transaction]
            result.extracted += 1
            if not found:
                result.no_transaction += 1
                if not self.settings.dry_run:
                    self.db.update_message(email_id, email.id, "no_transaction")
                continue

            for item in found:
                transaction = {
                    "account_number": item.account_number,
                    "description": item.description or email.subject,
                    "expense": bool(item.expense),
                    "amount": item.amount,
                    "date": to_api_date(item.date or email.received_at),
                    "source_message_id": email.id,
                }
                if item.confidence is not None and item.confidence < self.settings.confidence_threshold:
                    transaction["should_verify"] = True
                transactions.append(transaction)
                messages_with_tx.setdefault(email.id, []).append(transaction)

        # 5. cuentas y creación (idempotente por source_message_id)
        if transactions:
            map_account_ids(transactions, accounts)
            to_send = []
            for t in transactions:
                if "error" in t:
                    failures.append(t["source_message_id"])
                    continue
                to_send.append({
                    "account_id": t["account_id"],
                    "description": t["description"],
                    "expense": t["expense"],
                    "amount": t["amount"],
                    "date": t["date"],
                    "should_verify": bool(t.get("should_verify", False)),
                    "source_message_id": t["source_message_id"],
                })

            if self.settings.dry_run:
                result.would_create = to_send
                for t in to_send:
                    logger.info("dry run: crearía transacción", extra={"email_id": email_id, **t})
            elif to_send:
                created = self.api.create_transactions(user_id, to_send)
                ids_by_message: dict[str, list[int]] = {}
                for row in created["transactions"]:
                    ids_by_message.setdefault(row.get("source_message_id"), []).append(int(row["id"]))
                    result.created.append(int(row["id"]))
                result.skipped_api = created["skipped"]
                for message_id in messages_with_tx:
                    if message_id in failures:
                        continue
                    self.db.update_message(email_id, message_id, "transaction", ids_by_message.get(message_id, []))

        # 6. mover last_run solo si todo salió bien
        if failures:
            raise TransientError(f"{len(failures)} mensaje(s) no se pudieron procesar; se reintenta el job")

        if not self.settings.dry_run:
            self.db.set_last_run(email_id, sender_email, listing_started)
            result.last_run_updated = True

        return result
