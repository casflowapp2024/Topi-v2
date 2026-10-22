# Fase 3: worker de correos (ex-Saturn) sin AWS

## Punto de partida (lo que ya existe tras las Fases 1 y 2)
- La API encola en `email_jobs` (migración 000018) con `payload` = `domain.ReadEmailBodyRequest`:
  `{user_id, user_mail, email_id, user_provider, sender_email, accounts:{last4: account_id}, onboarding}`. Prioridad 1 = "leer ahora" desde el front.
- La API acepta `X-API-Key: <INTERNAL_API_KEY>` como usuario `service` con rol admin para las rutas `admin/*`.
- `apps/worker` es el código Lambda copiado sin cambios: `send_execution_sqs` (programador), `extract_emails_new` (lector + Gemini),
  `save_emails_data` (S3/Glue), `lib/` (Gmail, Outlook, Gemini, cliente de la API, utilidades).
- Datos: 10 conexiones de correo activas; la última transacción automática se creó el **2026-10-17 09:00 UTC**; el dump es del **2026-10-17 13:17 UTC**.

## Hallazgos en el código actual (corregir en esta fase)
1. **Gmail mete Bancolombia fijo en todas las búsquedas**: `from:('{sender} OR alertasynotificaciones@bancolombia.com.co')`.
   Así, los correos de Bancolombia entran al leer cualquier otro banco y pueden terminar asignados a la cuenta equivocada
   (`map_account_ids` usa la primera cuenta si no coinciden los 4 dígitos). **Quitarlo.**
2. **`banks.email` guarda varios remitentes separados por coma** (p. ej. Bancolombia tiene 3) y nadie los separa.
   Gmail: construir `from:(a OR b OR c)`. Outlook: `(from/emailAddress/address eq 'a' or ... eq 'c')`. Con tests.
3. **Gmail no pagina** (`messages.list` sin `pageToken`, máx. 100). Outlook tampoco sigue `@odata.nextLink`. La primera corrida va a recuperar
   varios días → paginar en ambos.
4. **Las fechas se manejan en UTC-5 sin zona**. Todo pasa a `datetime` con zona UTC.
5. **Cualquier excepción marca la conexión con error** (`send_user_error`), y `AdminGetAccountsList` excluye las conexiones con error →
   un 503 de Gemini o un corte de red **apaga la lectura de ese correo hasta que el usuario lo reconecte**. Solo marcar error en fallos de
   credenciales (`token_expired_or_revoked`, `oauth_client_deleted`, `authorization_error`, etc.); los transitorios se reintentan.
6. `OPENAI_API_KEY` es obligatoria pero no se usa → quitarla.
7. `/accounts/admin/list` tiene `limit` máx. 100 → paginar con `skip`.

## Diseño
Un solo contenedor Python 3.12 (`apps/worker`), proceso de larga duración:
```
python -m worker
 ├─ scheduler (APScheduler, America/Bogota)
 │   ├─ cada hora en punto → encolar lecturas (reemplaza EventBridge + send_execution_sqs)
 │   ├─ cada 5 min         → REFRESH MATERIALIZED VIEW CONCURRENTLY (reemplaza pg_cron)
 │   ├─ cada 2 días 00:00  → REFRESH category_predictions
 │   └─ diario 03:00       → limpieza (jobs done/failed > 30 días, processed_emails > PROCESSED_EMAIL_RETENTION_DAYS)
 └─ job loop (cada WORKER_POLL_SECONDS=5): toma jobs de email_jobs y los procesa (reemplaza SQS + extract_emails_new)
```
- **Postgres directo** (psycopg 3) solo para lo que es del worker: `email_jobs`, `email_sync_state`, `processed_emails` y el refresh de vistas.
- **API** (`API_BASE_URL`, `X-API-Key`) para la lógica de negocio que ya existe: listar cuentas, obtener tokens, crear transacciones
  (la categorización automática vive en Go), reportar errores y confirmar la lectura de onboarding.
- Las migraciones siguen viviendo **solo en la API** (golang-migrate). El worker no migra.
- Sin boto3, DynamoDB, S3, Glue ni SQS. `save_emails_data/` y `send_execution_sqs/` se eliminan (su lógica útil pasa al worker).

