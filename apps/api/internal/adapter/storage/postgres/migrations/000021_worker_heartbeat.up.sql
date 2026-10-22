-- Heartbeat del worker (Fase 5): una fila por proceso, actualizada en el job loop.
-- GET /health de la API lo lee para el monitoreo (worker "stale" si no late hace más de 10 min).
CREATE TABLE worker_heartbeat (
  worker_id  TEXT PRIMARY KEY,
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
  version    TEXT
);
