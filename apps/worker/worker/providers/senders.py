"""Hallazgos 1 y 2: `banks.email` puede tener varios remitentes separados por coma, y la búsqueda de
Gmail ya no mete Bancolombia fijo. Cada remitente se busca por separado dentro de un solo OR."""

from __future__ import annotations

import re
from datetime import datetime, timezone

_SPLIT = re.compile(r"[,;\s]+")


def split_senders(raw: str | None) -> list[str]:
    """'a@x.co, b@y.co,,a@x.co' -> ['a@x.co', 'b@y.co'] (sin vacíos ni repetidos, en orden)."""
    seen: dict[str, None] = {}
    for part in _SPLIT.split(raw or ""):
        part = part.strip().strip("'\"")
        if part and "@" in part and part.lower() not in (s.lower() for s in seen):
            seen[part] = None
    return list(seen)


def gmail_query(senders: list[str], since: datetime, before: datetime | None = None) -> str:
    """Query de búsqueda de Gmail. `after:`/`before:` con epoch (segundos), no con fecha:
    así la ventana respeta la hora exacta de la última corrida."""
    if not senders:
        raise ValueError("no hay remitentes para buscar")
    parts = [f"from:({' OR '.join(senders)})", f"after:{int(since.timestamp())}"]
    if before is not None:
        parts.append(f"before:{int(before.timestamp())}")
    return " ".join(parts)


def _odata_str(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def outlook_filter(senders: list[str], since: datetime, before: datetime | None = None) -> str:
    """$filter de Microsoft Graph: (from eq a or from eq b) and receivedDateTime ge <since UTC>."""
    if not senders:
        raise ValueError("no hay remitentes para buscar")
    by_sender = " or ".join(f"from/emailAddress/address eq {_odata_str(s)}" for s in senders)
    since_utc = since.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    expression = f"({by_sender}) and receivedDateTime ge {since_utc}"
    if before is not None:
        before_utc = before.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        expression += f" and receivedDateTime lt {before_utc}"
    return expression