## Migración 000020_worker
```sql
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

-- Semilla: reanudar desde la última corrida conocida (no-op en DB vacía)
INSERT INTO email_sync_state (email_id, sender_email, last_run)
SELECT DISTINCT e.id, trim(sender), TIMESTAMPTZ '2026-10-17 09:00:00+00'
FROM emails e
JOIN accounts a ON a.email_id = e.id AND a.user_id = e.user_id
JOIN banks b ON b.id = a.bank_id AND b.user_id = a.user_id
CROSS JOIN LATERAL regexp_split_to_table(b.email, ',') AS sender   -- por remitente (decisión 21-oct)
WHERE e.active AND e.error IS NULL AND coalesce(b.email,'') <> '' AND trim(sender) <> ''
ON CONFLICT DO NOTHING;
```

## Cambios en la API (Go)
- `POST /transactions/admin/create`: acepta `source_message_id` opcional por transacción.
  - Inserta con `ON CONFLICT (user_id, source_message_id) DO NOTHING`: reprocesar un correo nunca duplica.
  - **Dedupe del empalme**: si existe una transacción **legada** (`source_message_id IS NULL`, `automated = true`) con la misma
    `account_id`, `amount`, `expense` y `date` ±2 min → no se inserta. Esto cubre el solape con lo que AWS ya había guardado.
  - La respuesta indica cuáles se crearon y cuáles se omitieron (y por qué).
- `GET /accounts/admin/list`: confirmar que pagina con `skip/limit` y devuelve `user_accounts` agrupado (lo usa el worker).
- Nada más de negocio cambia.

## Flujo de un job
1. Tomar job: `UPDATE ... SET status='running', locked_at=now(), locked_by=:worker, attempts=attempts+1
   WHERE id = (SELECT id FROM email_jobs WHERE status='pending' AND run_after<=now() ORDER BY priority DESC, run_after, id
   FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`. Jobs `running` con `locked_at` de más de 15 min → vuelven a `pending`.
2. `last_run` desde `email_sync_state`; si no hay fila → primer día del mes actual (comportamiento original).
   Buscar desde `last_run - SYNC_OVERLAP_MINUTES` (default 60): el solape es gratis gracias a la idempotencia.
3. Obtener tokens (`GET /email/:user_id/:id`), listar mensajes paginando y separando remitentes.
4. Por cada mensaje: si `(email_id, provider_message_id)` ya está en `processed_emails` → omitir **sin llamar a Gemini**. Si no, registrarlo en `processed_emails` (sin cuerpo) y pasarlo al extractor. El cuerpo vive solo en memoria durante el job.
5. `map_account_ids` (se mantiene la regla de `should_verify`), con `source_message_id` en cada transacción → `POST /transactions/admin/create`.
6. Actualizar `processed_emails.status/transaction_ids` y `email_sync_state.last_run` = hora de inicio del listado. **Solo si todo salió bien.**
7. `onboarding = true` → `PUT /user-extra/admin/read-email` (como hoy).
8. Errores: credenciales → `PUT /email/admin/error/:id` con el código mapeado (mismos códigos que entiende el front) y job `failed`;
   transitorios → `pending` con `run_after = now() + backoff` (1, 5, 15 min); al tercer intento → `failed` sin marcar la conexión.

## Extractor intercambiable (preparar migración futura a Jev)
- Interfaz `TransactionExtractor.extract(email: EmailMessage, accounts: list[AccountRef]) -> list[ExtractedTransaction]`, donde
  `ExtractedTransaction = {is_transaction, account_number, amount, expense, date, description, confidence|None}`.
- Única implementación en esta fase: `GeminiExtractor` (la lógica actual de `lib/gemini.py` + `prompt_v3`, sin cambios de comportamiento).
- Se elige con `WORKER_EXTRACTOR` (default `gemini`). Si `confidence` viene y es menor que un umbral → `should_verify = true`.
- Tests de contrato del extractor con fixtures **anonimizados** (montos, nombres y últimos 4 dígitos cambiados) de los 9 bancos: servirán
  para evaluar Jev u otro extractor en el futuro con el mismo set.
- Fuera de alcance: integrar Jev. Ver `plan/04-evaluacion-jev.md`.

