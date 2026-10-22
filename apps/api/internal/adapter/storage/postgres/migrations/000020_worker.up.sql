-- Worker de correos (Fase 3): cola sin duplicados, estado de sincronización e idempotencia.

-- Cola: evitar duplicados y recuperar jobs huérfanos
ALTER TABLE email_jobs ADD COLUMN dedupe_key TEXT;            -- '<email_id>:<sender_email>'
ALTER TABLE email_jobs ADD COLUMN locked_at TIMESTAMPTZ;
ALTER TABLE email_jobs ADD COLUMN locked_by TEXT;
CREATE UNIQUE INDEX email_jobs_active_dedupe ON email_jobs (dedupe_key)
  WHERE status IN ('pending','running') AND dedupe_key IS NOT NULL;

-- Reemplaza DynamoDB saturn-last-run
CREATE TABLE email_sync_state (
  email_id BIGINT NOT NULL,
  sender_email TEXT NOT NULL,                  -- un remitente individual (la API divide banks.email por coma)
  last_run TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (email_id, sender_email)
);

-- Idempotencia por mensaje. NO se guarda el contenido de los correos (decisión 19-oct): solo metadatos.
CREATE TABLE processed_emails (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  email_id BIGINT NOT NULL,
  provider VARCHAR(20) NOT NULL,
  provider_message_id VARCHAR(512) NOT NULL,
  sender TEXT, received_at TIMESTAMPTZ,
  extractor VARCHAR(30) NOT NULL,                -- 'gemini-2.5-flash-lite' | futuro 'jev+regex'
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|transaction|no_transaction|error
  transaction_ids BIGINT[],
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email_id, provider_message_id)
);

ALTER TABLE transactions ADD COLUMN source_message_id VARCHAR(512);
CREATE UNIQUE INDEX transactions_source_message
  ON transactions (user_id, source_message_id) WHERE source_message_id IS NOT NULL;

-- Semilla: reanudar desde la última corrida conocida (no-op en DB vacía).
-- Por remitente individual: AdminGetAccountsList divide banks.email por coma (SplitByBankEmails),
-- así que cada job lleva un solo sender_email (igual que el DynamoDB de AWS).
INSERT INTO email_sync_state (email_id, sender_email, last_run)
SELECT DISTINCT e.id, trim(sender), TIMESTAMPTZ '2026-10-17 09:00:00+00'
FROM emails e
JOIN accounts a ON a.email_id = e.id AND a.user_id = e.user_id
JOIN banks b ON b.id = a.bank_id AND b.user_id = a.user_id
CROSS JOIN LATERAL regexp_split_to_table(b.email, ',') AS sender
WHERE e.active AND e.error IS NULL AND coalesce(b.email,'') <> '' AND trim(sender) <> ''
ON CONFLICT DO NOTHING;
