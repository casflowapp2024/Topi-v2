"""Flujo de un job: last_run y solape, idempotencia (sin llamar a Gemini para lo ya visto),
clasificación de errores, reintentos y dry run. Gmail, Gemini y la API son dobles en memoria."""

from datetime import datetime, timedelta, timezone

import pytest
from google.auth.exceptions import RefreshError

from tests.fakes import FakeApi, FakeDB, FakeExtractor, FakeProvider, job
from worker.config import Settings
from worker.jobs import JobProcessor, first_day_of_month
from worker.providers.base import EmailMessage

NOW = datetime(2026, 10, 20, 15, 0, tzinfo=timezone.utc)
LAST_RUN = datetime(2026, 10, 17, 9, 0, tzinfo=timezone.utc)
SENDER = "a@banco.co,b@banco.co"


def settings(**overrides):
    base = {"DATABASE_URL": "x", "API_BASE_URL": "http://api", "INTERNAL_API_KEY": "k"}
    s = Settings.from_env(base)
    return s.__class__(**{**s.__dict__, **overrides})


def email(message_id, body, minutes_after_last_run=30):
    return EmailMessage(id=message_id, subject=f"Asunto {message_id}", sender="a@banco.co",
                        received_at=LAST_RUN + timedelta(minutes=minutes_after_last_run), body=body)


def make(messages, extractor=None, list_error=None, **settings_overrides):
    db, api = FakeDB(), FakeApi()
    db.set_last_run(7, SENDER, LAST_RUN)
    provider = FakeProvider(messages, list_error)
    extractor = extractor or FakeExtractor()
    processor = JobProcessor(settings(**settings_overrides), db, api, extractor,
                             provider_factory=lambda name, tokens, s: provider, now=lambda: NOW)
    return processor, db, api, provider, extractor


MESSAGES = [
    email("m1", "TX:1111:50000"),
    email("m2", "TX:9999:20000"),         # 4 dígitos que no son de ninguna cuenta
    email("m3", "Promoción de puntos"),   # no es transacción
]


def test_reads_from_last_run_minus_overlap_and_moves_it():
    processor, db, api, provider, _ = make(MESSAGES)

    assert processor.handle(job()) == "done"

    senders, since = provider.list_calls[0]
    assert senders == ["a@banco.co", "b@banco.co"]           # hallazgo 2
    assert since == LAST_RUN - timedelta(minutes=60)         # solape SYNC_OVERLAP_MINUTES
    assert db.get_last_run(7, SENDER) == NOW                 # hora de inicio del listado
    assert db.jobs[1]["status"] == "done"


def test_without_state_reads_from_first_day_of_month_bogota():
    processor, db, _, provider, _ = make([])
    db.last_runs.clear()

    processor.handle(job())

    expected = first_day_of_month(NOW, "America/Bogota") - timedelta(minutes=60)
    assert provider.list_calls[0][1] == expected
    assert expected == datetime(2026, 10, 1, 4, 0, tzinfo=timezone.utc)  # 1-oct 00:00 COT - 60 min


def test_creates_transactions_with_source_message_id_and_should_verify():
    processor, db, api, _, _ = make(MESSAGES)

    processor.handle(job())

    sent = api.create_calls[0]
    assert [t["source_message_id"] for t in sent] == ["m1", "m2"]
    assert sent[0] == {"account_id": 11, "description": "Compra m1", "expense": True, "amount": 50000.0,
                       "date": "2026-10-17 09:30:00 +0000", "should_verify": False, "source_message_id": "m1"}
    assert sent[1]["account_id"] == 11 and sent[1]["should_verify"] is True  # regla de map_account_ids
    assert db.processed[(7, "m1")]["status"] == "transaction"
    assert db.processed[(7, "m1")]["transaction_ids"] == [api.created[("u1", "m1")]]
    assert db.processed[(7, "m3")]["status"] == "no_transaction"


