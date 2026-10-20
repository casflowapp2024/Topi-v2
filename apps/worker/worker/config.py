"""Configuración desde variables de entorno (ver .env.example)."""

from __future__ import annotations

import os
import socket
from dataclasses import dataclass, field


class ConfigError(ValueError):
    """Falta o es inválida una variable de entorno."""


def _bool(value: str | None, default: bool) -> bool:
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in ("1", "true", "yes", "si", "on")


def _int(env: dict, key: str, default: int) -> int:
    raw = env.get(key, "")
    if raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise ConfigError(f"{key} debe ser un entero, se recibió {raw!r}") from exc


def _int_set(raw: str | None) -> frozenset[int]:
    if not raw or not raw.strip():
        return frozenset()
    try:
        return frozenset(int(part) for part in raw.split(",") if part.strip())
    except ValueError as exc:
        raise ConfigError(f"WORKER_ONLY_EMAIL_IDS debe ser una lista de enteros: {raw!r}") from exc


@dataclass(frozen=True)
class Settings:
    database_url: str
    api_base_url: str
    internal_api_key: str

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"

    gmail_client_id: str = ""
    gmail_client_secret: str = ""
    gmail_token_uri: str = "https://oauth2.googleapis.com/token"
    outlook_client_id: str = ""
    outlook_client_secret: str = ""
    outlook_token_uri: str = "https://login.microsoftonline.com/common/oauth2/v2.0/token"

    poll_seconds: int = 5
    concurrency: int = 2
    sync_overlap_minutes: int = 60
    processed_email_retention_days: int = 365
    job_retention_days: int = 30
    orphan_minutes: int = 15
    max_attempts: int = 3
    extractor: str = "gemini"
    confidence_threshold: float = 0.7
    scheduler_enabled: bool = True
    timezone: str = "America/Bogota"
    dry_run: bool = False
    only_email_ids: frozenset[int] = field(default_factory=frozenset)
    worker_id: str = field(default_factory=lambda: f"{socket.gethostname()}:{os.getpid()}")

    @classmethod
    def from_env(cls, env: dict | None = None) -> "Settings":
        env = dict(os.environ if env is None else env)

        missing = [key for key in ("DATABASE_URL", "API_BASE_URL", "INTERNAL_API_KEY") if not env.get(key)]
        if missing:
            raise ConfigError(f"Faltan variables de entorno obligatorias: {', '.join(missing)}")

        return cls(
            database_url=env["DATABASE_URL"],
            api_base_url=env["API_BASE_URL"].rstrip("/"),
            internal_api_key=env["INTERNAL_API_KEY"],
            gemini_api_key=env.get("GEMINI_API_KEY", ""),
            gemini_model=env.get("GEMINI_MODEL") or "gemini-2.5-flash-lite",
            gmail_client_id=env.get("GMAIL_CLIENT_ID", ""),
            gmail_client_secret=env.get("GMAIL_CLIENT_SECRET", ""),
            gmail_token_uri=env.get("GMAIL_TOKEN_URI") or "https://oauth2.googleapis.com/token",
            outlook_client_id=env.get("OUTLOOK_CLIENT_ID", ""),
            outlook_client_secret=env.get("OUTLOOK_CLIENT_SECRET", ""),
            outlook_token_uri=env.get("OUTLOOK_TOKEN_URI")
            or "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            poll_seconds=_int(env, "WORKER_POLL_SECONDS", 5),
            concurrency=max(1, _int(env, "WORKER_CONCURRENCY", 2)),
            sync_overlap_minutes=_int(env, "SYNC_OVERLAP_MINUTES", 60),
            processed_email_retention_days=_int(env, "PROCESSED_EMAIL_RETENTION_DAYS", 365),
            extractor=(env.get("WORKER_EXTRACTOR") or "gemini").strip().lower(),
            scheduler_enabled=_bool(env.get("SCHEDULER_ENABLED"), True),
            dry_run=_bool(env.get("WORKER_DRY_RUN"), False),
            only_email_ids=_int_set(env.get("WORKER_ONLY_EMAIL_IDS")),
        )

    def require_for_processing(self) -> None:
        """Lo que hace falta para procesar jobs (leer correos y extraer transacciones)."""
        missing = []
        if self.extractor == "gemini" and not self.gemini_api_key:
            missing.append("GEMINI_API_KEY")
        if not (self.gmail_client_id and self.gmail_client_secret):
            missing.append("GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET")
        if not (self.outlook_client_id and self.outlook_client_secret):
            missing.append("OUTLOOK_CLIENT_ID/OUTLOOK_CLIENT_SECRET")
        if self.extractor != "gemini":
            raise ConfigError(f"WORKER_EXTRACTOR desconocido: {self.extractor!r} (disponible: gemini)")
        if missing:
            raise ConfigError(f"Faltan variables para procesar correos: {', '.join(missing)}")

    def allows_email(self, email_id: int) -> bool:
        """WORKER_ONLY_EMAIL_IDS restringe el worker a esas conexiones (pruebas con correos del equipo)."""
        return not self.only_email_ids or int(email_id) in self.only_email_ids
