# Topi

Finanzas personales: lee correos de notificaciones bancarias (Gmail/Outlook), extrae transacciones
con un LLM y las muestra en un dashboard. Monorepo de la migración de AWS a Hetzner + Coolify
(ver [`plan/`](plan/README.md)).

```
apps/api      API Go (Gin, Postgres, arquitectura hexagonal)
apps/worker   Lector de correos en Python (ex-Saturn; se refactoriza en la Fase 3)
apps/web      Front React (CRA) + nginx; e2e/ con Playwright
infra/        docker-compose local, scripts de restore
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
- Worker: header `X-API-Key: $INTERNAL_API_KEY` para las rutas `admin/*`.

Scripts de administración (corren `psql` dentro del contenedor):

```bash
infra/scripts/make-admin.sh <email>       # role = admin
infra/scripts/reset-password.sh <email>   # "olvidé mi contraseña": vuelve a "crear contraseña" y cierra sesiones
infra/scripts/auth-report.sh [dias]       # migrados con/sin contraseña, últimos eventos
```

## Worker de correos (Fase 3)

`apps/worker`: proceso de larga duración (scheduler + job loop sobre `email_jobs`). Lee Gmail/Outlook desde
`email_sync_state.last_run`, extrae transacciones con Gemini y las crea vía API (idempotente por mensaje).

```bash
docker compose -f infra/docker-compose.yml up -d --build worker       # postgres + api + worker
docker compose -f infra/docker-compose.yml exec worker python -m worker enqueue-now
docker compose -f infra/docker-compose.yml exec worker python -m worker refresh-views --all
docker compose -f infra/docker-compose.yml logs -f worker             # logs JSON
```

En local el worker arranca con `WORKER_DRY_RUN=true` y `WORKER_ONLY_EMAIL_IDS=0` (no lee ningún correo).
Para probar con la conexión del equipo: credenciales en `apps/worker/.env` y en `infra/.env`
`WORKER_ONLY_EMAIL_IDS=<emails.id>` (primero con dry run). Ver `plan/03-fase-3-worker.md`.

## Front (Fase 4)

`apps/web` (CRA) se sirve con nginx (`apps/web/Dockerfile`, `nginx.conf`) en el puerto 8080 del contenedor.

```bash
docker compose -f infra/docker-compose.yml up -d --build              # postgres + api + worker + web
# http://localhost:3000  (la API debe tener HTTP_ALLOWED_ORIGINS con http://localhost:3000)
```

- `REACT_APP_*` se hornean en el build: se pasan como build args. En el compose la URL de la API es
  `WEB_API_URL` (por defecto `http://localhost:8080`); si la cambias, `docker compose build web`.
- Producción: `--build-arg REACT_APP_API_URL=https://api.topi.cash` (y `REACT_APP_GA_TRACKING_ID`, opcional).
  La API con `HTTP_ALLOWED_ORIGINS=https://www.topi.cash,https://topi.cash`.
- Service worker (`public/service-worker.js`): network-first para navegaciones, `/static` cache-first, la API
  nunca pasa por la caché. Cada build lleva su propia caché (`topi-v2-<BUILD_ID>`) y borra las demás; si
  encuentra la del SW viejo (`topi-pwa-cache-v1`) recarga las ventanas abiertas para sacarlas de esa versión.
- Reconexión de Gmail/Outlook: el callback es la ruta `/gmail-auth-connect` del front. En producción
  `GMAIL_REDIRECT_URIS` y `OUTLOOK_REDIRECT_URL` siguen apuntando a `https://www.topi.cash/gmail-auth-connect`.
  Para probarla en local hay que agregar `http://localhost:3000/gmail-auth-connect` como redirect URI
  en Google Cloud y en Azure, y ponerla en `apps/api/.env`.
- E2E con Playwright: `apps/web/e2e/README.md`.

## Producción (Fase 5)

Hetzner + Coolify: pasos en `infra/coolify/RUNBOOK.md`; variables en `infra/coolify/*.env.template`.
Scripts para el servidor en `infra/scripts/prod/` (`restore-prod.sh`, `make-admin.sh`, `reset-password.sh`,
`auth-report.sh`, `backup-check.sh`) y `infra/scripts/smoke-prod.sh` (solo lectura) desde cualquier máquina.
`GET /health` de la API: estado de la base y del heartbeat del worker (para el monitoreo).

## Otras notas de la migración

- Sin Lambda, CDK, SQS ni Secrets Manager. La API corre solo como servidor HTTP (`cmd/http`).
- `POST /email/read` ("leer ahora") encola en `email_jobs` con prioridad 1; no duplica si ya hay uno pendiente.
- `pg_cron` no existe fuera de RDS: el restore lo excluye y los refresh de vistas los hace el worker.
