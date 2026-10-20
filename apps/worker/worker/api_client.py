"""Cliente de la API de Topi con X-API-Key (rutas admin/*). Reemplaza lib/api_utils.CashflowBack:
ya no inicia sesión con un usuario admin ni usa el prefijo /prod de API Gateway."""

from __future__ import annotations

from typing import Any

import requests

from worker import log
from worker.errors import PermanentJobError, TransientError

logger = log.get(__name__)

ACCOUNTS_PAGE_SIZE = 100


class TopiApi:
    def __init__(self, base_url: str, api_key: str, timeout: float = 30.0, session: requests.Session | None = None):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = session or requests.Session()
        self.session.headers.update({
            "X-API-Key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        })

    # ------------------------------------------------------------------ HTTP

    def _request(self, method: str, path: str, **kwargs) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        try:
            response = self.session.request(method, url, timeout=self.timeout, **kwargs)
        except (requests.ConnectionError, requests.Timeout) as exc:
            raise TransientError(f"API {method} {path}: {exc}") from exc

        if response.status_code >= 500 or response.status_code == 429:
            raise TransientError(f"API {method} {path}: HTTP {response.status_code}")
        if response.status_code >= 400:
            messages = ""
            try:
                messages = ", ".join(response.json().get("messages", []))
            except ValueError:
                pass
            raise PermanentJobError(f"API {method} {path}: HTTP {response.status_code} {messages}".strip())

        if not response.content:
            return {}
        return response.json()

    # ------------------------------------------------------------------ endpoints

    def list_accounts(self) -> dict[str, Any]:
        """Todas las cuentas con lectura automática, paginando `GET /accounts/admin/list`
        (máx. 100 por página). Devuelve el formato que espera transform_automations_msgs:
        {"data": {"user_accounts": {user_id: [cuentas...]}}}."""
        user_accounts: dict[str, list[dict[str, Any]]] = {}
        skip, total = 0, None

        while total is None or skip < total:
            body = self._request("GET", "/accounts/admin/list", params={"skip": skip, "limit": ACCOUNTS_PAGE_SIZE})
            data = body.get("data") or {}
            page = data.get("user_accounts") or {}
            count = 0
            for user_id, accounts in page.items():
                user_accounts.setdefault(user_id, []).extend(accounts)
                count += len(accounts)

            total = int((data.get("meta") or {}).get("total") or 0)
            if count == 0:
                break
            skip += count

        return {"data": {"user_accounts": user_accounts}}

    def get_email_tokens(self, user_id: str, email_id: int) -> dict[str, Any]:
        body = self._request("GET", f"/email/{user_id}/{email_id}")
        return body.get("data") or {}

    def create_transactions(self, user_id: str, transactions: list[dict[str, Any]]) -> dict[str, Any]:
        """POST /transactions/admin/create. Idempotente por source_message_id.
        Devuelve {"transactions": [{id, source_message_id}], "skipped": [{source_message_id, reason}]}."""
        body = self._request("POST", "/transactions/admin/create", json={
            "user_id": user_id,
            "transactions": transactions,
        })
        data = body.get("data") or {}
        return {
            "transactions": data.get("transactions") or [],
            "skipped": data.get("skipped") or [],
        }

    def report_email_error(self, email_id: int, code: str) -> None:
        """Marca la conexión con error (solo códigos de credenciales que entiende el front)."""
        self._request("PUT", f"/email/admin/error/{email_id}", json={"error": code})

    def confirm_email_read(self, user_id: str) -> None:
        """Onboarding: avisa que ya se leyó el correo (PUT /user-extra/admin/read-email)."""
        self._request("PUT", "/user-extra/admin/read-email", json={"user_id": user_id, "read": True})
