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
                           migraciones embebidas), email (gmail, outlook, jobqueue), auth (cognito,
                           jwt, social, unavailable), config, logger, server (injector = wiring)
apps/worker   Python, ex-Lambdas de Saturn. Solo copiado en F1; se refactoriza en F3
apps/web      React CRA
infra/        docker-compose.yml, scripts/restore.{sh,ps1}, n8n/
plan/         plan de migración
```

## Cómo correr

- Local completo: `infra/scripts/restore.sh` (o `restore.ps1`) → Postgres restaurado + API en :8080.
- API: `cd apps/api && go build ./... && go test ./...`.
- Integración: `go test -tags integration ./internal/adapter/storage/postgres/repository/` con `DB_*`.
- Mocks: `go install github.com/golang/mock/mockgen@v1.6.0` y
  `go generate ./internal/core/port/... ./internal/adapter/auth/cognito/...`.
  Si cambias un puerto, regenera su mock en el mismo commit.
- Migraciones: `internal/adapter/storage/postgres/migrations/NNNNNN_nombre.{up,down}.sql`
  (golang-migrate, se aplican solas al arrancar la API). Siempre con `down`.

## Convenciones

- Arquitectura hexagonal: el core (`domain`, `port`, `service`) no importa adaptadores ni SDKs
  externos. Lo de infraestructura va en `internal/adapter/...` y se cablea en `adapter/server/injector.go`.
- Un adaptador nuevo implementa un puerto existente; si la interfaz solo la usa un adaptador,
  defínela en el paquete consumidor (ej. `jobqueue.Store`, `cognito.API`).
- Tests con testify + gomock; tests de handlers con `httptest` y el payload de auth puesto en el
  contexto (`enums.AuthorizationPayloadKey`).
- Errores de dominio en `core/domain/error.go`; el status HTTP se mapea en `handler/http/response.go`.
- La cola de lectura de correos es la tabla `email_jobs`: el payload es el JSON de
  `domain.ReadEmailBodyRequest` (el mismo contrato que antes iba a SQS); `priority=1` = leer ahora.
- `user_id` en todas las tablas = `sub` de Cognito (varchar). No se transforma.

## Reglas

- **Cero secretos en el repo.** Solo `.env.example` con placeholders; `.env` está en `.gitignore`.
  Antes de commitear, revisa con
  `git grep -nIE "AIza|GOCSPX-|eyJ[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|AKIA|-----BEGIN"`.
  No copies valores de los repos viejos (`cdk.json`, `.env*`, `env_config.txt`).
- **Nada de AWS nuevo.** Sin Lambda, CDK, SQS, S3/Glue, Secrets Manager, DynamoDB, EventBridge.
  `aws-sdk-go` solo vive en `internal/adapter/auth/cognito` y se elimina en la Fase 2.
- No toques los repos viejos (`../cashflow-backend`, `../cashflow-saturn`, `../cash-flow-front`)
  ni el dump.
- `go test ./...` debe quedar verde en cada commit.
- Archivos con LF (`.gitattributes`); `*.ps1` con CRLF.
