"""Outlook / Microsoft Graph (ex lib/microsoft_utils.py).

Cambios respecto a la Lambda:
- hallazgo 2: remitentes separados por coma -> (from eq a or from eq b ...);
- hallazgo 3: paginación siguiendo @odata.nextLink;
- hallazgo 4: receivedDateTime ge <since en UTC con hora> (antes solo la fecha);
- el endpoint de token sale de OUTLOOK_TOKEN_URI y los errores OAuth se devuelven estructurados
  (OAuthError) para clasificar credencial vs transitorio.
La limpieza del cuerpo (HTML -> texto) es la original.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Iterator

import requests
from bs4 import BeautifulSoup

from worker import log
from worker.errors import OAuthError
from worker.mapping import parse_email_date
from worker.providers.base import EmailMessage, MessageRef
from worker.providers.senders import outlook_filter

logger = log.get(__name__)

SCOPE = "https://graph.microsoft.com/.default"
MESSAGES_URL = "https://graph.microsoft.com/v1.0/me/messages"
PAGE_SIZE = 100
TIMEOUT = 30


def authenticate(refresh_token: str, client_id: str, client_secret: str, token_uri: str,
                 session: requests.Session | None = None) -> str:
    """Refresh token -> access token (grant refresh_token, igual que la Lambda)."""
    http = session or requests
    response = http.post(token_uri, data={
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": SCOPE,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }, timeout=TIMEOUT)

    try:
        result = response.json()
    except ValueError:
        result = {}

    if response.status_code >= 400 or "access_token" not in result:
        raise OAuthError(
            "microsoft",
            result.get("error", f"http_{response.status_code}"),
            result.get("error_description", ""),
            status=response.status_code,
        )
    return result["access_token"]


class OutlookProvider:
    name = "outlook"

    def __init__(self, access_token: str, session: requests.Session | None = None):
        self.session = session or requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"})
        self._bodies: dict[str, dict] = {}

    @classmethod
    def from_tokens(cls, tokens: dict, client_id: str, client_secret: str, token_uri: str) -> "OutlookProvider":
        access_token = authenticate(tokens["refresh_token"], client_id, client_secret, token_uri)
        return cls(access_token)

    def list_messages(self, senders: list[str], since: datetime) -> Iterator[MessageRef]:
        expression = outlook_filter(senders, since)
        logger.info("outlook filter", extra={"filter": expression})

        url: str | None = MESSAGES_URL
        params: dict[str, Any] | None = {
            "$filter": expression,
            "$select": "id,subject,from,receivedDateTime,body",
            "$top": PAGE_SIZE,
        }
        while url:
            response = self.session.get(url, params=params, timeout=TIMEOUT)
            response.raise_for_status()
            results = response.json()
            for message in results.get("value", []):
                # Graph ya trae el cuerpo en el listado: se guarda en memoria para get_message
                self._bodies[message["id"]] = message
                yield MessageRef(id=message["id"])
            url = results.get("@odata.nextLink")
            params = None  # el nextLink ya incluye los parámetros

    def get_message(self, ref: MessageRef) -> EmailMessage:
        message = self._bodies.pop(ref.id, None)
        if message is None:
            response = self.session.get(
                f"{MESSAGES_URL}/{ref.id}",
                params={"$select": "id,subject,from,receivedDateTime,body"},
                timeout=TIMEOUT,
            )
            response.raise_for_status()
            message = response.json()
        return parse_graph_message(message)


def graph_html_to_text(content: str) -> str:
    """Limpieza original de microsoft_utils.get_message_details."""
    soup = BeautifulSoup(content, "html.parser")
    text = soup.get_text()
    text = text.replace("\n", " ").replace("\t", " ")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\n\s*\n", "\n", text)

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


def parse_graph_message(message: dict) -> EmailMessage:
    body = graph_html_to_text((message.get("body") or {}).get("content") or "")
    return EmailMessage(
        id=message["id"],
        subject=message.get("subject") or "",
        sender=((message.get("from") or {}).get("emailAddress") or {}).get("address", ""),
        received_at=parse_email_date(message["receivedDateTime"]),
        body=body,
    )
