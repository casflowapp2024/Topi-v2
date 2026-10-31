from datetime import datetime, timezone

import pytest

from worker.mapping import (
    dedupe_key, map_account_ids, normalize_date_to_utc, parse_amount, parse_email_date, to_api_date,
    transform_automations_msgs,
)


def test_transform_groups_by_user_email_and_sender():
    data = {"data": {"user_accounts": {
        "u1": [
            {"id": 1, "last_four_digits": "1111", "email_id": 7, "user_email": "u1@gmail.com",
             "user_provider": "gmail", "sender_email": "a@b.co,c@b.co"},
            {"id": 2, "last_four_digits": "2222", "email_id": 7, "user_email": "u1@gmail.com",
             "user_provider": "gmail", "sender_email": "a@b.co,c@b.co", "currency": "USD", "account_class": "deposit"},
            {"id": 3, "last_four_digits": "3333", "email_id": 7, "user_email": "u1@gmail.com",
             "user_provider": "gmail", "sender_email": "nu@nu.com.co"},
            {"id": 4, "last_four_digits": "4444"},  # incompleta: se ignora
        ],
    }}}

    jobs = transform_automations_msgs(data)

    assert jobs == [
        {"user_id": "u1", "user_mail": "u1@gmail.com", "email_id": 7, "user_provider": "gmail",
         "sender_email": "a@b.co,c@b.co", "accounts": {"1111": "1", "2222": "2"},
         "currencies": {"1": "COP", "2": "USD"}, "classes": {"1": "deposit", "2": "deposit"}},
        {"user_id": "u1", "user_mail": "u1@gmail.com", "email_id": 7, "user_provider": "gmail",
         "sender_email": "nu@nu.com.co", "accounts": {"3333": "3"}, "currencies": {"3": "COP"},
         "classes": {"3": "deposit"}},
    ]
    assert dedupe_key(jobs[0]) == "7:a@b.co,c@b.co"


def test_map_account_ids_keeps_should_verify_rule():
    transactions = [{"account_number": "2222"}, {"account_number": "9999"}, {"account_number": ""}]
    result = map_account_ids(transactions, {"1111": "1", "2222": "2"})
    assert result[0]["account_id"] == 2 and "should_verify" not in result[0]
    assert result[1]["account_id"] == 1 and result[1]["should_verify"] is True
    assert result[2]["account_id"] == 1 and result[2]["should_verify"] is True
    with pytest.raises(ValueError):
        map_account_ids([], {"1": "1"})


@pytest.mark.parametrize("raw, expected", [
    ("820,892.18", 820892.18), ("820.892,18", 820892.18), ("7.347", 7347.0), ("$ 10.000", 10000.0),
    ("50000", 50000.0), ("1,234", 1234.0), ("", 0.0),
])
def test_parse_amount(raw, expected):
    assert parse_amount(raw) == expected


def test_dates_are_utc_aware():
    # hallazgo 4: antes se usaba UTC-5 sin zona
    assert normalize_date_to_utc("Mon, 28 Apr 2025 11:40:09 -0500 (COT)") == "2025-04-28 16:40:09 +0000"
    assert normalize_date_to_utc("2025-06-15T06:38:21Z") == "2025-06-15 06:38:21 +0000"
    parsed = parse_email_date("Sat, 18 Oct 2026 10:15:00 -0500")
    assert parsed == datetime(2026, 10, 18, 15, 15, tzinfo=timezone.utc) and parsed.tzinfo is not None
    assert to_api_date(parsed) == "2026-10-18 15:15:00 +0000"
    with pytest.raises(ValueError):
        to_api_date(datetime(2026, 10, 18))


# ------------------------------------------------------------------ moneda del correo (D6)

import pytest  # noqa: E402

from worker.mapping import (  # noqa: E402
    detect_card_payment, detect_currencies, flag_card_payments, flag_currency_mismatch,
)


@pytest.mark.parametrize("text, expected", [
    ("Compra por USD 25,00 en AMAZON con tu tarjeta *1234", {"USD"}),
    ("Realizaste una compra por US$45.99", {"USD"}),
    ("Pago de 30 dólares aprobado", {"USD"}),
    ("Compra internacional por EUR 12,50", {"EUR"}),
    ("Cargo de 9,99 € en Spotify", {"EUR"}),
    ("Compra por $120.000 en EXITO", set()),               # "$" solo no dice la moneda
    ("Transferencia de $ 1.500.000 pesos", set()),
    ("Compra USD 10 y comisión EUR 1", {"USD", "EUR"}),
    ("", set()),
])
def test_detect_currencies(text, expected):
    assert detect_currencies(text) == expected


def test_flag_currency_mismatch_marks_only_other_currencies():
    txs = [
        {"account_id": 1, "detected_currencies": {"USD"}},           # USD en tarjeta COP: a revisión
        {"account_id": 2, "detected_currencies": {"USD"}},           # USD en cuenta USD: bien
        {"account_id": 1, "detected_currencies": set()},             # sin marca: bien
        {"account_id": 1, "detected_currencies": {"EUR"}, "should_verify": True},  # ya estaba marcada
    ]
    flagged = flag_currency_mismatch(txs, {"1": "COP", "2": "USD"})

    assert flagged == 1
    assert [t.get("should_verify", False) for t in txs] == [True, False, False, True]


def test_flag_currency_mismatch_without_currencies_does_nothing():
    txs = [{"account_id": 1, "detected_currencies": {"USD"}}]
    assert flag_currency_mismatch(txs, {}) == 0
    assert "should_verify" not in txs[0]


# ------------------------------------------------------------------ pagos de tarjeta

@pytest.mark.parametrize("text, expected", [
    ("Nuestro sistema detectó un pago de Tarjeta de Crédito No. XXXX0556 por un valor de $ 1,844,908.30", True),
    ("Recibimos el pago de tu tarjeta y lo estamos procesando", True),
    ("Abono a tu tarjeta terminada en 1234", True),
    ("Pagaste tu tarjeta de crédito", True),
    ("Pago a TC *1234 exitoso", True),
    ("Realizaste un pago con tu tarjeta *0556 en Spotify", False),      # pago CON la tarjeta: compra
    ("Realizaste un pago por $109,200.00 de 157 ENEL - CODENSA", False),
    ("Realizaste una compra de $25.000. Recuerda el pago de tu tarjeta", False),  # compra con pie
    ("", False),
])
def test_detect_card_payment(text, expected):
    assert detect_card_payment(text) is expected


def test_flag_card_payments_only_on_the_card_itself():
    accounts = {"0556": "1", "7194": "2"}
    classes = {"1": "credit", "2": "deposit"}
    txs = [
        {"account_number": "0556", "expense": True, "mentions_card_payment": True},   # el pago, en la tarjeta
        {"account_number": "7194", "expense": True, "mentions_card_payment": True},   # la salida, en el depósito
        {"account_number": "0556", "expense": True, "mentions_card_payment": False},  # compra con la tarjeta
        {"account_number": "9999", "expense": True, "mentions_card_payment": True},   # dígitos desconocidos
    ]

    assert flag_card_payments(txs, accounts, classes) == 1
    assert [t["expense"] for t in txs] == [False, True, True, True]
    assert [t.get("card_payment", False) for t in txs] == [True, False, False, False]


def test_flag_card_payments_without_classes_does_nothing():
    txs = [{"account_number": "0556", "expense": True, "mentions_card_payment": True}]
    assert flag_card_payments(txs, {"0556": "1"}, {}) == 0
    assert txs[0]["expense"] is True
