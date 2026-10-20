"""Contrato del extractor (preparado para evaluar Jev u otro en el futuro, ver plan/04)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from worker.providers.base import EmailMessage


@dataclass(frozen=True)
class AccountRef:
    last_four_digits: str
    account_id: int


@dataclass(frozen=True)
class ExtractedTransaction:
    is_transaction: bool
    account_number: str = ""
    amount: float | None = None
    expense: bool | None = None
    date: datetime | None = None
    description: str = ""
    confidence: float | None = None  # None = el extractor no da confianza (Gemini)
    reason: str = ""                 # por qué no es transacción (si el extractor lo dice)


class TransactionExtractor(Protocol):
    name: str  # se guarda en processed_emails.extractor

    def extract(self, email: EmailMessage, accounts: list[AccountRef]) -> list[ExtractedTransaction]:
        """Transacciones encontradas en el correo. Una lista con is_transaction=False si no hay."""
