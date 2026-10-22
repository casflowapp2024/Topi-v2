# CLAUDE.md

Guía para trabajar en este monorepo. Contexto y fases de la migración: `plan/` (empieza por
`plan/00-plan-general.md`). Quickstart: `README.md`.

## Estructura

```
apps/api      Go 1.23, módulo `cash-flow`. Entrada: cmd/http/main.go
  internal/core/domain     entidades y reglas de negocio (sin dependencias de infraestructura)
  internal/core/port       interfaces (puertos) + mocks gomock en port/mock
  internal/core/service    casos de uso; dependen solo de port y domain
  internal/adapter/*       implementaciones: handler/http (Gin), storage/postgres (pgx + squirrel,
                           migraciones embebidas), email (gmail, outlook, jobqueue), auth (jwt HS256,
                           password argon2id), ratelimit, config, logger, server (injector = wiring)
apps/worker   Python 3.12, worker de correos (paquete `worker/`): scheduler + job loop sobre email_jobs
  providers/   gmail, outlook, senders (remitentes separados por coma)
  extractors/  TransactionExtractor; GeminiExtractor + prompt_v3 (no cambiar prompt ni modelo sin evaluar)
  jobs.py      flujo de un job (idempotente); db.py (psycopg 3); api_client.py (X-API-Key); errors.py
apps/web      React CRA
infra/        docker-compose.yml, scripts/ (restore.{sh,ps1}, make-admin, reset-password, auth-report, sql/,
              prod/ para el servidor, smoke-prod.sh), coolify/ (plantillas de variables + RUNBOOK.md)
plan/         plan de migración
```

## Cómo correr

- Local completo: `infra/scripts/restore.sh` (o `restore.ps1`) → Postgres restaurado + API en :8080.
- API: `cd apps/api && go build ./... && go test ./...`.
- Integración: `go test -tags integration ./internal/adapter/storage/postgres/repository/` con `DB_*`.
- Worker: `docker build --target test -t topi-worker-test apps/worker && docker run --rm topi-worker-test`
  (o un venv local: `pip install -r requirements-dev.txt && pytest`; con `TEST_DATABASE_URL` corren los tests `db`).
- Mocks: `go install github.com/golang/mock/mockgen@v1.6.0` y
  `go generate ./internal/core/port/...`.
  Si cambias un puerto, regenera su mock en el mismo commit.
- Migraciones: `internal/adapter/storage/postgres/migrations/NNNNNN_nombre.{up,down}.sql`
  (golang-migrate, se aplican solas al arrancar la API). Siempre con `down`.

## Convenciones

- Arquitectura hexagonal: el core (`domain`, `port`, `service`) no importa adaptadores ni SDKs
  externos. Lo de infraestructura va en `internal/adapter/...` y se cablea en `adapter/server/injector.go`.
- Un adaptador nuevo implementa un puerto existente; si la interfaz solo la usa un adaptador,
  defínela en el paquete consumidor (ej. `jobqueue.Store`).
- Tests con testify + gomock; tests de handlers con `httptest` y el payload de auth puesto en el
  contexto (`enums.AuthorizationPayloadKey`).
- Errores de dominio en `core/domain/error.go`; el status HTTP se mapea en `handler/http/response.go`.
- La cola de lectura de correos es la tabla `email_jobs`: el payload es el JSON de
  `domain.ReadEmailBodyRequest` (el mismo contrato que antes iba a SQS); `priority=1` = leer ahora.
- Worker: idempotencia obligatoria (processed_emails + transactions.source_message_id + dedupe legado en la API).
  Solo los errores de credenciales marcan una conexión (códigos del front); lo transitorio se reintenta.
  Las migraciones van en la API; el worker no migra.
- `user_id` en todas las tablas = `users.id` (para los migrados, el `sub` del proveedor anterior). No se transforma.
- Auth: los strings de `core/domain/error.go` y el formato `{"messages": [...]}` son contrato con el front
  (compara textos exactos); la respuesta de login mantiene la forma de `domain.AuthTokens`.
- Auth de servicios internos: `X-API-Key` (`INTERNAL_API_KEY`), comparada en tiempo constante.
- No confundir el login con Google (eliminado) con el OAuth de Gmail/Outlook para leer correos (se mantiene).
- Web: Redux + thunk (`redux/actions`), Tailwind según `apps/web/brand_guidelines.md`. Formatos con los
  helpers de `src/components/helpers.js` (`formatCurrency`, `capitalizeWords`, `parseDatetimetoDateStrFormat`).
  Modales con `Dialog` de `@headlessui/react`; cada vista con versión PC (`lg:flex`) y móvil (`lg:hidden`).

## Reglas

- **Cero secretos en el repo.** Solo `.env.example` con placeholders; `.env` está en `.gitignore`.
  Antes de commitear, revisa con
  `git grep -nIE "AIza|GOCSPX-|eyJ[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|AKIA|-----BEGIN"`.
  No copies valores de los repos viejos (`cdk.json`, `.env*`, `env_config.txt`).
- **Nada de AWS.** Sin Lambda, CDK, SQS, S3/Glue, Secrets Manager, DynamoDB, EventBridge ni Cognito.
- **Nada de envío de correos** (ni SMTP ni proveedores): "olvidé mi contraseña" lo resuelve el admin con
  `infra/scripts/reset-password.sh`.
- El email del admin no va en migraciones: se asigna con `infra/scripts/make-admin.sh`.
- **Privacidad:** en local no se procesan correos de usuarios reales. Pruebas reales solo con una conexión
  del equipo (`WORKER_ONLY_EMAIL_IDS`) y primero con `WORKER_DRY_RUN=true`. No se guarda el cuerpo de los correos.
- No toques los repos viejos (`../cashflow-backend`, `../cashflow-saturn`, `../cash-flow-front`)
  ni el dump.
- `go test ./...` debe quedar verde en cada commit. El CI (`.github/workflows/ci.yml`) arranca Postgres con
  `apps/api/testdata/schema_v17.sql`: las migraciones 1–17 usan pg_cron y no corren en una base vacía.
- Producción (Coolify): `infra/coolify/RUNBOOK.md`. Los scripts de `infra/scripts/prod/` exigen `--container` o `DATABASE_URL`.
- Archivos con LF (`.gitattributes`); `*.ps1` con CRLF.
