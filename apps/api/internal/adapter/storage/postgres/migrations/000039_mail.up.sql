-- Correo transaccional (plan/23-correo-transaccional.md). Todo envío pasa por email_outbox.

-- Cola de salida. El payload nunca lleva datos sensibles (ni códigos, ni montos de correos bancarios):
-- los correos con un secreto (códigos) se envían en el momento con has_secret=true y no se reintentan.
CREATE TABLE email_outbox (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  to_email VARCHAR(255) NOT NULL,
  template VARCHAR(40) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority SMALLINT NOT NULL DEFAULT 5,          -- 1 = transaccional (va primero y tiene cupo reservado)
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'suppressed')),
  has_secret BOOLEAN NOT NULL DEFAULT false,
  attempts INT NOT NULL DEFAULT 0,
  send_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  dedupe_key VARCHAR(120),                       -- p. ej. monthly_summary:<user>:2026-11
  provider_id VARCHAR(100),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX email_outbox_ready ON email_outbox (priority, send_after) WHERE status = 'pending';
CREATE INDEX email_outbox_sending ON email_outbox (locked_at) WHERE status = 'sending';
CREATE INDEX email_outbox_sent_at ON email_outbox (sent_at) WHERE status = 'sent';
CREATE INDEX email_outbox_user_template ON email_outbox (user_id, template, created_at DESC);
CREATE UNIQUE INDEX email_outbox_dedupe ON email_outbox (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE UNIQUE INDEX email_outbox_provider_id ON email_outbox (provider_id) WHERE provider_id IS NOT NULL;

-- Códigos de un solo uso (recuperar contraseña, verificar correo). Solo se guarda el hash.
CREATE TABLE auth_codes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('password_reset', 'verify_email')),
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_codes_user_purpose ON auth_codes (user_id, purpose, created_at DESC);

-- Estado del correo del usuario: un rebote duro o una queja suprime los envíos.
ALTER TABLE users
  ADD COLUMN email_status VARCHAR(20) NOT NULL DEFAULT 'ok'
    CHECK (email_status IN ('ok', 'bounced', 'complained')),
  ADD COLUMN email_verified_at TIMESTAMPTZ;
-- Los usuarios existentes (migrados o no) quedan verificados: la verificación es solo para los nuevos.
UPDATE users SET email_verified_at = now();

-- Preferencias de correo. Sin fila = valores por defecto (resumen mensual desactivado).
CREATE TABLE notification_prefs (
  user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_monthly_summary BOOLEAN NOT NULL DEFAULT false,
  email_connection_alerts BOOLEAN NOT NULL DEFAULT true,
  email_product_news BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Aviso de conexión caída: máximo uno cada 7 días por conexión.
ALTER TABLE emails ADD COLUMN alert_sent_at TIMESTAMPTZ;
