"""Hallazgo 5: solo las credenciales marcan la conexión; lo transitorio se reintenta."""

import json
from unittest.mock import MagicMock

import pytest
import requests
from google.auth.exceptions import RefreshError, TransportError
from googleapiclient.errors import HttpError

from worker import errors
from worker.errors import CredentialError, OAuthError, PermanentJobError, TransientError, classify


def gmail_http_error(status, reason=""):
    resp = MagicMock()
    resp.status = status
    resp.reason = "x"
    content = json.dumps({"error": {"errors": [{"reason": reason}], "status": ""}}).encode()
    return HttpError(resp, content)


def http_error(status, code=""):
    response = requests.Response()
    response.status_code = status
    response._content = json.dumps({"error": {"code": code}}).encode()
    return requests.HTTPError(f"{status} Error", response=response)


@pytest.mark.parametrize("exc, code", [
    (RefreshError("invalid_grant: Token has been expired or revoked.", {}), errors.TOKEN_EXPIRED_OR_REVOKED),
    (RefreshError("deleted_client: The OAuth client was deleted.", {}), errors.OAUTH_CLIENT_DELETED),
    (OAuthError("microsoft", "invalid_grant", "AADSTS70008: The refresh token has expired"), errors.TOKEN_EXPIRED_OR_REVOKED),
    (OAuthError("microsoft", "interaction_required", "AADSTS50076"), errors.TOKEN_EXPIRED_OR_REVOKED),
    (OAuthError("microsoft", "unauthorized_client", "AADSTS700016: Application not found"), errors.OAUTH_CLIENT_DELETED),
    (gmail_http_error(403, "insufficientPermissions"), errors.AUTHORIZATION_ERROR),
    (gmail_http_error(401, "authError"), errors.TOKEN_EXPIRED_OR_REVOKED),
    (http_error(401, "InvalidAuthenticationToken"), errors.TOKEN_EXPIRED_OR_REVOKED),
    (http_error(403, "ErrorAccessDenied"), errors.AUTHORIZATION_ERROR),
    (Exception("Token has been expired or revoked."), errors.TOKEN_EXPIRED_OR_REVOKED),
])
def test_credential_errors(exc, code):
    result = classify(exc)
    assert isinstance(result, CredentialError)
    assert result.code == code
    # mismos códigos que entiende el front
    assert result.code in ("token_expired_or_revoked", "oauth_client_deleted", "authorization_error")


def gemini_server_error():
    from google.genai import errors as genai_errors
    return genai_errors.ServerError(503, {"error": {"code": 503, "message": "The model is overloaded", "status": "UNAVAILABLE"}})


@pytest.mark.parametrize("exc", [
    gemini_server_error(),
    gmail_http_error(500),
    gmail_http_error(429),
    gmail_http_error(403, "userRateLimitExceeded"),
    gmail_http_error(403, "rateLimitExceeded"),
    http_error(503),
    http_error(429),
    requests.ConnectionError("connection reset"),
    requests.Timeout("read timeout"),
    TransportError("dns"),
    OAuthError("microsoft", "temporarily_unavailable", "", status=503),
    json.JSONDecodeError("Expecting value", "", 0),
    RuntimeError("algo inesperado"),
])
def test_transient_errors_never_mark_the_connection(exc):
    assert isinstance(classify(exc), TransientError)


def test_our_misconfigured_client_does_not_mark_users():
    # un client secret mal rotado no es culpa del usuario: no se apagan todas las conexiones
    assert isinstance(classify(OAuthError("google", "invalid_client", "Unauthorized")), PermanentJobError)
    assert isinstance(classify(RefreshError("invalid_client: Unauthorized", {})), PermanentJobError)


def test_backoff_schedule():
    assert [errors.backoff_seconds(n) for n in (1, 2, 3, 4)] == [60, 300, 900, 900]


def test_credential_error_rejects_unknown_codes():
    with pytest.raises(ValueError):
        CredentialError("unknown_error")
