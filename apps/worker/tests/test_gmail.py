"""Gmail: paginación (hallazgo 3), query (1, 2), fechas con zona (4) y extracción del cuerpo."""

import base64
from datetime import datetime, timezone
from unittest.mock import MagicMock

from worker.providers.gmail import GmailProvider, build_credentials, parse_gmail_message
from worker.providers.base import MessageRef

SINCE = datetime(2026, 10, 17, 8, 0, tzinfo=timezone.utc)


def b64(text: str) -> str:
    return base64.urlsafe_b64encode(text.encode("utf-8")).decode()


def fake_service(pages):
    service = MagicMock()
    list_call = service.users.return_value.messages.return_value.list
    list_call.return_value.execute.side_effect = pages
    return service, list_call


def test_list_messages_follows_next_page_token():
    pages = [
        {"messages": [{"id": f"m{i}"} for i in range(100)], "nextPageToken": "p2"},
        {"messages": [{"id": f"m{i}"} for i in range(100, 150)], "nextPageToken": "p3"},
        {"messages": [{"id": "m150"}]},
    ]
    service, list_call = fake_service(pages)

    refs = list(GmailProvider(service).list_messages(["a@x.co", "b@y.co"], SINCE))

    assert len(refs) == 151
    tokens = [call.kwargs["pageToken"] for call in list_call.call_args_list]
    assert tokens == [None, "p2", "p3"]
    query = list_call.call_args_list[0].kwargs["q"]
    assert query == "from:(a@x.co OR b@y.co) after:1792224000"
    assert "bancolombia" not in query


def test_list_messages_empty():
    service, _ = fake_service([{"resultSizeEstimate": 0}])
    assert list(GmailProvider(service).list_messages(["a@x.co"], SINCE)) == []


def test_parse_message_html_and_timezone():
    message = {
        "id": "abc",
        "payload": {
            "mimeType": "multipart/alternative",
            "headers": [
                {"name": "Subject", "value": "Compra aprobada"},
                {"name": "From", "value": "Banco <alertas@banco.test>"},
                {"name": "Date", "value": "Sat, 18 Oct 2026 10:15:00 -0500 (COT)"},
            ],
            "parts": [
                {"mimeType": "text/plain", "body": {"data": b64("plano")}},
                {"mimeType": "text/html", "headers": [{"name": "Content-Type", "value": 'text/html; charset="UTF-8"'}],
                 "body": {"data": b64("<html><style>x{}</style><p>Compra   por  $10.000</p><script>1</script></html>")}},
            ],
        },
    }

    email = parse_gmail_message(message)

    assert email.received_at == datetime(2026, 10, 18, 15, 15, tzinfo=timezone.utc)
    assert email.received_at.tzinfo is not None
    assert email.body == "Compra por $10.000"
    assert email.subject == "Compra aprobada"


def test_parse_message_nested_multipart_and_plain_fallback():
    nested = {
        "id": "n1",
        "payload": {
            "mimeType": "multipart/mixed",
            "headers": [{"name": "Date", "value": "Sat, 18 Oct 2026 15:15:00 +0000"}],
            "parts": [{"mimeType": "multipart/related", "parts": [
                {"mimeType": "text/html", "body": {"data": b64("<b>Transferencia</b>")}},
            ]}],
        },
    }
    assert parse_gmail_message(nested).body == "Transferencia"

    plain_only = {
        "id": "p1",
        "payload": {
            "mimeType": "multipart/alternative",
            "headers": [{"name": "Date", "value": "Sat, 18 Oct 2026 15:15:00 +0000"}],
            "parts": [{"mimeType": "text/plain", "body": {"data": b64("Pago recibido")}}],
        },
    }
    # la Lambda fallaba aquí (b64decode(None)); ahora usa el text/plain
    assert parse_gmail_message(plain_only).body == "Pago recibido"


def test_get_message_requests_full_format():
    service = MagicMock()
    get_call = service.users.return_value.messages.return_value.get
    get_call.return_value.execute.return_value = {
        "id": "abc",
        "payload": {"mimeType": "text/html", "headers": [{"name": "Date", "value": "Sat, 18 Oct 2026 15:15:00 +0000"}],
                    "body": {"data": b64("<p>x</p>")}},
    }

    GmailProvider(service).get_message(MessageRef("abc"))

    assert get_call.call_args.kwargs == {"userId": "me", "id": "abc", "format": "full"}


def test_build_credentials_uses_our_client_and_refresh_token():
    creds = build_credentials({"access_token": "a", "refresh_token": "r"}, "cid", "csecret", "https://token")
    assert (creds.token, creds.refresh_token, creds.client_id, creds.token_uri) == ("a", "r", "cid", "https://token")
    assert creds.scopes == ["https://www.googleapis.com/auth/gmail.readonly"]
