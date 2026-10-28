"""Tasas de cambio: parseo de las fuentes (sin red), rangos, tolerancia a fallas y upsert idempotente."""

import json
from datetime import date
from decimal import Decimal

import pytest
import requests

from worker import fx
from worker.fx import Rate


class FakeResponse:
    def __init__(self, payload, status=200):
        self.text = payload if isinstance(payload, str) else json.dumps(payload)
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code}")


class FakeHttp:
    """Responde según la URL; registra las llamadas."""

    def __init__(self, trm=None, ecb=None, trm_status=200, ecb_status=200):
        self.trm, self.ecb = trm or [], ecb or {"rates": {}}
        self.trm_status, self.ecb_status = trm_status, ecb_status
        self.calls = []

    def get(self, url, params=None, timeout=None):
        self.calls.append((url, params))
        assert timeout, "toda llamada lleva timeout"
        if url == fx.TRM_URL:
            return FakeResponse(self.trm, self.trm_status)
        return FakeResponse(self.ecb, self.ecb_status)


class FakeStore:
    def __init__(self, currencies=("COP", "USD", "EUR", "GBP"), oldest=None):
        self.currencies, self.oldest = set(currencies), oldest
        self.rows = {}

    def active_currencies(self):
        return set(self.currencies)

    def oldest_transaction_date(self):
        return self.oldest

    def upsert_fx_rates(self, rates):
        changed = 0
        for quote, day, rate, source in rates:
            if self.rows.get((quote, day, source)) != rate:
                self.rows[(quote, day, source)] = rate
                changed += 1
        return changed


TRM_ROWS = [
    {"valor": "3817.93", "unidad": "COP", "vigenciadesde": "2025-12-20T00:00:00.000",
     "vigenciahasta": "2025-12-22T00:00:00.000"},
    {"valor": "3792.59", "unidad": "COP", "vigenciadesde": "2025-12-23T00:00:00.000",
     "vigenciahasta": "2025-12-23T00:00:00.000"},
]
# como lo devuelve Frankfurter: números JSON (floats), no strings
ECB_BODY = ('{"amount":1.0,"base":"USD","start_date":"2025-12-24","end_date":"2025-12-29",'
            '"rates":{"2025-12-24":{"EUR":0.84839,"GBP":0.74056},"2025-12-29":{"EUR":0.84991,"GBP":0.74163}}}')


def test_fetch_trm_parses_exact_decimals_by_vigenciadesde():
    http = FakeHttp(trm=TRM_ROWS)
    rates = fx.fetch_trm(http, date(2025, 12, 20), date(2025, 12, 23))

    assert rates == [
        Rate("COP", date(2025, 12, 20), Decimal("3817.93"), "SFC_TRM"),
        Rate("COP", date(2025, 12, 23), Decimal("3792.59"), "SFC_TRM"),
    ]
    url, params = http.calls[0]
    assert url == fx.TRM_URL
    assert params["$where"] == "vigenciadesde between '2025-12-20T00:00:00' and '2025-12-23T00:00:00'"


def test_fetch_trm_ignores_other_units():
    http = FakeHttp(trm=[{**TRM_ROWS[0], "unidad": "USD"}])
    assert fx.fetch_trm(http, date(2025, 12, 20), date(2025, 12, 20)) == []


def test_fetch_ecb_never_goes_through_float():
    http = FakeHttp(ecb=ECB_BODY)
    rates = fx.fetch_ecb(http, date(2025, 12, 24), date(2025, 12, 29), {"GBP", "EUR"})

    assert Rate("EUR", date(2025, 12, 24), Decimal("0.84839"), "ECB") in rates
    assert Rate("GBP", date(2025, 12, 29), Decimal("0.74163"), "ECB") in rates
    assert all(isinstance(r.rate, Decimal) for r in rates) and len(rates) == 4
    url, params = http.calls[0]
    assert url.endswith("/2025-12-24..2025-12-29")
    assert params == {"base": "USD", "symbols": "EUR,GBP"}


def test_fetch_ecb_without_quotes_does_not_call():
    http = FakeHttp()
    assert fx.fetch_ecb(http, date(2025, 1, 1), date(2025, 1, 2), set()) == []
    assert http.calls == []


def test_chunks_cover_the_range_without_gaps_or_overlaps():
    parts = list(fx.chunks(date(2024, 1, 1), date(2024, 1, 10), days=4))
    assert parts == [(date(2024, 1, 1), date(2024, 1, 4)), (date(2024, 1, 5), date(2024, 1, 8)),
                     (date(2024, 1, 9), date(2024, 1, 10))]
    assert list(fx.chunks(date(2024, 1, 1), date(2024, 1, 1))) == [(date(2024, 1, 1), date(2024, 1, 1))]
    assert list(fx.chunks(date(2024, 1, 2), date(2024, 1, 1))) == []


