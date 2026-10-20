# Fase 1 — Monorepo, entorno local y API sin AWS

## Alcance
1. Crear `topiv2/topi/` (git init nuevo) con `apps/api`, `apps/worker`, `apps/web`, `infra/`, `plan/` (copia de esta carpeta).
2. Copiar código **sin** `.git`, `node_modules`, `build`, `cdk.out`, `.venv`, `bin/` (binarios de saturn), `cashflow.zip`, `bootstrap`, `.DS_Store`.
   - `apps/api` ← `cashflow-backend/cashflow/`
   - `apps/worker` ← `cashflow-saturn/lambda_code/` (+ `local/` como referencia). En F1 solo se copia; se refactoriza en F3.
   - `apps/web` ← `cash-flow-front/` (sin `.agents`, `node_modules`, `build`). `n8n/` → `infra/n8n/`.
3. **Purgar secretos**: ningún `.env` real commiteado. Crear `.env.example` por app con placeholders. `.gitignore` raíz.
   Revisar con `grep -rniE "secret|password|api_key|client_secret"` antes del primer commit.
4. **API sin AWS (excepto Cognito, que se va en F2)**:
   - Borrar `cmd/lambda/`, `internal/adapter/handler/lambda/`, `internal/adapter/api/lambda.go` (si solo sirve a lambda), `Dockerfile.lambda`.
   - `config.go`: quitar Secrets Manager (`SetSecrets/GetSecrets/...`); leer solo env vars / `.env`. `godotenv` carga `.env` si existe (no `.env.prod` obligatorio).
   - SQS: reemplazar `adapter/sqs` + `adapter/email/saturn` por un adaptador que **inserte en `email_jobs`** (Postgres). Mantener la interfaz que usa `UserEmail.ReadEmail` para que el servicio no cambie.
   - Migración `000018_email_jobs` (up/down):
     ```sql
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
     ```
     El `payload` es exactamente el JSON que antes iba a SQS (`domain.ReadEmailBodyRequest`).
   - `go mod tidy`: deben desaparecer `aws-lambda-go`, `aws-lambda-go-api-proxy`. `aws-sdk-go` queda **solo** por Cognito.
   - Cognito: en F1 su config deja de ser obligatoria al arrancar (si falta, la API arranca y los endpoints `/users/*` responden 503). Se reemplaza en F2.
5. **Entorno local** `infra/docker-compose.yml`: `postgres:16` (volumen nombrado) + `api` (build `apps/api`), sin Redis.
   - `infra/scripts/restore.sh`: genera la lista con `pg_restore -l`, excluye todo lo que tenga `cron`/`pg_cron` y restaura con `--no-owner --no-acl` desde `../cashflowprod.dump` (ruta configurable). Idempotente: dropea y recrea la DB.
   - Después del restore, la API corre `migrate up` (golang-migrate ya está) → queda en versión 18.
6. `CLAUDE.md` en la raíz del monorepo con: estructura, cómo correr, convenciones (arquitectura hexagonal ports/adapters, tests con gomock), reglas (no secretos, no AWS).
7. `README.md` raíz con quickstart.

## Criterios de aceptación
- [x] `cd apps/api && go build ./... && go test ./...` pasan.
- [x] `grep -r "aws-lambda" apps/api` vacío; `grep -rl "aws-sdk-go" apps/api` solo en el adaptador Cognito y su config.
  _(F1: `internal/adapter/auth/cognito/**` + `go.mod/go.sum`.)_
- [x] `docker compose -f infra/docker-compose.yml up` → API sana en `http://localhost:8080/` y Swagger en `/docs/index.html`.
- [x] Tras restore: `select count(*) from transactions` = 8748; `user_extra` = 62; `schema_migrations.version` = 18.
- [x] `POST /email/read` (con auth simulada o test unitario) inserta fila en `email_jobs`.
  _(F1: `TestEmailHandler_ReadEmail_EnqueuesJob` + integración `-tags integration` contra Postgres.)_
- [x] Ningún secreto real en el repo; `.env.example` completos.
- [x] Primer commit hecho en `topi/` (repos viejos intactos).
