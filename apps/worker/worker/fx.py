"""Tasas de cambio para multimoneda (tabla fx_rates, pivote USD: 1 USD = rate QUOTE).

- USD→COP: TRM oficial de la Superfinanciera en datos.gov.co (fuente 'SFC_TRM'). Cada fila trae
  su vigencia; se guarda por vigenciadesde y fx_rate_at cubre fines de semana y festivos con la
  última fecha <= la pedida.
- El resto (EUR, MXN, GBP, BRL, CAD, ...): Frankfurter, que publica las tasas del BCE (fuente 'ECB').
  Solo días hábiles del BCE; no trae COP.

Todo es idempotente: volver a correr un rango no duplica ni cambia nada salvo correcciones de la
fuente. Una fuente caída no impide guardar la otra.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Callable, Iterator, Protocol
from zoneinfo import ZoneInfo

import requests

from worker import log

logger = log.get(__name__)

TRM_URL = "https://www.datos.gov.co/resource/32sa-8pi3.json"
FRANKFURTER_URL = "https://api.frankfurter.dev/v1"
SOURCE_TRM = "SFC_TRM"
SOURCE_ECB = "ECB"
# currencies que no vienen del BCE: USD es el pivote y COP sale de la TRM
NOT_FROM_ECB = frozenset({"USD", "COP"})
# la TRM se publica antes de su vigencia (viernes → sábado a martes si el lunes es festivo)
TRM_DAYS_AHEAD = 5
CHUNK_DAYS = 366
BACKFILL_MARGIN_DAYS = 7
TIMEOUT = 30


@dataclass(frozen=True)
class Rate:
    quote: str
    rate_date: date
    rate: Decimal
    source: str


class Http(Protocol):
    def get(self, url: str, params: dict | None = None, timeout: float | None = None) -> requests.Response: ...


class FxStore(Protocol):
    def active_currencies(self) -> set[str]: ...
    def oldest_transaction_date(self) -> date | None: ...
    def earliest_rate_date(self, source: str) -> date | None: ...
    def upsert_fx_rates(self, rates) -> int: ...


def default_http() -> requests.Session:
    session = requests.Session()
    session.headers["User-Agent"] = "topi-worker (tasas de cambio)"
    return session


def today_in(timezone: str) -> date:
    return datetime.now(ZoneInfo(timezone)).date()


def chunks(start: date, end: date, days: int = CHUNK_DAYS) -> Iterator[tuple[date, date]]:
    """Parte [start, end] en rangos consecutivos de a lo sumo `days` días."""
    current = start
    while current <= end:
        last = min(end, current + timedelta(days=days - 1))
        yield current, last
        current = last + timedelta(days=1)


def fetch_trm(http: Http, start: date, end: date) -> list[Rate]:
    params = {
        "$where": f"vigenciadesde between '{start.isoformat()}T00:00:00' and '{end.isoformat()}T00:00:00'",
        "$order": "vigenciadesde",
        "$limit": "50000",
    }
    response = http.get(TRM_URL, params=params, timeout=TIMEOUT)
    response.raise_for_status()
    rates = []
    for row in json.loads(response.text):
        if row.get("unidad", "COP") != "COP":
            continue
        rates.append(Rate("COP", date.fromisoformat(row["vigenciadesde"][:10]), Decimal(row["valor"]), SOURCE_TRM))
    return rates


def fetch_ecb(http: Http, start: date, end: date, quotes: set[str]) -> list[Rate]:
    """Serie diaria del BCE con base USD. Frankfurter agrega el último día hábil anterior a
    `start`; se guarda igual (es una tasa real de ese día)."""
    if not quotes:
        return []
    response = http.get(
        f"{FRANKFURTER_URL}/{start.isoformat()}..{end.isoformat()}",
        params={"base": "USD", "symbols": ",".join(sorted(quotes))},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    data = json.loads(response.text, parse_float=Decimal, parse_int=Decimal)
    return [
        Rate(quote, date.fromisoformat(day), Decimal(value), SOURCE_ECB)
        for day, values in data.get("rates", {}).items()
        for quote, value in values.items()
    ]


def _sync_source(name: str, db: FxStore, fetch: Callable[[date, date], list[Rate]],
                 start: date, end: date) -> dict:
    if end < start:
        return {"fetched": 0, "changed": 0}
    try:
        rates = [rate for a, b in chunks(start, end) for rate in fetch(a, b)]
        changed = db.upsert_fx_rates((r.quote, r.rate_date, r.rate, r.source) for r in rates)
    except Exception as exc:  # noqa: BLE001 - una fuente caída no frena la otra
        logger.exception("error sincronizando tasas", extra={"source": name, "start": start.isoformat(),
                                                             "end": end.isoformat()})
        return {"error": str(exc)}
    summary = {"fetched": len(rates), "changed": changed}
    logger.info("tasas sincronizadas", extra={"source": name, "start": start.isoformat(),
                                              "end": end.isoformat(), **summary})
    return summary


def sync_range(db: FxStore, http: Http, start: date, end: date, today: date) -> dict[str, dict]:
    """Trae y guarda las tasas de [start, end]. El BCE no publica a futuro: su rango se corta en `today`."""
    ecb_quotes = db.active_currencies() - NOT_FROM_ECB
    return {
        SOURCE_TRM: _sync_source(SOURCE_TRM, db, lambda a, b: fetch_trm(http, a, b), start, end),
        SOURCE_ECB: _sync_source(SOURCE_ECB, db, lambda a, b: fetch_ecb(http, a, b, ecb_quotes),
                                 start, min(end, today)),
    }


def sync_recent(db: FxStore, http: Http, today: date, lookback_days: int) -> dict[str, dict]:
    """Job diario: los últimos `lookback_days` (recupera corridas perdidas) y la TRM ya publicada
    para los próximos días."""
    return sync_range(db, http, today - timedelta(days=lookback_days), today + timedelta(days=TRM_DAYS_AHEAD), today)


def backfill(db: FxStore, http: Http, today: date, start: date | None = None,
             end: date | None = None) -> dict[str, dict]:
    """Histórico desde la transacción más antigua (o `start`) hasta hoy (o `end`). Sin `start`
    arranca una semana antes de esa transacción: la TRM vigente ese día pudo empezar antes
    (fin de semana o puente) y fx_rate_at la necesita como "última fecha <=" ."""
    if start is None:
        oldest = db.oldest_transaction_date()
        if oldest is None:
            logger.info("backfill de tasas: no hay transacciones")
            return {}
        start = oldest - timedelta(days=BACKFILL_MARGIN_DAYS)
    end = end or today + timedelta(days=TRM_DAYS_AHEAD)
    return sync_range(db, http, start, end, today)


def ensure_history(db: FxStore, http: Http, today: date) -> dict[str, dict]:
    """Trae el histórico si falta: sin TRM guardadas o con transacciones más viejas que la primera
    (base recién restaurada, transacciones importadas). Con el histórico completo no llama a nadie."""
    oldest = db.oldest_transaction_date()
    if oldest is None:
        return {}
    earliest = db.earliest_rate_date(SOURCE_TRM)
    if earliest is not None and earliest <= oldest:
        return {}
    logger.info("faltan tasas históricas: backfill", extra={"oldest_transaction": oldest.isoformat(),
                                                             "earliest_trm": earliest.isoformat() if earliest else None})
    return backfill(db, http, today, end=earliest)


def has_errors(summary: dict) -> bool:
    return any(isinstance(result, dict) and "error" in result for result in summary.values())
