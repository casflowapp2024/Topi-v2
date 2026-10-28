"""Encolado horario, tareas programadas y refresh de vistas (sin solaparse)."""

import os

import pytest

from worker.config import Settings
from worker.scheduler import build_scheduler, enqueue_hourly

BASE = {"DATABASE_URL": "x", "API_BASE_URL": "http://api", "INTERNAL_API_KEY": "k"}


class FakeApi:
    def list_accounts(self):
        return {"data": {"user_accounts": {
            "u1": [
                {"id": 1, "last_four_digits": "1111", "email_id": 7, "user_email": "u1@gmail.com",
                 "user_provider": "gmail", "sender_email": "a@b.co,c@b.co"},
                {"id": 2, "last_four_digits": "2222", "email_id": 7, "user_email": "u1@gmail.com",
                 "user_provider": "gmail", "sender_email": "nu@nu.com.co"},
            ],
            "u2": [
                {"id": 3, "last_four_digits": "3333", "email_id": 9, "user_email": "u2@outlook.com",
                 "user_provider": "outlook", "sender_email": "x@y.co"},
            ],
        }}}


class FakeDB:
    def __init__(self):
        self.active: set[str] = set()
        self.payloads = []

    def enqueue_jobs(self, jobs, priority=0):
        inserted = 0
        for payload, key in jobs:
            assert priority == 0
            if key in self.active:
                continue
            self.active.add(key)
            self.payloads.append(payload)
            inserted += 1
        return inserted


def test_enqueue_hourly_one_job_per_connection_and_sender_without_duplicates():
    db = FakeDB()
    settings = Settings.from_env(BASE)

    first = enqueue_hourly(settings, FakeApi(), db)
    second = enqueue_hourly(settings, FakeApi(), db)

    assert first == {"groups": 3, "allowed": 3, "enqueued": 3, "already_queued": 0}
    assert second == {"groups": 3, "allowed": 3, "enqueued": 0, "already_queued": 3}
    assert db.active == {"7:a@b.co,c@b.co", "7:nu@nu.com.co", "9:x@y.co"}
    assert all(p["onboarding"] is False for p in db.payloads)


def test_enqueue_hourly_respects_only_email_ids():
    db = FakeDB()
    settings = Settings.from_env({**BASE, "WORKER_ONLY_EMAIL_IDS": "9"})

    summary = enqueue_hourly(settings, FakeApi(), db)

    assert summary["allowed"] == 1 and db.active == {"9:x@y.co"}


def test_scheduler_jobs_and_triggers():
    scheduler = build_scheduler(Settings.from_env(BASE), FakeApi(), FakeDB())
    jobs = {job.id: str(job.trigger) for job in scheduler.get_jobs()}

    assert jobs["enqueue_hourly"] == "cron[minute='0']"
    assert "refresh_views" not in jobs, "los reportes son en vivo desde la migración 000024"
    assert jobs["reconcile_totals"] == "cron[hour='3', minute='30']"
    assert jobs["refresh_predictions"] == "cron[day='*/2', hour='0', minute='0']"
    assert jobs["cleanup"] == "cron[hour='3', minute='0']"
    assert jobs["fx_sync"] == "cron[hour='19', minute='0']"
    assert str(scheduler.timezone) == "America/Bogota"


def test_fx_sync_can_be_disabled():
    scheduler = build_scheduler(Settings.from_env({**BASE, "FX_SYNC_ENABLED": "false"}), FakeApi(), FakeDB())
    assert "fx_sync" not in {job.id for job in scheduler.get_jobs()}


@pytest.mark.db
def test_views_refresh_and_do_not_overlap(db):
    from worker.views import ALL_VIEWS, LOCK_PREFIX, refresh_view, refresh_views

    assert ALL_VIEWS == ("category_predictions",)
    results = refresh_views(db, ALL_VIEWS)
    assert results == {view: "concurrently" for view in ALL_VIEWS}

    # otro proceso tiene el lock de la vista: esta vuelta se omite en vez de solaparse
    with db.pool.connection() as other:
        other.execute("SELECT pg_advisory_lock(hashtext(%s))", (LOCK_PREFIX + "category_predictions",))
        try:
            assert refresh_view(db, "category_predictions") == "skipped"
        finally:
            other.execute("SELECT pg_advisory_unlock(hashtext(%s))", (LOCK_PREFIX + "category_predictions",))
    assert refresh_view(db, "category_predictions") == "concurrently"


def test_sync_fx_fills_pending_transactions(monkeypatch):
    from worker import fx, scheduler

    class Db:
        def fill_pending_fx(self):
            return 3

    monkeypatch.setattr(fx, "sync_recent", lambda db, http, today, lookback: {"SFC_TRM": {"fetched": 1, "changed": 0}})
    summary = scheduler.sync_fx(Settings.from_env(BASE), Db())
    assert summary == {"SFC_TRM": {"fetched": 1, "changed": 0}, "pending_fx_filled": 3}
    assert not fx.has_errors(summary)


def test_reconcile_totals_logs_and_returns_rebuilt_users():
    from worker import scheduler

    class Db:
        def __init__(self, users):
            self.users = users

        def reconcile_daily_totals(self):
            return self.users

    assert scheduler.reconcile_totals(Db([])) == []
    assert scheduler.reconcile_totals(Db(["u1"])) == ["u1"]


@pytest.mark.db
def test_reconcile_and_fill_pending_against_db(db):
    assert db.reconcile_daily_totals() == []
    assert db.fill_pending_fx() >= 0


def test_refresh_rejects_unknown_views():
    from worker.views import refresh_view

    with pytest.raises(ValueError):
        refresh_view(object(), "users; DROP TABLE users")
