# Fase 3 — Worker de correos (ex-Saturn)

- Proceso Python long-running (`apps/worker`), Docker propio. Loop: toma jobs de `email_jobs` con
  `SELECT ... FOR UPDATE SKIP LOCKED` ordenando por `priority DESC, run_after`. Reintentos con backoff, máx. 3 → `failed`.
- Scheduler interno (APScheduler): cada hora en punto (hora Bogotá) encola un job por cada (email activo, remitente) — reemplaza `send_execution_sqs` + EventBridge.
  Cada 5 min: refresh concurrente de `last_month_balance, balance_by_date, daily_analysis, monthly_analysis, monthly_accounts_analysis`. Cada 2 días: `category_predictions`.
- `email_sync_state(email_id BIGINT, sender_email TEXT, last_run TIMESTAMPTZ, PRIMARY KEY(email_id, sender_email))` reemplaza DynamoDB.
  Seed: todos los pares activos con `last_run = '2026-10-17 09:00:00+00'`.
- `raw_emails(id, user_id, email_id, provider_message_id UNIQUE, sender, received_at, body, created_at)` reemplaza S3/Glue.
- `transactions.source_message_id VARCHAR(255) NULL` + índice único `(user_id, source_message_id)`.
- Primera corrida: dedupe contra existentes (`account_id, amount, expense, date ±2min`).
- Gemini Flash-Lite se mantiene (`prompt_v3`). Habla con la API vía `INTERNAL_API_KEY` (sin login admin) en la red interna.
- Refresh de tokens Google/Microsoft: si cambian, se persisten; errores → `/email/admin/error/:id` (igual que hoy).

## Autenticación del worker con la API (definido en la Fase 2)
- El worker **no** inicia sesión con un usuario admin (ya no existe Cognito ni `ADMIN_EMAIL/ADMIN_PASSWORD`).
  Llama a la API con el header **`X-API-Key: <INTERNAL_API_KEY>`** (misma variable en la API y en el worker).
- Con esa key la API trata la petición como `UserID = "service"` con rol admin, así que entra a las rutas
  `admin/*` que usa hoy: `GET /accounts/admin/list`, `GET /accounts/admin/list/by-bank`,
  `POST /transactions/admin/create`, `PUT /user-extra/admin/read-email`, `GET /email/:user_id/:id`,
  `PUT /email/admin/error/:id`.
- Una key inválida responde 401; si `INTERNAL_API_KEY` está vacía en la API, la key queda deshabilitada.
- Sin prefijo `/prod`: base URL de la API en la red interna de Coolify (p. ej. `http://api:8080`).
