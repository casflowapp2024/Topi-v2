"""Gmail (ex lib/google_utils.py).

Cambios respecto a la Lambda:
- hallazgo 1: sin `alertasynotificaciones@bancolombia.com.co` fijo en la búsqueda;
- hallazgo 2: remitentes separados por coma -> from:(a OR b OR c);
- hallazgo 3: paginación con nextPageToken;
- hallazgo 4: fechas como datetime UTC (after: con epoch).
La extracción del cuerpo (HTML -> texto con BeautifulSoup) es la original.
"""

from __future__ import annotations

import base64
from datetime import datetime
from typing import Any, Iterator

from bs4 import BeautifulSoup
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from worker import log
from worker.mapping import parse_email_date
from worker.providers.base import EmailMessage, MessageRef
from worker.providers.senders import gmail_query

logger = log.get(__name__)

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
PAGE_SIZE = 100


def build_credentials(tokens: dict, client_id: str, client_secret: str, token_uri: str) -> Credentials:
    """Credenciales OAuth del usuario con nuestro client. Si el access token venció, la librería lo
    renueva con el refresh token en la primera llamada (como en la Lambda)."""
    return Credentials(
        token=tokens.get("access_token") or None,
        refresh_token=tokens.get("refresh_token"),
        token_uri=token_uri,
        client_id=client_id,
        client_secret=client_secret,
        scopes=SCOPES,
    )


class GmailProvider:
    name = "gmail"

    def __init__(self, service: Any):
        self.service = service

    @classmethod
    def from_tokens(cls, tokens: dict, client_id: str, client_secret: str, token_uri: str) -> "GmailProvider":
        credentials = build_credentials(tokens, client_id, client_secret, token_uri)
        return cls(build("gmail", "v1", credentials=credentials, cache_discovery=False))

    def list_messages(self, senders: list[str], since: datetime) -> Iterator[MessageRef]:
        query = gmail_query(senders, since)
        logger.info("gmail query", extra={"query": query})

        page_token = None
        while True:
            request = self.service.users().messages().list(
                userId="me", q=query, maxResults=PAGE_SIZE, pageToken=page_token
            )
            results = request.execute()
            for message in results.get("messages", []):
                yield MessageRef(id=message["id"])
            page_token = results.get("nextPageToken")
            if not page_token:
                break

    def get_message(self, ref: MessageRef) -> EmailMessage:
        message = self.service.users().messages().get(userId="me", id=ref.id, format="full").execute()
        return parse_gmail_message(message)


def _extract_charset(content_type: str) -> str:
    """Charset del header Content-Type, UTF-8 por defecto."""
    parts = content_type.split(";")
    if len(parts) > 1:
        for part in parts[1:]:
            if "charset=" in part:
                return part.strip().split("=")[1].strip('"')
    return "UTF-8"


def _part_charset(part: dict) -> str:
    content_type = next(
        (h["value"] for h in part.get("headers") or [] if h["name"].lower() == "content-type"), ""
    )
    return _extract_charset(content_type) if content_type else "UTF-8"


def _find_body(payload: dict) -> tuple[str | None, str]:
    """(data base64, charset). Prefiere text/html como la Lambda; si el correo solo trae
    text/plain, usa ese en lugar de fallar."""
    mime = payload.get("mimeType", "")
    if "multipart" in mime:
        html, plain = None, None
        stack = list(payload.get("parts") or [])
        while stack:
            part = stack.pop(0)
            part_mime = part.get("mimeType", "")
            data = (part.get("body") or {}).get("data")
            if part_mime == "text/html" and data and html is None:
                html = (data, _part_charset(part))
            elif part_mime == "text/plain" and data and plain is None:
                plain = (data, _part_charset(part))
            elif part_mime.startswith("multipart/"):
                stack.extend(part.get("parts") or [])
        chosen = html or plain
        return chosen if chosen else (None, "UTF-8")
    if "text/html" in mime or "text/plain" in mime:
        return (payload.get("body") or {}).get("data"), "UTF-8"
    return None, "UTF-8"


def html_to_text(body_html: str) -> str:
    soup = BeautifulSoup(body_html, "html.parser")
    for script in soup(["script", "style"]):
        script.decompose()
    text = soup.get_text()

    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    return " ".join(chunk for chunk in chunks if chunk)


def parse_gmail_message(message: dict) -> EmailMessage:
    headers = message["payload"].get("headers") or []

    subject = next((h["value"] for h in headers if h["name"] == "Subject"), "No Subject")
    sender = next((h["value"] for h in headers if h["name"] == "From"), "Unknown Sender")
    date = next((h["value"] for h in headers if h["name"] == "Date"), None)

    if date:
        received_at = parse_email_date(date)
    else:
        # internalDate: ms desde epoch (UTC)
        from datetime import timezone

        received_at = datetime.fromtimestamp(int(message["internalDate"]) / 1000, tz=timezone.utc)

    data, charset = _find_body(message["payload"])
    if data:
        body_html = base64.urlsafe_b64decode(data).decode(charset, errors="replace")
        body = html_to_text(body_html)
    else:
        body = "No data extracted from mail"

    return EmailMessage(id=message["id"], subject=subject, sender=sender, received_at=received_at, body=body)
