-- Conexión caída (plan/27 §D): cuándo se cayó cada conexión y cuánto tardó en volver.

-- Desde cuándo está caída la conexión (NULL = sana). Lo pone SaveEmailError; reconectar lo limpia.
ALTER TABLE emails ADD COLUMN error_at TIMESTAMPTZ;
UPDATE emails SET error_at = updated_at WHERE coalesce(error, '') <> '';

-- Historial de caídas: una fila por caída, cerrada al reconectar o al borrar la conexión.
-- Sin direcciones ni contenido: solo ids, proveedor, código de error y fechas.
CREATE TABLE connection_incidents (
  id BIGSERIAL PRIMARY KEY,
  email_id BIGINT REFERENCES emails (id) ON DELETE SET NULL,
  user_id VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  error_code VARCHAR(50) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution VARCHAR(20) CHECK (resolution IN ('reconnected', 'deleted')),
  CHECK ((resolved_at IS NULL) = (resolution IS NULL))
);
-- a lo sumo una caída abierta por conexión
CREATE UNIQUE INDEX connection_incidents_open ON connection_incidents (email_id) WHERE resolved_at IS NULL;
CREATE INDEX connection_incidents_started ON connection_incidents (started_at);

-- las conexiones caídas de hoy abren su caída (fecha aproximada: la última actualización)
INSERT INTO connection_incidents (email_id, user_id, provider, error_code, started_at)
SELECT id, user_id, provider, error, error_at FROM emails WHERE coalesce(error, '') <> '';

ALTER TABLE product_events DROP CONSTRAINT product_events_name_check;
ALTER TABLE product_events ADD CONSTRAINT product_events_name_check CHECK (name IN (
  'tx_category_corrected', 'tx_amount_corrected', 'review_resolved', 'budget_created',
  'insight_dismissed', 'insight_feedback', 'ask_topi_asked',
  'support_started', 'support_approved',
  'connection_reconnected'
));
