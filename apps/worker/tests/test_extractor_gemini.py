"""GeminiExtractor: mismo comportamiento que lib/gemini.py (modelo, prompt, limpieza, parse_amount)."""

from datetime import datetime, timezone
from unittest.mock import MagicMock

from worker.extractors.gemini import GeminiExtractor
from worker.extractors.prompt_v3 import prompt as PROMPT_V3
from worker.providers.base import EmailMessage

EMAIL = EmailMessage(id="m1", subject="Compra", sender="a@banco.test",
                     received_at=datetime(2026, 10, 18, 15, 15, tzinfo=timezone.utc), body="Compraste $1.234,50")


def extractor_returning(text: str) -> tuple[GeminiExtractor, MagicMock]:
    client = MagicMock()
    client.models.generate_content.return_value = MagicMock(text=text)
    return GeminiExtractor(api_key="k", client=client), client


def test_transaction_with_markdown_fence_and_spanish_amount():
    extractor, client = extractor_returning(
        '```json\n{"account_number": "1234", "description": "Compra Exito", "expense": true, "amount": "1.234,50"}\n```'
    )

    [tx] = extractor.extract(EMAIL, [])

    assert tx.is_transaction and tx.amount == 1234.5 and tx.expense is True
    assert tx.account_number == "1234" and tx.description == "Compra Exito"
    assert tx.date == EMAIL.received_at, "la fecha es la del correo"
    kwargs = client.models.generate_content.call_args.kwargs
    assert kwargs["model"] == "gemini-2.5-flash-lite"
    assert kwargs["contents"] == EMAIL.body
    assert kwargs["config"].system_instruction == PROMPT_V3
    assert extractor.name == "gemini-2.5-flash-lite"


def test_not_a_transaction():
    extractor, _ = extractor_returning('{"transaction_detected": false, "reason": "Correo de puntos"}')
    [result] = extractor.extract(EMAIL, [])
    assert result.is_transaction is False and result.reason == "Correo de puntos"


def test_zero_or_null_amount_is_not_a_transaction():
    for amount in ("0", "null"):
        extractor, _ = extractor_returning(f'{{"account_number": "", "description": "", "expense": true, "amount": {amount}}}')
        assert extractor.extract(EMAIL, [])[0].is_transaction is False


def test_prompt_v3_is_unchanged():
    assert PROMPT_V3.strip().startswith("ROL: Eres un experto en contabilidad automatizada")
    assert '"transaction_detected": false' in PROMPT_V3
