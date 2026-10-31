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
    payload de cada job (el mismo contrato que usaba la cola de AWS). Lógica original de general_utils."""
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
                        "currencies": {},
                        "classes": {},
                    }

                grouped_accounts[group_key]["accounts"][account["last_four_digits"]] = str(account["id"])
                grouped_accounts[group_key]["currencies"][str(account["id"])] = account.get("currency") or "COP"
                grouped_accounts[group_key]["classes"][str(account["id"])] = account.get("account_class") or "deposit"
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


# Marcas de moneda en el texto de un correo bancario. "$" solo no cuenta: lo usan COP, USD y otras.
_CURRENCY_PATTERNS = {
    "USD": re.compile(r"\bUSD\b|\bUS\s?\$|\bU\$S\b|\bd[oó]lar(?:es)?\b", re.IGNORECASE),
    "EUR": re.compile(r"\bEUR\b|€|\beuros?\b", re.IGNORECASE),
    "GBP": re.compile(r"\bGBP\b|£|\blibras? esterlinas?\b", re.IGNORECASE),
    "MXN": re.compile(r"\bMXN\b|\bpesos? mexicanos?\b", re.IGNORECASE),
    "BRL": re.compile(r"\bBRL\b|\bR\$|\breais\b|\breales\b", re.IGNORECASE),
    "CAD": re.compile(r"\bCAD\b|\bCA\$", re.IGNORECASE),
}


def detect_currencies(text: str) -> set[str]:
    """Monedas extranjeras que menciona el correo (ISO 4217). La de la cuenta sale de la base de
    datos; esto solo sirve para avisar cuando el correo habla de otra (p. ej. una compra en USD con
    una tarjeta en COP). No usa el LLM ni guarda el texto."""
    if not text:
        return set()
    return {code for code, pattern in _CURRENCY_PATTERNS.items() if pattern.search(text)}


def flag_currency_mismatch(transactions: List[Dict[str, Any]], currencies: Dict[str, str]) -> int:
    """Marca should_verify (queda en "Por revisar") si el correo de la transacción menciona una moneda
    distinta a la de su cuenta. Usa transaction["detected_currencies"] y account_id. Devuelve cuántas
    marcó. Sin `currencies` (jobs viejos) no hace nada."""
    if not currencies:
        return 0
    flagged = 0
    for transaction in transactions:
        detected = transaction.get("detected_currencies") or set()
        account_currency = currencies.get(str(transaction.get("account_id")), "COP")
        if detected - {account_currency}:
            if not transaction.get("should_verify"):
                flagged += 1
            transaction["should_verify"] = True
    return flagged


# Pago de la tarjeta ("pago de Tarjeta de Crédito", "abono a tu tarjeta"), no pago CON la tarjeta.
_CARD_PAYMENT = re.compile(
    r"\b(?:pagos?|abonos?)\s+(?:de|a|para)\s+(?:(?:tu|su|la)\s+)?(?:tarjeta|t\.?c\.?\b)"
    r"|\b(?:pagaste|abonaste)\s+(?:a\s+)?(?:tu|la)\s+tarjeta",
    re.IGNORECASE,
)
# Un correo de compra puede traer al pie "recuerda el pago de tu tarjeta": ese sigue siendo gasto.
_PURCHASE = re.compile(r"\b(?:compra|compraste|retiro|avance)\b", re.IGNORECASE)


def detect_card_payment(text: str) -> bool:
    """El correo avisa de un pago hecho a una tarjeta de crédito. No usa el LLM ni guarda el texto."""
    return bool(text) and bool(_CARD_PAYMENT.search(text)) and not _PURCHASE.search(text)


def flag_card_payments(
    transactions: List[Dict[str, Any]], accounts: Dict[str, str], classes: Dict[str, str]
) -> int:
    """El prompt lee "Pago" como gasto y no sabe qué tipo de cuenta son los últimos 4 dígitos. Si el
    correo avisa de un pago (transaction["mentions_card_payment"]) y sus dígitos son los de una tarjeta,
    para esa cuenta es una entrada: expense=False y card_payment=True. Devuelve cuántas marcó. Sin
    `classes` (jobs viejos) no hace nada."""
    flagged = 0
    for transaction in transactions:
        account_id = accounts.get(transaction.get("account_number"))
        if transaction.get("mentions_card_payment") and classes.get(account_id) == "credit":
            transaction["expense"] = False
            transaction["card_payment"] = True
            flagged += 1
    return flagged
