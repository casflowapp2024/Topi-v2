"""Outlook: paginación con @odata.nextLink (hallazgo 3), filtro (2), fechas (4) y errores OAuth."""

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
import requests

from worker.errors import CredentialError, OAuthError, TransientError, classify
from worker.providers.base import MessageRef
from worker.providers.outlook import OutlookProvider, authenticate

SINCE = datetime(2026, 10, 17, 8, 0, tzinfo=timezone.utc)


def graph_message(i: int) -> dict:
    return {
        "id": f"m{i}",
        "subject": "Compra",
        "from": {"emailAddress": {"address": "noreply@rappicard.co"}},
        "receivedDateTime": "2026-10-18T15:15:00Z",
        "body": {"contentType": "html", "content": f"<p>Compra   {i}</p>"},
    }


def response(status=200, body=None):
    r = MagicMock()
    r.status_code = status
    r.json.return_value = body or {}
    r.raise_for_status.side_effect = None if status < 400 else requests.HTTPError(f"{status}", response=r)
    return r


def test_list_messages_follows_next_link_and_reuses_bodies():
    session = MagicMock(spec=requests.Session)
    session.headers = {}
    session.get.side_effect = [
        response(200, {"value": [graph_message(i) for i in range(100)],
                       "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/messages?$skip=100"}),
        response(200, {"value": [graph_message(100)]}),
    ]
    provider = OutlookProvider("token", session=session)

    refs = list(provider.list_messages(["rappi.nreply@rappi.com", "noreply@rappicard.co"], SINCE))

    assert len(refs) == 101
    first, second = session.get.call_args_list
    assert first.kwargs["params"]["$filter"] == (
        "(from/emailAddress/address eq 'rappi.nreply@rappi.com' or from/emailAddress/address eq 'noreply@rappicard.co')"
        " and receivedDateTime ge 2026-10-17T08:00:00Z"
    )
    assert second.args[0].endswith("$skip=100") and second.kwargs["params"] is None
    assert session.headers["Authorization"] == "Bearer token"

    email = provider.get_message(MessageRef("m100"))
    assert email.body == "Compra 100"
    assert email.received_at == datetime(2026, 10, 18, 15, 15, tzinfo=timezone.utc)
    assert email.sender == "noreply@rappicard.co"
    assert session.get.call_count == 2, "el cuerpo ya venía en el listado"


def test_authenticate_ok():
    session = MagicMock()
    session.post.return_value = response(200, {"access_token": "new"})
    assert authenticate("r", "cid", "secret", "https://login/token", session=session) == "new"
    data = session.post.call_args.kwargs["data"]
    assert data["grant_type"] == "refresh_token" and data["scope"] == "https://graph.microsoft.com/.default"
    assert session.post.call_args.args[0] == "https://login/token"


def test_authenticate_revoked_refresh_token_is_a_credential_error():
    session = MagicMock()
    session.post.return_value = response(400, {
        "error": "invalid_grant",
        "error_description": "AADSTS70008: The provided authorization code or refresh token has expired",
    })
    with pytest.raises(OAuthError) as excinfo:
        authenticate("r", "cid", "secret", "https://login/token", session=session)
    result = classify(excinfo.value)
    assert isinstance(result, CredentialError) and result.code == "token_expired_or_revoked"


def test_authenticate_server_error_is_transient():
    session = MagicMock()
    session.post.return_value = response(503, {"error": "temporarily_unavailable"})
    with pytest.raises(OAuthError) as excinfo:
        authenticate("r", "cid", "secret", "https://login/token", session=session)
    assert isinstance(classify(excinfo.value), TransientError)