def test_second_run_skips_seen_messages_without_calling_the_extractor():
    processor, db, api, _, extractor = make(MESSAGES)
    processor.handle(job(job_id=1))
    assert extractor.calls == ["m1", "m2", "m3"]

    processor.handle(job(job_id=2))

    assert extractor.calls == ["m1", "m2", "m3"], "ni una llamada más a Gemini"
    assert len(api.create_calls) == 1, "nada nuevo que crear"
    assert len(api.created) == 2


def test_reprocessing_never_duplicates_even_if_processed_emails_was_lost():
    processor, db, api, _, _ = make(MESSAGES)
    processor.handle(job(job_id=1))
    db.processed.clear()  # p. ej. limpieza por retención o crash entre la API y el UPDATE
    db.set_last_run(7, SENDER, LAST_RUN)  # y la ventana vuelve a incluir los mismos correos

    processor.handle(job(job_id=2))

    assert len(api.created) == 2, "la API omite por source_message_id"
    assert db.processed[(7, "m1")]["status"] == "transaction"


def test_gemini_503_retries_only_the_failed_message_and_keeps_last_run():
    from google.genai import errors as genai_errors

    overloaded = genai_errors.ServerError(503, {"error": {"code": 503, "message": "overloaded", "status": "UNAVAILABLE"}})
    extractor = FakeExtractor(fail_for={"m2": overloaded})
    processor, db, api, _, _ = make(MESSAGES, extractor=extractor)

    assert processor.handle(job(attempts=1)) == "retry"

    assert db.jobs[1] == {"status": "pending", "error": db.jobs[1]["error"], "delay": 60}   # backoff 1 min
    assert db.get_last_run(7, SENDER) == LAST_RUN, "no se mueve last_run si algo falló"
    assert api.errors == [], "un 503 de Gemini no marca la conexión"
    assert db.processed[(7, "m2")]["status"] == "error"
    assert ("u1", "m1") in api.created, "lo que sí salió se crea"

    extractor.fail_for.clear()
    assert processor.handle(job(job_id=2, attempts=2)) == "done"
    assert extractor.calls == ["m1", "m2", "m3", "m2"], "solo se reintenta el mensaje que falló"
    assert db.get_last_run(7, SENDER) == NOW


@pytest.mark.parametrize("attempt, expected, delay", [(1, "retry", 60), (2, "retry", 300), (3, "failed", None)])
def test_backoff_and_max_attempts(attempt, expected, delay):
    processor, db, api, _, _ = make([], list_error=ConnectionError("reset by peer"))

    assert processor.handle(job(attempts=attempt)) == expected

    assert db.jobs[1].get("delay") == delay
    assert api.errors == []


def test_revoked_token_marks_the_connection():
    revoked = RefreshError("invalid_grant: Token has been expired or revoked.", {})
    processor, db, api, _, _ = make([], list_error=revoked)

    assert processor.handle(job()) == "failed"

    assert api.errors == [(7, "token_expired_or_revoked")]
    assert db.jobs[1]["status"] == "failed"


def test_permanent_errors_fail_without_marking():
    processor, db, api, _, _ = make([])
    assert processor.handle(job(accounts={})) == "failed"
    assert processor.handle(job(job_id=2, sender_email=" , ")) == "failed"
    assert api.errors == []


def test_unknown_provider_fails_without_marking():
    from worker.jobs import default_provider_factory

    processor, db, api, _, _ = make([])
    processor.provider_factory = default_provider_factory
    assert processor.handle(job(user_provider="yahoo")) == "failed"
    assert "yahoo" in db.jobs[1]["error"] and api.errors == []


def test_dry_run_reads_and_extracts_but_writes_nothing():
    processor, db, api, _, extractor = make(MESSAGES, dry_run=True)

    processor.handle(job(onboarding=True))

    assert extractor.calls == ["m1", "m2", "m3"]
    assert api.create_calls == [] and api.read_confirmed == []
    assert db.processed == {}, "no registra mensajes: la corrida real los procesará"
    assert db.get_last_run(7, SENDER) == LAST_RUN
    assert db.jobs[1]["status"] == "done"


