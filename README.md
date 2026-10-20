# Topi

Finanzas personales: lee correos de notificaciones bancarias (Gmail/Outlook), extrae transacciones
con un LLM y las muestra en un dashboard. Monorepo de la migración de AWS a Hetzner + Coolify
(ver [`plan/`](plan/README.md)).

```
apps/api      API Go (Gin, Postgres, arquitectura hexagonal)
apps/worker   Lector de correos en Python (ex-Saturn; se refactoriza en la Fase 3)
apps/web      Front React (CRA)
infra/        docker-compose local, scripts de restore, workflows de n8n
plan/         plan de migración por fases
```

## Quickstart (local)

Requisitos: Docker Desktop (o Docker Engine) y el dump `cashflowprod.dump` (por defecto en la
carpeta padre del repo: `../cashflowprod.dump`). Go 1.23+ solo si vas a correr la API o los
tests fuera de Docker.

1. Variables de entorno (nunca se commitean):

   ```bash
   cp infra/.env.example infra/.env          # cambia POSTGRES_PASSWORD
   cp apps/api/.env.example apps/api/.env    # opcional: OAuth Gmail/Outlook, Cognito
   ```

2. Restaurar el dump y levantar la API (dropea y recrea la DB en cada corrida):

   ```bash
   infra/scripts/restore.sh                  # Linux, macOS, Git Bash o WSL
   ```

   ```powershell
   pwsh infra/scripts/restore.ps1            # Windows sin bash
   ```

   Para usar otro dump: `infra/scripts/restore.sh /ruta/al/dump` (o `DUMP_FILE` en `infra/.env`).

3. Listo:
   - API: <http://localhost:8080/> → `{"status":"healthy"}`
   - Swagger: <http://localhost:8080/docs/index.html>
   - Postgres: `localhost:5432` (credenciales de `infra/.env`)

Después del primer restore basta con:

```bash
docker compose -f infra/docker-compose.yml up -d --build
```

## Tests

```bash
cd apps/api
go build ./... && go test ./...
# integración contra el Postgres local (inserta en email_jobs):
DB_HOST=localhost DB_PORT=5432 DB_USER=topi DB_PASSWORD=... DB_NAME=cashflow \
  go test -tags integration ./internal/adapter/storage/postgres/repository/
```

## Estado de la migración (Fase 1)

- Sin Lambda, CDK, SQS ni Secrets Manager. La API corre solo como servidor HTTP (`cmd/http`).
- `POST /email/read` encola jobs en la tabla `email_jobs` (migración 18), que consumirá el worker (Fase 3).
- Cognito sigue en el código pero es **opcional**: sin su config la API arranca y todo lo que
  depende de auth responde **503** (se reemplaza por auth propia en la Fase 2).
- `pg_cron` no existe fuera de RDS: el restore lo excluye; los refresh de vistas materializadas
  los hará el worker (Fase 3).
