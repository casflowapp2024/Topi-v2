import os
import uuid

import pytest


@pytest.fixture(autouse=True)
def _logs_at_debug(caplog):
    """Construye todos los registros de log: un `extra` con una clave reservada de LogRecord
    (p. ej. 'created') falla aquí y no en producción."""
    import logging

    caplog.set_level(logging.DEBUG)


def pytest_addoption(parser):
    parser.addoption("--live", action="store_true", default=False, help="corre tests que llaman a Gemini real")


def pytest_collection_modifyitems(config, items):
    skip_live = pytest.mark.skip(reason="usa servicios reales: correr con --live")
    skip_db = pytest.mark.skip(reason="TEST_DATABASE_URL no está definido")
    for item in items:
        if "live" in item.keywords and not config.getoption("--live"):
            item.add_marker(skip_live)
        if "db" in item.keywords and not os.environ.get("TEST_DATABASE_URL"):
            item.add_marker(skip_db)


@pytest.fixture
def db():
    """Postgres local migrado por la API (versión >= 20). Cada test usa claves propias y limpia."""
    from worker.db import Database

    database = Database(os.environ["TEST_DATABASE_URL"], max_size=2)
    yield database
    database.close()


@pytest.fixture
def test_email_id():
    # ids altos para no chocar con conexiones reales del dump
    return 900_000_000 + uuid.uuid4().int % 1_000_000
