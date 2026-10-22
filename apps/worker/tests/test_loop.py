"""JobLoop sin Postgres: el heartbeat se escribe al arrancar y luego como mucho cada HEARTBEAT_SECONDS."""

from worker import loop as loop_module
from worker.config import Settings
from worker.loop import JobLoop


class HeartbeatDB:
    def __init__(self):
        self.beats = []

    def heartbeat(self, worker_id, version):
        self.beats.append(worker_id)


def test_heartbeat_throttled(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(loop_module.time, "monotonic", lambda: clock[0])
    db = HeartbeatDB()
    job_loop = JobLoop(Settings(database_url="", api_base_url="", internal_api_key="", worker_id="w-1"), db, processor=None)

    job_loop._heartbeat()
    clock[0] += 5
    job_loop._heartbeat()
    assert db.beats == ["w-1"]

    clock[0] += loop_module.HEARTBEAT_SECONDS
    job_loop._heartbeat()
    assert db.beats == ["w-1", "w-1"]