## Encolado horario
- Paginar `GET /accounts/admin/list`, agrupar con `transform_automations_msgs` (por `email_id` + `sender_email`) e insertar en `email_jobs`
  con `priority=0`, `dedupe_key='<email_id>:<sender_email>'` y `ON CONFLICT DO NOTHING` (si ya hay uno pendiente o corriendo, no se duplica).
- Los jobs que encola la API ("leer ahora") también deben llevar `dedupe_key`: ajustar el adaptador `jobqueue` de Go.

## Refresh de vistas
`pg_try_advisory_lock` por vista para no solaparse. Cada 5 min: `last_month_balance, balance_by_date, daily_analysis, monthly_analysis,
monthly_accounts_analysis`. Cada 2 días: `category_predictions`. Verificar que cada vista tenga el índice único que exige `CONCURRENTLY`
(si no, refresh normal y registrarlo en el log).

## Configuración (`apps/worker/.env.example`)
`DATABASE_URL, API_BASE_URL, INTERNAL_API_KEY, GEMINI_API_KEY, GEMINI_MODEL=gemini-2.5-flash-lite, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET,
GMAIL_TOKEN_URI, OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_TOKEN_URI, WORKER_POLL_SECONDS=5, WORKER_CONCURRENCY=2,
SYNC_OVERLAP_MINUTES=60, PROCESSED_EMAIL_RETENTION_DAYS=365, WORKER_EXTRACTOR=gemini, SCHEDULER_ENABLED=true, WORKER_DRY_RUN=false, WORKER_ONLY_EMAIL_IDS=`
- `WORKER_DRY_RUN=true`: lee y parsea, pero no crea transacciones ni mueve `last_run`. Registra lo que haría.
- `WORKER_ONLY_EMAIL_IDS=26,38`: restringe a esas conexiones (para probar con correos propios del equipo, no con los de usuarios).

## Infra
- `apps/worker/Dockerfile` (python:3.12-slim, usuario no root) y servicio `worker` en `infra/docker-compose.yml` (depende de postgres y api).
- Logs estructurados en JSON a stdout (Coolify los muestra). Sin CloudWatch.

## Notas operativas
- La API key de Gemini debe ser de un proyecto **con facturación activa**: en el plan gratis, Google puede usar el contenido
  (correos bancarios) para mejorar sus productos. Con este volumen cuesta centavos al mes.
- Los refresh tokens de Gmail/Outlook en `emails` siguen válidos mientras se use el **mismo client_id**. Rotar el client secret no los invalida.
- Para probar en local la reconexión de correos hay que agregar `http://localhost:3000/gmail-auth-connect` como redirect URI en Google Cloud y Azure.

## Criterios de aceptación
- [ ] `pytest` en `apps/worker` con tests de: separación de remitentes (Gmail y Outlook), paginación, `last_run` y solape, omitir mensajes ya vistos sin llamar a Gemini,
      clasificación de errores (credencial vs transitorio), reintentos/backoff, dedupe de encolado, recuperación de jobs huérfanos. Gmail, Outlook, Gemini y la API mockeados.
- [ ] `go test ./...` OK, con tests nuevos para `source_message_id` (idempotencia) y el dedupe del empalme legado.
- [ ] Restore + migrate: versión 20; `email_sync_state` sembrada para las conexiones activas con cuentas, todas con `2026-10-17 09:00 UTC`.
- [ ] `grep -rniE "boto3|dynamodb|sqs|s3|glue|openai" apps/worker` vacío.
- [ ] `docker compose up` levanta postgres + api + worker; el scheduler encola la corrida horaria (se puede forzar con un comando `python -m worker enqueue-now`).
- [ ] "Leer ahora" desde la API → el job se procesa en menos de 10 s.
- [ ] Prueba real **solo con una conexión propia del equipo** (`WORKER_ONLY_EMAIL_IDS`): primero `WORKER_DRY_RUN=true` (muestra transacciones detectadas desde el 17-oct),
      después real: crea las transacciones; una segunda corrida inmediata no crea nada nuevo ni llama a Gemini para los mismos mensajes.
- [ ] Las 6 vistas materializadas se refrescan sin error y sin solaparse.
- [ ] Un error simulado de Gemini (503) no marca la conexión con error; un token revocado sí la marca con `token_expired_or_revoked`.
