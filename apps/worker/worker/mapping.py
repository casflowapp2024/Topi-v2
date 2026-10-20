"""Utilidades heredadas de lib/general_utils.py. La lógica se mantiene; cambia el manejo de fechas
(hallazgo 4: todo es `datetime` con zona UTC) y los print pasan a logging."""

from __future__ import annotations

import email.utils
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from worker import log

logger = log.get(__name__)

API_DATE_FORMAT = "%Y-%m-%d %H:%M:%S %z"  # el que acepta la API (enums.DateTimeUtc)


def transform_automations_msgs(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Agrupa las cuentas de `/accounts/admin/list` por (correo del usuario, remitente) y arma el
    payload de cada job (el mismo que antes iba a SQS). Lógica original de general_utils."""
    result = []
    user_accounts = data.get("data", {}).get("user_accounts", {})

    if not user_accounts:
        logger.warning("no user accounts found in data")
        return result

    for user_id, accounts in user_accounts.items():
        grouped_accounts: Dict[Tuple[str, str], Dict[str, Any]] = {}

        for account in accounts:
            try:
                user_mail = account["user_email"]
                email_id = account["email_id"]
                sender_email = account["sender_email"]
                user_provider = account["user_provider"]

                group_key = (user_mail, sender_email)

                if group_key not in grouped_accounts:
                    grouped_accounts[group_key] = {
                        "user_id": user_id,
                        "user_mail": user_mail,
                        "email_id": email_id,
                        "user_provider": user_provider,
                        "sender_email": sender_email,
                        "accounts": {},
                    }

                grouped_accounts[group_key]["accounts"][account["last_four_digits"]] = str(account["id"])
            except KeyError as e:
                logger.warning("missing required field in account data", extra={"field": str(e)})
                continue

        result.extend(grouped_accounts.values())

    return result


def dedupe_key(payload: Dict[str, Any]) -> str:
    """Misma clave que la API (domain.ReadEmailBodyRequest.DedupeKey): '<email_id>:<sender_email>'."""
    return f"{payload['email_id']}:{payload['sender_email']}"


def map_account_ids(transactions: List[Dict[str, Any]], accounts: Dict[str, str]) -> List[Dict[str, Any]]:
    """Asigna account_id por los últimos 4 dígitos. Si no coincide, usa la primera cuenta del grupo y
    marca should_verify (regla original). Como ahora cada grupo es de un solo remitente (hallazgos 1
    y 2), esa primera cuenta ya es del banco correcto."""
    if not transactions or not accounts:
        raise ValueError("Empty transactions list or accounts dictionary")

    for transaction in transactions:
        try:
            account_number = transaction.get("account_number")
            if accounts.get(account_number):
                transaction["account_id"] = int(accounts.get(account_number))
            else:
                transaction["account_id"] = int(next(iter(accounts.values())))
                transaction["should_verify"] = True
        except (ValueError, TypeError) as e:
            logger.warning("error mapping account", extra={"error": str(e)})
            transaction["error"] = str(e)
            continue

    return transactions


def normalize_date_to_utc(date_str: str) -> str:
    """RFC2822 ('Mon, 28 Apr 2025 11:40:09 -0500 (COT)') o ISO 8601 ('2025-06-15T06:38:21Z') ->
    'YYYY-MM-DD HH:MM:SS +0000'. Lógica original."""
    if re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", date_str):
        try:
            if date_str.endswith("Z") and "." not in date_str:
                parsed_date = datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%SZ")
                utc_date = parsed_date.replace(tzinfo=timezone.utc)
            else:
                parsed_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                utc_date = parsed_date.astimezone(timezone.utc)
            return utc_date.strftime(API_DATE_FORMAT)
        except Exception as e:
            raise ValueError(f"Could not parse ISO 8601 date string: {date_str}") from e

    clean_date = date_str.split("(")[0].strip()

    try:
        parsed_date = email.utils.parsedate_to_datetime(clean_date)
        if parsed_date.tzinfo is None:
            parsed_date = parsed_date.replace(tzinfo=timezone.utc)
        utc_date = parsed_date.astimezone(timezone.utc)
        return utc_date.strftime(API_DATE_FORMAT)
    except Exception as e:
        raise ValueError(f"Could not parse date string: {date_str}") from e


def parse_email_date(date_str: str) -> datetime:
    """Fecha de un correo como datetime con zona UTC."""
    return datetime.strptime(normalize_date_to_utc(date_str), API_DATE_FORMAT)


def to_api_date(value: datetime) -> str:
    if value.tzinfo is None:
        raise ValueError("datetime sin zona")
    return value.astimezone(timezone.utc).strftime(API_DATE_FORMAT)


def parse_amount(amount_str: str) -> float:
    """Monto en formato inglés o español ('820,892.18', '820.892,18', '7.347'). Lógica original."""
    try:
        amount_str = amount_str.strip()
        clean_input = re.sub(r"[^\d.,]", "", amount_str)

        if not clean_input:
            return 0.0

        if "," not in clean_input and "." not in clean_input:
            return float(clean_input)

        if clean_input.count(".") == 1 and len(clean_input.split(".")[-1]) == 3 and "," not in clean_input:
            return float(clean_input.replace(".", ""))
        if clean_input.count(",") == 1 and len(clean_input.split(",")[-1]) == 3 and "." not in clean_input:
            return float(clean_input.replace(",", ""))

        last_comma_pos = clean_input.rfind(",")
        last_point_pos = clean_input.rfind(".")

        if last_comma_pos > last_point_pos:
            parts = clean_input.rsplit(",", 1)
            integer_part = parts[0].replace(".", "").replace(",", "")
            decimal_part = parts[1] if len(parts) > 1 else ""
        else:
            parts = clean_input.rsplit(".", 1)
            integer_part = parts[0].replace(".", "").replace(",", "")
            decimal_part = parts[1] if len(parts) > 1 else ""

        if decimal_part:
            return float(f"{integer_part}.{decimal_part}")
        return float(integer_part)

    except ValueError as ve:
        if "could not convert string to float:" in str(ve):
            return 0.0
        raise ve
    except Exception as e:
        raise ValueError(f"Could not convert value '{amount_str}' to float.") from e
