"""GeminiExtractor: la lógica de lib/gemini.py + prompt_v3 sin cambios de comportamiento.

- mismo modelo (GEMINI_MODEL, default gemini-2.5-flash-lite) y mismo system prompt;
- misma limpieza de la respuesta (quita ```json) y mismo parse_amount;
- la fecha de la transacción es la fecha del correo;
- se considera transacción si no viene `transaction_detected` y el monto existe y no es 0.
"""

from __future__ import annotations

import json
from typing import Any

from worker import log
from worker.errors import PermanentJobError
from worker.extractors.base import AccountRef, ExtractedTransaction
from worker.extractors.prompt_v3 import prompt as PROMPT_V3
from worker.mapping import parse_amount
from worker.providers.base import EmailMessage

logger = log.get(__name__)


class GeminiExtractor:
    def __init__(self, api_key: str, model: str = "gemini-2.5-flash-lite", prompt: str = PROMPT_V3, client: Any = None):
        self.model = model
        self.prompt = prompt
        self.name = model
        self.api_key = api_key
        self._client = client

    @property
    def client(self) -> Any:
        if self._client is None:
            if not self.api_key:
                raise PermanentJobError("GEMINI_API_KEY no está configurada")
            from google import genai

            self._client = genai.Client(api_key=self.api_key)
        return self._client

    def generate_response(self, email_data: str) -> Any:
        from google.genai import types

        return self.client.models.generate_content(
            model=self.model,
            config=types.GenerateContentConfig(system_instruction=self.prompt),
            contents=email_data,
        )

    @staticmethod
    def parse_response(response: Any) -> dict[str, Any]:
        response_text = response.text.replace("```json\n", "").replace("\n```", "")
        return json.loads(response_text)

    @staticmethod
    def process_data(transaction_data: dict[str, Any]) -> dict[str, Any]:
        if "transaction_detected" not in transaction_data:
            if "amount" in transaction_data:
                transaction_data["amount"] = parse_amount(str(transaction_data["amount"]))
        return transaction_data

    def extract(self, email: EmailMessage, accounts: list[AccountRef]) -> list[ExtractedTransaction]:
        data = self.process_data(self.parse_response(self.generate_response(email.body)))

        amount = data.get("amount")
        if "transaction_detected" in data or amount is None or amount == 0:
            return [ExtractedTransaction(is_transaction=False, date=email.received_at, reason=str(data.get("reason", "")))]

        return [ExtractedTransaction(
            is_transaction=True,
            account_number=str(data.get("account_number") or ""),
            amount=float(amount),
            expense=bool(data.get("expense")),
            date=email.received_at,
            description=str(data.get("description") or ""),
            confidence=None,
        )]
