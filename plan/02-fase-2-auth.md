# Fase 2 — Auth propia (solo email + contraseña)

## Modelo
```sql
-- 000019_users
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,            -- = sub de Cognito para los existentes; uuid v4 para nuevos
  email VARCHAR(255) NOT NULL UNIQUE,     -- siempre lower()
  password_hash TEXT,                     -- NULL = debe crear contraseña
  name VARCHAR(255) NOT NULL DEFAULT '',
  last_name VARCHAR(255) NOT NULL DEFAULT '',
  verified BOOLEAN NOT NULL DEFAULT false,
  role VARCHAR(20) NOT NULL DEFAULT 'user', -- 'admin' | 'service'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE auth_codes (               -- verificación y reset
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose VARCHAR(20) NOT NULL,          -- 'verify' | 'reset'
  code_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0, used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE refresh_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- seed de migración
INSERT INTO users (id, email, name, last_name, verified)
SELECT user_id, lower(email), name, last_name, true FROM user_extra WHERE email <> '';
```

## Reglas
- Hash: argon2id (o bcrypt cost 12). Códigos de 6 dígitos guardados hasheados, TTL 15 min, máx. 5 intentos.
- JWT propio (HS256 con `JWT_SECRET`, o EdDSA). Access 1 h; refresh 30 días rotativo. Claims: `sub`, `email`, `role`, `token_use=access`.
- Implementar adaptadores nuevos para `port.UserRepository` y `port.TokenRepository`; borrar `adapter/auth/cognito`, `adapter/auth/social`, `port/social_auth.go`, mocks relacionados y `aws-sdk-go`.
- Mismos endpoints que hoy (`/users/signup|confirm|login|resend-confirmation|forgot-password|forgot-password/confirm`, `GET/PUT /users/`). Se eliminan `/users/social-auth-url*`. `/users/login` ya no acepta `code`.
- Login con `password_hash IS NULL` → 409 `PASSWORD_NOT_SET` + envío automático de código `reset`.
- Rate limit simple por IP+email en login/forgot.
- Worker y n8n: usuario `role='service'` o header `X-API-Key` (`INTERNAL_API_KEY`) para rutas `admin/*`.
- Email: puerto `Mailer` con adaptador Resend (HTTP) + adaptador `log` para desarrollo.
