import pytest

from worker.config import ConfigError, Settings

BASE = {"DATABASE_URL": "postgresql://x", "API_BASE_URL": "http://api:8080/", "INTERNAL_API_KEY": "k"}


def test_defaults():
    s = Settings.from_env(BASE)
    assert s.api_base_url == "http://api:8080"
    assert s.gemini_model == "gemini-2.5-flash-lite"
    assert s.poll_seconds == 5 and s.concurrency == 2
    assert s.sync_overlap_minutes == 60
    assert s.processed_email_retention_days == 365
    assert s.extractor == "gemini"
    assert s.scheduler_enabled is True
    assert s.dry_run is False
    assert s.only_email_ids == frozenset()
    assert s.allows_email(123)


def test_required_variables():
    with pytest.raises(ConfigError, match="INTERNAL_API_KEY"):
        Settings.from_env({"DATABASE_URL": "x", "API_BASE_URL": "y"})


def test_openai_key_is_not_required():
    # hallazgo 6: OPENAI_API_KEY era obligatoria y no se usaba
    s = Settings.from_env({**BASE, "GEMINI_API_KEY": "g", "GMAIL_CLIENT_ID": "a", "GMAIL_CLIENT_SECRET": "b",
                           "OUTLOOK_CLIENT_ID": "c", "OUTLOOK_CLIENT_SECRET": "d"})
    s.require_for_processing()


def test_require_for_processing_lists_missing():
    with pytest.raises(ConfigError, match="GEMINI_API_KEY"):
        Settings.from_env(BASE).require_for_processing()


def test_dry_run_and_only_email_ids():
    s = Settings.from_env({**BASE, "WORKER_DRY_RUN": "true", "WORKER_ONLY_EMAIL_IDS": "26, 38"})
    assert s.dry_run is True
    assert s.only_email_ids == frozenset({26, 38})
    assert s.allows_email(26) and not s.allows_email(27)


def test_invalid_values():
    with pytest.raises(ConfigError):
        Settings.from_env({**BASE, "WORKER_ONLY_EMAIL_IDS": "26,abc"})
    with pytest.raises(ConfigError):
        Settings.from_env({**BASE, "WORKER_POLL_SECONDS": "cinco"})
    with pytest.raises(ConfigError, match="WORKER_EXTRACTOR"):
        Settings.from_env({**BASE, "WORKER_EXTRACTOR": "jev"}).require_for_processing()
