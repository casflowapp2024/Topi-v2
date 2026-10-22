"""SQL de la cola y del estado contra el Postgres local migrado (marcados `db`)."""

import uuid
from datetime import datetime, timezone

import pytest

pytestmark = pytest.mark.db


@pytest.fixture
def cleanup(db):
    keys, email_ids = [], []
    yield keys, email_ids
    with db.pool.connection() as conn:
        conn.execute("DELETE FROM email_jobs WHERE dedupe_key = ANY(%s)", (keys,))
        conn.execute("DELETE FROM email_sync_state WHERE email_id = ANY(%s)", (email_ids,))
        conn.execute("DELETE FROM processed_emails WHERE email_id = ANY(%s)", (email_ids,))


def _status(db, job_id):
    with db.pool.connection() as conn:
        return conn.execute("SELECT status, attempts, run_after > now() AS later, last_error FROM email_jobs WHERE id = %s",
                            (job_id,)).fetchone()


def test_enqueue_dedupe(db, cleanup, test_email_id):
    keys, _ = cleanup
    key = f"{test_email_id}:a@banco.test,b@banco.test"
    keys.append(key)

    assert db.enqueue_jobs([({"email_id": test_email_id}, key)]) == 1
    # el scheduler corre otra vez antes de que se procese: no se duplica
    assert db.enqueue_jobs([({"email_id": test_email_id}, key)]) == 0

    with db.pool.connection() as conn:
        count = conn.execute("SELECT count(*) AS n FROM email_jobs WHERE dedupe_key = %s", (key,)).fetchone()["n"]
    assert count == 1


def test_claim_priority_retry_and_finish(db, cleanup, test_email_id):
    keys, _ = cleanup
    low, high = f"{test_email_id}:low@x", f"{test_email_id}:high@x"
    keys += [low, high]
    db.enqueue_jobs([({"email_id": test_email_id, "k": "low"}, low)], priority=0)
    db.enqueue_jobs([({"email_id": test_email_id, "k": "high"}, high)], priority=1)

    # el filtro por conexión (WORKER_ONLY_EMAIL_IDS) aísla el test de jobs reales de la DB local
    first = db.claim_job("test-worker", [test_email_id])
    second = db.claim_job("test-worker", [test_email_id])
    assert db.claim_job("test-worker", [test_email_id]) is None

    assert [first.dedupe_key, second.dedupe_key] == [high, low], "prioridad 1 (leer ahora) primero"
    assert first.attempts == 1 and first.payload["k"] == "high"

    db.retry_job(first.id, "gemini 503", 60)
    row = _status(db, first.id)
    assert row["status"] == "pending" and row["later"] and row["last_error"] == "gemini 503"
    assert db.claim_job("test-worker", [test_email_id]) is None, "no se toma antes de run_after"

    db.complete_job(second.id)
    assert _status(db, second.id)["status"] == "done"

    db.fail_job(first.id, "token")
    assert _status(db, first.id)["status"] == "failed"

    # con el job terminado se puede volver a encolar el mismo par
    assert db.enqueue_jobs([({"email_id": test_email_id}, low)]) == 1


def test_requeue_orphans(db, cleanup, test_email_id):
    keys, _ = cleanup
    key = f"{test_email_id}:orphan@x"
    keys.append(key)
    with db.pool.connection() as conn:
        job_id = conn.execute(
            """INSERT INTO email_jobs (payload, dedupe_key, status, locked_at, locked_by)
               VALUES ('{}', %s, 'running', now() - interval '20 minutes', 'dead-worker') RETURNING id""",
            (key,),
        ).fetchone()["id"]

    assert db.requeue_orphans(15) >= 1
    row = _status(db, job_id)
    assert row["status"] == "pending"


def test_last_run_upsert(db, cleanup, test_email_id):
    _, email_ids = cleanup
    email_ids.append(test_email_id)
    sender = "a@banco.test,b@banco.test"

    assert db.get_last_run(test_email_id, sender) is None
    first = datetime(2026, 10, 17, 9, 0, tzinfo=timezone.utc)
    db.set_last_run(test_email_id, sender, first)
    assert db.get_last_run(test_email_id, sender) == first
    second = datetime(2026, 10, 20, 15, 0, tzinfo=timezone.utc)
    db.set_last_run(test_email_id, sender, second)
    assert db.get_last_run(test_email_id, sender) == second


def test_processed_emails_only_done_are_skipped(db, cleanup, test_email_id):
    _, email_ids = cleanup
    email_ids.append(test_email_id)
    common = dict(user_id="u-test", email_id=test_email_id, provider="gmail", sender="a@banco.test",
                  received_at=datetime(2026, 10, 18, tzinfo=timezone.utc), extractor="gemini-2.5-flash-lite")

    for message_id in ("m-ok", "m-none", "m-error", "m-pending"):
        db.register_message(message_id=message_id, **common)
    db.update_message(test_email_id, "m-ok", "transaction", [10, 11])
    db.update_message(test_email_id, "m-none", "no_transaction")
    db.update_message(test_email_id, "m-error", "error", error="gemini 503")

    done = db.done_message_ids(test_email_id, ["m-ok", "m-none", "m-error", "m-pending", "m-new"])
    assert done == {"m-ok", "m-none"}

    # se registra de nuevo sin duplicar la fila
    db.register_message(message_id="m-error", **common)
    with db.pool.connection() as conn:
        rows = conn.execute("SELECT status, transaction_ids FROM processed_emails WHERE email_id = %s ORDER BY provider_message_id",
                            (test_email_id,)).fetchall()
    assert len(rows) == 4
    statuses = {r["status"] for r in rows}
    assert "transaction" in statuses


def test_heartbeat_upsert(db):
    worker_id = f"test-heartbeat-{uuid.uuid4().hex[:8]}"
    try:
        db.heartbeat(worker_id, "0.1.0")
        db.heartbeat(worker_id, "0.2.0")
        with db.pool.connection() as conn:
            rows = conn.execute(
                "SELECT version, last_seen > now() - interval '1 minute' AS recent FROM worker_heartbeat WHERE worker_id = %s",
                (worker_id,)).fetchall()
        assert rows == [{"version": "0.2.0", "recent": True}]
    finally:
        with db.pool.connection() as conn:
            conn.execute("DELETE FROM worker_heartbeat WHERE worker_id = %s", (worker_id,))
