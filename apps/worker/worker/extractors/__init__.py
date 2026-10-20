"""Extractores de transacciones (intercambiables con WORKER_EXTRACTOR)."""

from __future__ import annotations

from worker.extractors.base import AccountRef, ExtractedTransaction, TransactionExtractor


def build_extractor(settings) -> TransactionExtractor:
    if settings.extractor == "gemini":
        from worker.extractors.gemini import GeminiExtractor

        return GeminiExtractor(api_key=settings.gemini_api_key, model=settings.gemini_model)
    raise ValueError(f"WORKER_EXTRACTOR desconocido: {settings.extractor}")


__all__ = ["AccountRef", "ExtractedTransaction", "TransactionExtractor", "build_extractor"]
