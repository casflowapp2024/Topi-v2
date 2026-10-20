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
   cp infra/.env.example infra/.env          # cambia POSTGRES_PASSWORD, JWT_SECRET e INTERNAL_API_KEY
                                             # (openssl rand -hex 32); sin JWT_SECRET la API no arranca
   cp apps/api/.env.example apps/api/.env    # opcional: OAuth Gmail/Outlook
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

## Auth (Fase 2): email + contraseña, sin correo

- Sin AWS ni Cognito. JWT HS256 (`JWT_SECRET`), refresh tokens rotativos, contraseñas con argon2id.
- Registro sin verificación (entra directo). No hay login con Google; el OAuth de Gmail/Outlook
  para **leer correos** (Conexiones) sigue igual.
- Usuarios migrados (`users.migrated`, sin contraseña): al entrar, la API responde
  `user needs to reset the password` y el front les pide crear una (`POST /users/set-initial-password`).
  Funciona una sola vez por cuenta, respeta `INITIAL_PASSWORD_UNTIL` y queda en `auth_events`.
- Worker y n8n: header `X-API-Key: $INTERNAL_API_KEY` para las rutas `admin/*`.

Scripts de administración (corren `psql` dentro del contenedor):

```bash
infra/scripts/make-admin.sh <email>       # role = admin
infra/scripts/reset-password.sh <email>   # "olvidé mi contraseña": vuelve a "crear contraseña" y cierra sesiones
infra/scripts/auth-report.sh [dias]       # migrados con/sin contraseña, últimos eventos
```

## Otras notas de la migración

- Sin Lambda, CDK, SQS ni Secrets Manager. La API corre solo como servidor HTTP (`cmd/http`).
- `POST /email/read` encola jobs en la tabla `email_jobs` (migración 18), que consumirá el worker (Fase 3).
- `pg_cron` no existe fuera de RDS: el restore lo excluye; los refresh de vistas materializadas
  los hará el worker (Fase 3).