def test_sync_range_is_idempotent_and_asks_ecb_only_for_its_currencies():
    store, http = FakeStore(), FakeHttp(trm=TRM_ROWS, ecb=ECB_BODY)
    first = fx.sync_range(store, http, date(2025, 12, 20), date(2025, 12, 29), today=date(2025, 12, 29))
    second = fx.sync_range(store, http, date(2025, 12, 20), date(2025, 12, 29), today=date(2025, 12, 29))

    assert first == {"SFC_TRM": {"fetched": 2, "changed": 2}, "ECB": {"fetched": 4, "changed": 4}}
    assert second == {"SFC_TRM": {"fetched": 2, "changed": 0}, "ECB": {"fetched": 4, "changed": 0}}
    ecb_params = [p for url, p in http.calls if url != fx.TRM_URL]
    assert all(p["symbols"] == "EUR,GBP" for p in ecb_params), "ni USD ni COP se piden al BCE"


def test_one_source_down_does_not_block_the_other():
    store = FakeStore()
    http = FakeHttp(trm=TRM_ROWS, ecb=ECB_BODY, ecb_status=503)
    summary = fx.sync_range(store, http, date(2025, 12, 20), date(2025, 12, 29), today=date(2025, 12, 29))

    assert summary["SFC_TRM"] == {"fetched": 2, "changed": 2}
    assert "error" in summary["ECB"]
    assert fx.has_errors(summary)
    assert len(store.rows) == 2


def test_sync_recent_window_and_ecb_capped_at_today():
    store, http = FakeStore(), FakeHttp()
    fx.sync_recent(store, http, today=date(2026, 10, 27), lookback_days=10)

    trm_params = [p for url, p in http.calls if url == fx.TRM_URL]
    ecb_urls = [url for url, _ in http.calls if url != fx.TRM_URL]
    assert trm_params[0]["$where"] == "vigenciadesde between '2026-10-17T00:00:00' and '2026-11-01T00:00:00'"
    assert ecb_urls == [f"{fx.FRANKFURTER_URL}/2026-10-17..2026-10-27"]


def test_backfill_starts_a_week_before_oldest_transaction_in_yearly_chunks():
    store, http = FakeStore(oldest=date(2024, 3, 15)), FakeHttp()
    fx.backfill(store, http, today=date(2026, 10, 27))

    ecb_urls = [url.rsplit("/", 1)[1] for url, _ in http.calls if url != fx.TRM_URL]
    assert ecb_urls == ["2024-03-08..2025-03-08", "2025-03-09..2026-03-09", "2026-03-10..2026-10-27"]
    assert sum(1 for url, _ in http.calls if url == fx.TRM_URL) == 3


def test_backfill_without_transactions_does_nothing():
    http = FakeHttp()
    assert fx.backfill(FakeStore(oldest=None), http, today=date(2026, 10, 27)) == {}
    assert http.calls == []


def test_backfill_explicit_range():
    http = FakeHttp()
    fx.backfill(FakeStore(oldest=date(2020, 1, 1)), http, today=date(2026, 10, 27),
                start=date(2026, 1, 1), end=date(2026, 1, 31))
    assert [url for url, _ in http.calls if url != fx.TRM_URL] == [f"{fx.FRANKFURTER_URL}/2026-01-01..2026-01-31"]


# ------------------------------------------------------------------ contra Postgres migrado (>= 23)

@pytest.fixture
def fx_cleanup(db):
    yield
    with db.pool.connection() as conn:
        conn.execute("DELETE FROM fx_rates WHERE rate_date BETWEEN '1996-01-01' AND '1996-12-31'")


@pytest.mark.db
def test_upsert_fx_rates_is_idempotent_and_keeps_manual_rates(db, fx_cleanup):
    with db.pool.connection() as conn:
        conn.execute("INSERT INTO fx_rates (quote, rate_date, rate, source) VALUES ('COP', '1996-03-01', 999, 'manual')")

    rows = [("COP", date(1996, 3, 1), Decimal("1000.12"), "SFC_TRM"),
            ("EUR", date(1996, 3, 1), Decimal("0.84839"), "ECB")]
    assert db.upsert_fx_rates(rows) == 2
    assert db.upsert_fx_rates(rows) == 0, "la misma tasa otra vez no cambia nada"
    # duplicados en el mismo lote: gana el último y no revienta el ON CONFLICT
    assert db.upsert_fx_rates([rows[0], ("COP", date(1996, 3, 1), Decimal("1001.5"), "SFC_TRM")]) == 1
    assert db.upsert_fx_rates([]) == 0

    with db.pool.connection() as conn:
        got = {(r["quote"], r["source"]): r["rate"] for r in conn.execute(
            "SELECT quote, source, rate FROM fx_rates WHERE rate_date = '1996-03-01'").fetchall()}
        winner = conn.execute("SELECT fx_rate_at('USD', 'COP', '1996-03-04') AS r").fetchone()["r"]
    assert got == {("COP", "manual"): Decimal("999.0000000000"), ("COP", "SFC_TRM"): Decimal("1001.5000000000"),
                   ("EUR", "ECB"): Decimal("0.8483900000")}
    assert winner == Decimal("999"), "la tasa manual tiene prioridad"


@pytest.mark.db
def test_active_currencies_has_the_seed(db):
    assert {"COP", "USD", "EUR", "MXN", "GBP", "BRL", "CAD"} <= db.active_currencies()
