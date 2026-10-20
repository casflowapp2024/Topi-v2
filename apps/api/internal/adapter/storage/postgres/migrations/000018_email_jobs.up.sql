-- Cola de lectura de correos en Postgres (reemplaza SQS).
-- payload = JSON de domain.ReadEmailBodyRequest (el mismo que iba a SQS).
CREATE TABLE email_jobs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payload JSONB NOT NULL,
  priority SMALLINT NOT NULL DEFAULT 0,       -- 1 = HIGH (leer ahora)
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|running|done|failed
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_jobs_pick ON email_jobs (status, priority DESC, run_after);
