from unittest.mock import MagicMock

import pytest
import requests

from worker.api_client import TopiApi
from worker.errors import PermanentJobError, TransientError


def fake_response(status=200, body=None):
    response = MagicMock()
    response.status_code = status
    response.json.return_value = body or {}
    response.content = b"{}" if body is not None else b""
    return response


def make_api(*responses):
    session = MagicMock(spec=requests.Session)
    session.headers = {}
    session.request.side_effect = list(responses)
    return TopiApi("http://api:8080/", "secret-key", session=session), session


def test_sends_api_key_and_no_prod_prefix():
    api, session = make_api(fake_response(200, {"data": {"access_token": "a", "refresh_token": "r"}}))

    tokens = api.get_email_tokens("user-1", 7)

    assert tokens == {"access_token": "a", "refresh_token": "r"}
    assert session.headers["X-API-Key"] == "secret-key"
    method, url = session.request.call_args.args
    assert (method, url) == ("GET", "http://api:8080/email/user-1/7")


def test_list_accounts_paginates_with_skip():
    # hallazgo 7: /accounts/admin/list devuelve máx. 100 por página
    # total = cuentas en la DB; cada página puede traer más filas porque la API divide por remitente
    page1 = {"data": {"user_accounts": {"u1": [{"id": i} for i in range(100)] + [{"id": 0, "split": True}]},
                      "meta": {"total": 130}}}
    page2 = {"data": {"user_accounts": {"u1": [{"id": 100}], "u2": [{"id": i} for i in range(101, 130)]},
                      "meta": {"total": 130}}}
    api, session = make_api(fake_response(200, page1), fake_response(200, page2))

    result = api.list_accounts()

    accounts = result["data"]["user_accounts"]
    assert len(accounts["u1"]) == 102 and len(accounts["u2"]) == 29
    skips = [call.kwargs["params"]["skip"] for call in session.request.call_args_list]
    assert skips == [0, 100]


def test_create_transactions_returns_created_and_skipped():
    body = {"data": {"transactions": [{"id": 1, "source_message_id": "m1"}],
                     "skipped": [{"source_message_id": "m2", "reason": "duplicate_message"}]}}
    api, session = make_api(fake_response(201, body))

    result = api.create_transactions("u1", [{"account_id": 1}])

    assert result["transactions"][0]["id"] == 1
    assert result["skipped"][0]["reason"] == "duplicate_message"
    assert session.request.call_args.kwargs["json"] == {"user_id": "u1", "transactions": [{"account_id": 1}]}


@pytest.mark.parametrize("status", [500, 502, 503, 429])
def test_server_errors_are_transient(status):
    api, _ = make_api(fake_response(status, {}))
    with pytest.raises(TransientError):
        api.get_email_tokens("u1", 1)


def test_network_errors_are_transient():
    session = MagicMock(spec=requests.Session)
    session.headers = {}
    session.request.side_effect = requests.ConnectionError("refused")
    api = TopiApi("http://api:8080", "k", session=session)
    with pytest.raises(TransientError):
        api.list_accounts()


def test_client_errors_fail_the_job_without_marking():
    api, _ = make_api(fake_response(400, {"messages": ["invalid"]}))
    with pytest.raises(PermanentJobError, match="invalid"):
        api.create_transactions("u1", [])
