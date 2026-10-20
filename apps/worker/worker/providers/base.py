from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterator, Protocol


@dataclass(frozen=True)
class EmailMessage:
    """Un correo leído. El cuerpo vive solo en memoria durante el job: nunca se guarda."""

    id: str
    subject: str
    sender: str
    received_at: datetime  # siempre con zona (UTC)
    body: str


@dataclass(frozen=True)
class MessageRef:
    """Referencia barata a un mensaje (antes de descargar el cuerpo)."""

    id: str


class MailProvider(Protocol):
    name: str

    def list_messages(self, senders: list[str], since: datetime) -> Iterator[MessageRef]:
        """Todos los mensajes de esos remitentes desde `since`, paginando."""

    def get_message(self, ref: MessageRef) -> EmailMessage:
        """Descarga y limpia el cuerpo del mensaje."""
