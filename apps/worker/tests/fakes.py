"""Dobles en memoria de la DB, la API, el proveedor de correo y el extractor."""

from __future__ import annotations

from datetime import datetime

from worker.db import DONE_STATUSES, Job
from worker.extractors.base import ExtractedTransaction
from worker.providers.base import EmailMessage, MessageRef


class FakeDB:
    def __init__(self):
        self.last_runs: dict[tuple[int, str], datetime] = {}
        self.processed: dict[tuple[int, str], dict] = {}
        self.jobs: dict[int, dict] = {}

    # sync state
    def get_last_run(self, email_id, sender):
        return self.last_runs.get((email_id, sender))

    def set_last_run(self, email_id, sender, value):
        self.last_runs[(email_id, sender)] = value

    # processed_emails
    def done_message_ids(self, email_id, ids):
        return {i for i in ids if self.processed.get((email_id, i), {}).get("status") in DONE_STATUSES}

    def register_message(self, *, user_id, email_id, provider, message_id, sender, received_at, extractor):
        assert "body" not in locals()
        self.processed[(email_id, message_id)] = {"status": "pending", "sender": sender, "extractor": extractor,
                                                  "transaction_ids": None, "error": None}

    def update_message(self, email_id, message_id, status, transaction_ids=None, error=None):
        self.processed[(email_id, message_id)].update(status=status, transaction_ids=transaction_ids, error=error)

    # jobs
    def complete_job(self, job_id):
        self.jobs[job_id] = {"status": "done"}

    def fail_job(self, job_id, error):
        self.jobs[job_id] = {"status": "failed", "error": error}

    def retry_job(self, job_id, error, delay):
        self.jobs[job_id] = {"status": "pending", "error": error, "delay": delay}


class FakeApi:
    def __init__(self):
        self.created: dict[tuple[str, str], int] = {}  # (user_id, source_message_id) -> id
        self.create_calls: list[list[dict]] = []
        self.errors: list[tuple[int, str]] = []
        self.read_confirmed: list[str] = []
        self.next_id = 1000

    def get_email_tokens(self, user_id, email_id):
        return {"access_token": "a", "refresh_token": "r"}

    def create_transactions(self, user_id, transactions):
        """Simula la idempotencia de la API por source_message_id."""
        self.create_calls.append(transactions)
        result = {"transactions": [], "skipped": []}
        for t in transactions:
            key = (user_id, t["source_message_id"])
            if key in self.created:
                result["skipped"].append({"source_message_id": key[1], "reason": "duplicate_message"})
                continue
            self.next_id += 1
            self.created[key] = self.next_id
            result["transactions"].append({"id": self.next_id, "source_message_id": key[1]})
        return result

    def report_email_error(self, email_id, code):
        self.errors.append((email_id, code))

    def confirm_email_read(self, user_id):
        self.read_confirmed.append(user_id)


class FakeProvider:
    name = "gmail"

    def __init__(self, messages: list[EmailMessage], list_error: Exception | None = None):
        self.messages = {m.id: m for m in messages}
        self.list_error = list_error
        self.list_calls: list[tuple[list[str], datetime]] = []
        self.fetched: list[str] = []

    def list_messages(self, senders, since):
        self.list_calls.append((senders, since))
        if self.list_error:
            raise self.list_error
        for message_id in self.messages:
            yield MessageRef(message_id)

    def get_message(self, ref):
        self.fetched.append(ref.id)
        return self.messages[ref.id]


class FakeExtractor:
    """Devuelve una transacción por correo cuyo cuerpo empiece con 'TX'. Puede fallar por mensaje."""

    name = "fake-extractor"

    def __init__(self, fail_for: dict[str, Exception] | None = None):
        self.calls: list[str] = []
        self.fail_for = fail_for or {}

    def extract(self, email, accounts):
        self.calls.append(email.id)
        if email.id in self.fail_for:
            raise self.fail_for[email.id]
        if not email.body.startswith("TX"):
            return [ExtractedTransaction(is_transaction=False, date=email.received_at)]
        _, last4, amount = email.body.split(":")
        return [ExtractedTransaction(is_transaction=True, account_number=last4, amount=float(amount), expense=True,
                                     date=email.received_at, description=f"Compra {email.id}")]


def job(job_id=1, attempts=1, **payload) -> Job:
    base = {"user_id": "u1", "user_mail": "u1@gmail.com", "email_id": 7, "user_provider": "gmail",
            "sender_email": "a@banco.co,b@banco.co", "accounts": {"1111": "11", "2222": "22"}}
    base.update(payload)
    return Job(id=job_id, payload=base, priority=0, attempts=attempts, dedupe_key=f"{base['email_id']}:{base['sender_email']}")