def test_dry_run_returns_what_it_would_create():
    processor, *_ = make(MESSAGES, dry_run=True)
    result = processor.process(job().payload)
    assert [t["source_message_id"] for t in result.would_create] == ["m1", "m2"]


def test_onboarding_confirms_email_read():
    processor, _, api, _, _ = make([], dry_run=False)
    processor.handle(job(onboarding=True))
    assert api.read_confirmed == ["u1"]


def test_messages_before_window_are_ignored():
    old = email("old", "TX:1111:1", minutes_after_last_run=-120)
    processor, db, api, _, extractor = make([old])
    processor.handle(job())
    assert extractor.calls == [] and (7, "old") not in db.processed


def test_api_skipped_duplicates_still_mark_message_done():
    processor, db, api, _, _ = make([email("m1", "TX:1111:50000")])
    api.created[("u1", "m1")] = 555  # ya existía (p. ej. lo creó otra corrida)

    processor.handle(job())

    assert db.processed[(7, "m1")]["status"] == "transaction"
    assert db.processed[(7, "m1")]["transaction_ids"] == []


def test_missing_oauth_or_gemini_config_fails_without_marking():
    from worker.extractors.gemini import GeminiExtractor
    from worker.jobs import default_provider_factory

    processor, db, api, _, _ = make([])
    processor.provider_factory = default_provider_factory  # sin GMAIL_CLIENT_ID en settings
    assert processor.handle(job()) == "failed"
    assert "GMAIL_CLIENT_ID" in db.jobs[1]["error"] and api.errors == []

    processor, db, api, _, _ = make([email("m1", "TX:1111:1")], extractor=GeminiExtractor(api_key=""))
    assert processor.handle(job(attempts=3)) == "failed"
    assert api.errors == []


def test_email_in_other_currency_goes_to_review():
    """D6: la moneda la da la cuenta; si el correo habla de otra (USD en una tarjeta COP), la
    transacción se crea en "Por revisar" (should_verify) en vez de pasar como COP sin más."""
    usd = EmailMessage(id="m9", subject="Compra internacional por USD 45,99", sender="a@banco.co",
                       received_at=LAST_RUN + timedelta(minutes=30), body="TX:1111:45.99")
    cop = email("m10", "TX:2222:120000")
    processor, _, api, _, _ = make([usd, cop])

    processor.handle(job(currencies={"11": "COP", "22": "COP"}))

    sent = {t["source_message_id"]: t for t in api.create_calls[0]}
    assert sent["m9"]["should_verify"] is True
    assert sent["m10"]["should_verify"] is False
    assert "detected_currencies" not in sent["m9"], "no viaja a la API"


def test_usd_email_on_usd_account_is_not_flagged():
    usd = EmailMessage(id="m11", subject="Compra por US$ 20", sender="a@banco.co",
                       received_at=LAST_RUN + timedelta(minutes=30), body="TX:2222:20")
    processor, _, api, _, _ = make([usd])

    processor.handle(job(currencies={"11": "COP", "22": "USD"}))

    assert api.create_calls[0][0]["should_verify"] is False


def test_card_payment_email_is_an_income_of_the_card():
    """El extractor lo lee como gasto ("Pago"); en la tarjeta es una entrada y queda a la espera de
    la cuenta con que se pagó."""
    pago = EmailMessage(id="m12", subject="Pago de Tarjeta de Crédito", sender="a@banco.co",
                        received_at=LAST_RUN + timedelta(minutes=30), body="TX:1111:900")
    compra = email("m13", "TX:1111:50")
    processor, _, api, _, _ = make([pago, compra])

    processor.handle(job(classes={"11": "credit", "22": "deposit"}))

    sent = {t["source_message_id"]: t for t in api.create_calls[0]}
    assert sent["m12"]["expense"] is False and sent["m12"]["card_payment"] is True
    assert sent["m13"]["expense"] is True and "card_payment" not in sent["m13"]
