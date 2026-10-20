"""Clasificación de errores del worker.

Regla de la Fase 3: **solo** los errores de credenciales del usuario marcan la conexión con error
(la API la excluye de la lectura hasta que el usuario la reconecte). Todo lo demás se reintenta o
falla el job sin tocar la conexión.

Los códigos que se envían a la API son los que entiende el front (apps/web/src/components/errosMaping.js):
token_expired_or_revoked, oauth_client_deleted, authorization_error.
"""

from __future__ import annotations

import json
import socket

import requests

TOKEN_EXPIRED_OR_REVOKED = "token_expired_or_revoked"
OAUTH_CLIENT_DELETED = "oauth_client_deleted"
AUTHORIZATION_ERROR = "authorization_error"

CREDENTIAL_CODES = (TOKEN_EXPIRED_OR_REVOKED, OAUTH_CLIENT_DELETED, AUTHORIZATION_ERROR)


class WorkerError(Exception):
    """Base de los errores clasificados."""


class CredentialError(WorkerError):
    """Credenciales del usuario inválidas: se marca la conexión con `code` y el job falla."""

    def __init__(self, code: str, message: str = ""):
        if code not in CREDENTIAL_CODES:
            raise ValueError(f"código de credencial desconocido: {code}")
        super().__init__(message or code)
        self.code = code


class TransientError(WorkerError):
    """Error temporal (red, 5xx, 429, Gemini caído): el job se reintenta con backoff."""


class PermanentJobError(WorkerError):
    """El job no puede completarse (payload inválido, 4xx de la API, configuración nuestra
    como un client secret mal puesto). Falla el job **sin** marcar la conexión."""


class OAuthError(Exception):
    """Respuesta de error de un endpoint de token OAuth (Google o Microsoft)."""

    def __init__(self, provider: str, error: str, description: str = "", status: int | None = None):
        super().__init__(f"{provider} oauth error {error}: {description}".strip())
        self.provider = provider
        self.error = (error or "").lower()
        self.description = description or ""
        self.status = status


def _from_message(message: str) -> WorkerError | None:
    """Mapeo por texto heredado de lib/api_utils.py (_map_error_message_to_code)."""
    text = message.lower()
    if "the oauth client was deleted" in text or "deleted_client" in text:
        return CredentialError(OAUTH_CLIENT_DELETED, message)
    if "token has been expired or revoked" in text:
        return CredentialError(TOKEN_EXPIRED_OR_REVOKED, message)
    return None


def _from_oauth(exc: OAuthError) -> WorkerError:
    error, description = exc.error, exc.description.lower()

    if error in ("deleted_client",) or "aadsts700016" in description:
        # app eliminada / no encontrada en el tenant
        return CredentialError(OAUTH_CLIENT_DELETED, str(exc))
    if error in ("invalid_grant", "interaction_required", "consent_required"):
        return CredentialError(TOKEN_EXPIRED_OR_REVOKED, str(exc))
    if error in ("unauthorized_client", "access_denied", "insufficient_scope"):
        return CredentialError(AUTHORIZATION_ERROR, str(exc))
    if error in ("invalid_client",):
        # client id/secret nuestros mal configurados: NO es culpa del usuario
        return PermanentJobError(f"configuración OAuth inválida ({exc.provider}): {exc}")
    if exc.status is not None and (exc.status >= 500 or exc.status == 429):
        return TransientError(str(exc))
    if error in ("temporarily_unavailable", "server_error"):
        return TransientError(str(exc))
    return PermanentJobError(str(exc))


def _from_http_status(status: int, message: str, reason: str = "") -> WorkerError:
    reason = reason.lower()
    if status == 429 or status >= 500:
        return TransientError(message)
    if status == 403 and ("ratelimit" in reason.replace("_", "") or "quota" in reason):
        return TransientError(message)
    if status == 401:
        return CredentialError(TOKEN_EXPIRED_OR_REVOKED, message)
    if status == 403:
        return CredentialError(AUTHORIZATION_ERROR, message)
    return PermanentJobError(message)


def classify(exc: BaseException) -> WorkerError:
    """Convierte cualquier excepción en CredentialError, TransientError o PermanentJobError.

    Por defecto (desconocido) es transitorio: nunca se marca una conexión sin estar seguros.
    """
    if isinstance(exc, WorkerError):
        return exc

    if isinstance(exc, OAuthError):
        return _from_oauth(exc)

    # google-auth: RefreshError("invalid_grant: Token has been expired or revoked.", {...})
    try:
        from google.auth import exceptions as google_auth_exceptions

        if isinstance(exc, google_auth_exceptions.RefreshError):
            by_message = _from_message(str(exc))
            if by_message:
                return by_message
            text = str(exc).lower()
            for code in ("invalid_grant", "invalid_client", "unauthorized_client", "deleted_client"):
                if code in text:
                    return _from_oauth(OAuthError("google", code, str(exc)))
            if getattr(exc, "retryable", False):
                return TransientError(str(exc))
            return TransientError(str(exc))
        if isinstance(exc, google_auth_exceptions.TransportError):
            return TransientError(str(exc))
    except ImportError:  # pragma: no cover
        pass

    # Gmail API
    try:
        from googleapiclient.errors import HttpError

        if isinstance(exc, HttpError):
            reason = ""
            try:
                details = json.loads(exc.content.decode("utf-8", errors="replace"))
                errors = details.get("error", {}).get("errors") or [{}]
                reason = errors[0].get("reason", "") or details.get("error", {}).get("status", "")
            except (ValueError, AttributeError):
                pass
            return _from_http_status(int(exc.resp.status), str(exc), reason)
    except ImportError:  # pragma: no cover
        pass

    # Gemini (google-genai): nunca marca la conexión
    try:
        from google.genai import errors as genai_errors

        if isinstance(exc, genai_errors.APIError):
            return TransientError(f"gemini {getattr(exc, 'code', '')}: {exc}")
    except ImportError:  # pragma: no cover
        pass

    # Microsoft Graph / API de Topi vía requests
    if isinstance(exc, requests.HTTPError) and exc.response is not None:
        reason = ""
        try:
            reason = exc.response.json().get("error", {}).get("code", "")
        except (ValueError, AttributeError):
            pass
        return _from_http_status(exc.response.status_code, str(exc), reason)
    if isinstance(exc, (requests.ConnectionError, requests.Timeout, socket.timeout, TimeoutError, ConnectionError)):
        return TransientError(str(exc))

    by_message = _from_message(str(exc))
    if by_message:
        return by_message

    if isinstance(exc, (json.JSONDecodeError,)):
        return TransientError(f"respuesta inválida: {exc}")

    return TransientError(f"{type(exc).__name__}: {exc}")


def backoff_seconds(attempt: int) -> int:
    """Backoff de reintentos: 1, 5 y 15 minutos."""
    schedule = (60, 5 * 60, 15 * 60)
    return schedule[min(max(attempt, 1), len(schedule)) - 1]
