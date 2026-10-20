-- Auth propia (Fase 2): reemplaza Cognito. Sin servicio de correo.
-- users.id = sub de Cognito para los migrados (no se transforma ninguna tabla de negocio).
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,                 -- sub de Cognito (migrados) | uuid v4 (nuevos)
  email VARCHAR(255) NOT NULL,
  password_hash TEXT,                          -- NULL = debe crear contraseña
  name VARCHAR(255) NOT NULL DEFAULT '',
  last_name VARCHAR(255) NOT NULL DEFAULT '',
  role VARCHAR(20) NOT NULL DEFAULT 'user',    -- user | admin
  migrated BOOLEAN NOT NULL DEFAULT false,
  password_set_at TIMESTAMPTZ,
  token_version INT NOT NULL DEFAULT 0,        -- +1 al cambiar/resetear contraseña -> invalida sesiones
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower ON users (lower(email));

CREATE TABLE refresh_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user ON refresh_tokens (user_id);

CREATE TABLE auth_events (                      -- auditoría barata
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id VARCHAR(255),
  email VARCHAR(255),
  event VARCHAR(40) NOT NULL, -- signup|login_ok|login_fail|initial_password_set|initial_password_fail|password_changed|admin_reset|refresh_reuse
  ip VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_events_event_created ON auth_events (event, created_at DESC);

INSERT INTO users (id, email, name, last_name, migrated)
SELECT user_id, lower(trim(email)), name, last_name, true
FROM user_extra WHERE trim(email) <> ''
ON CONFLICT DO NOTHING;
