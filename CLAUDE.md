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
                           migraciones embebidas), email (gmail, outlook, jobqueue: LEER correos),
                           mail (resend, logmailer, templates: ENVIAR correos), auth (jwt HS256,
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
  helpers de `src/components/helpers.js` (`formatMoney(monto, moneda)` —único formateador de dinero, es-CO,
  moneda base del usuario por defecto—, `capitalizeWords`, `parseDatetimetoDateStrFormat`). Montos de una
  transacción o cuenta en su moneda con `ui/Money` o `FormatMoneyShowDecs` (`currency` + `base`).
  Modales con `Dialog` de `@headlessui/react`; cada vista con versión PC (`lg:flex`) y móvil (`lg:hidden`).
- Multimoneda: la moneda la fija la cuenta (`accounts.currency`); los reportes de flujos suman `amount_base`.
  Montos y tasas nuevos viajan como string decimal (shopspring/decimal en Go); no los sumes en float en el front.
- Transferencias: `transactions.transfer_group_id` liga las dos patas. No cuentan en los totales de ingresos,
  gastos y ahorro (`flowAmountCalc`, columnas `transfer_*` de `daily_account_totals`), pero sí en saldos. En
  presupuestos (`countsInBudget`) solo cuentan si la otra pata está en una cuenta de inversión; entre cuentas
  propias o pagando una tarjeta, no. `mtd_budget` y `budget_spent` son lo comparable con el presupuesto: flujos
  más lo movido a inversiones. Plan: `plan/10-tipos-de-cuenta.md`.
- Cargos de tarjeta (`card_charges`): lo pagado por encima de lo debido por corte. Se calculan, no son
  transacciones: una compra que llega tarde los corrige. Entran a gastos y a la categoría "Cargos de Tarjeta" en
  el mes del pago, solo desde los cortes de octubre de 2026. No cambian saldos ni la deuda estimada.
- Presupuestos con historial (`plan/26-presupuestos-historicos.md`): `category_budgets` guarda una versión por
  categoría y mes (`effective_from` = día 1, rige hasta la siguiente). Los reportes de un mes usan
  `budget_at(categoría, mes)`, nunca `categories.budget`, que es solo el vigente (= última versión; no hay meses
  futuros). El trigger `categories_budget_version` versiona en el mes en curso todo cambio de `categories.budget`;
  editar un mes pasado va por `PUT /categories/:id/budgets` (`from` = `YYYY-MM`). La versión más antigua no se borra.
- Clases de cuenta (`account_types.class`: deposit | investment | credit). En el front, `accountClass` /
  `isCreditAccount` / `isInvestmentAccount` de `helpers.js`; no compares `type_id`. Inversiones: su saldo es la
  última valoración (`account_valuations`) + movimientos posteriores; los reportes de saldos suman
  `account_valuation_deltas`, los de flujos no.
- Cambiar la moneda de una cuenta con movimientos o la moneda base: solo con `change_account_currency` /
  `change_base_currency` (vista previa y aplicar). Cuentas cerradas (`accounts.closed_at`): fuera de los selectores
  de movimientos nuevos (`isOpenAccount`).
- Tarjetas: términos en `credit_card_details`. Con día de corte, `credit_card_status` y `net_worth` estiman la deuda
  con compras y pagos por corte, no con el saldo acumulado (arrastra lo que nunca llegó por correo); es una cifra
  aproximada y la UI lo dice. `credit_card_cycles`: compras y pagos por corte. `transactions.installments`: el
  calendario sale de `installment_schedule` (`GET /transactions/installments`) y lo cobrado por corte de `card_billed`
  (contado más cuotas); la deuda incluye las cuotas por cobrar y lo no pagado de cortes anteriores (`card_carry`, por
  cortes y desde octubre de 2026). `net_worth_at(usuario, día)` es el patrimonio con esas mismas reglas a una fecha
  (`GET /analysis/net-worth/history`, un punto por cierre de mes); `net_worth` es `net_worth_at(hoy)`. En los
  reportes las compras desde `InstallmentsFrom` pesan una cuota por mes (`extraExpensesByDay`); las anteriores siguen
  completas. La bandeja pregunta las cuotas de compras grandes con tarjeta
  leídas de correo (`needs_installments=true`, `InstallmentPromptMin`, `POST /transactions/:id/installments` marca
  `installments_reviewed_at`). Plan: `plan/21-cuotas.md`.
- Correo saliente (`plan/23-correo-transaccional.md`): puerto `Mailer` (adaptadores `resend` y `logmailer`) y
  `MailOutboxService` sobre `email_outbox` (prioridad 1 = transaccional con cupo reservado en `MAIL_DAILY_QUOTA`,
  reintentos, `users.email_status` suprime por rebote/queja). Plantillas embebidas en `adapter/mail/templates/files`
  (`<nombre>.txt` con `subject` + `text`, `<nombre>.html` con `content`; datos faltantes = error). Los códigos van con
  `SendSecret` (el secreto nunca entra al outbox, no se reintenta); cifras como las del resumen mensual se calculan al
  enviar con un `MailEnricher`. Códigos de 6 dígitos en `auth_codes` (hash, 10 min, 5 intentos). `set-initial-password`
  está cerrado: sin contraseña se entra con `POST /users/password/forgot` + `/reset`. Preferencias en
  `notification_prefs` (resumen mensual apagado por defecto) y baja firmada sin login (`/mail/unsubscribe`). El
  aviso de conexión caída sale de `PUT /email/admin/error/:id` (`emails.alert_sent_at`, 1 cada 7 días).
- Panel admin (`plan/25-admin-metricas.md`, `/admin`, rol admin + `admin_audit` en cada acceso): agregados de
  `metrics_daily` y las vistas `admin_user_stats` / `admin_user_cohort`, que recalcula `refresh_admin_metrics(desde)`
  (worker 02:15, últimos 7 días; `POST /admin/metrics/refresh`). Días de America/Bogota. North Star = usuarios con
  ≥ 1 transacción `automated` y ≥ 1 día en `user_activity_days` en 7 días; la actividad la escribe `AuthMiddleware`
  una vez por usuario y día (`ActivityService`). `product_events` es lista cerrada (CHECK + `domain.ProductEvent`),
  props solo ids/enums, nunca montos ni texto; se emiten en los servicios, no en el front. `llm_usage`: solo conteos
  de tokens. Nombres de categorías/bancos/comercios solo con ≥ `domain.MinGroupUsers` (5) usuarios. Fundadores:
  `FOUNDER_CUTOFF` marca elegibles al arrancar; confirmar/quitar va con su fila de auditoría y nunca borra a nadie.
  Verificación manual: `infra/scripts/sql/admin-check.sql`.
- Pagos de tarjeta por correo: el worker (`flag_card_payments`, sin tocar el prompt) los vuelve entrada de la tarjeta y
  la API los guarda con `transactions.needs_counterpart`: ya cuentan como transferencia. `link_pending_card_payments`
  liga solo el caso sin duda; si no, la app pregunta de qué cuenta salió. No uses `should_verify` para esto: abrir la
  transacción lo borra.

## Reglas

- **Cero secretos en el repo.** Solo `.env.example` con placeholders; `.env` está en `.gitignore`.
  Antes de commitear, revisa con
  `git grep -nIE "AIza|GOCSPX-|eyJ[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|AKIA|-----BEGIN"`.
  No copies valores de los repos viejos (`cdk.json`, `.env*`, `env_config.txt`).
- **Nada de AWS.** Sin Lambda, CDK, SQS, S3/Glue, Secrets Manager, DynamoDB, EventBridge ni Cognito.
- **Correo saliente solo por `Mailer` + `email_outbox`**, proveedor Resend por API HTTP (nunca SMTP). En local y
  desarrollo `MAIL_PROVIDER=log` (no envía nada); `resend` fuera de producción exige `MAIL_ONLY_TO` y solo envía a
  esa lista. Nada sensible en asuntos ni en el payload del outbox (ni códigos, ni montos, ni contenido de correos
  bancarios). Webhook de Resend siempre con firma. El admin conserva `infra/scripts/reset-password.sh` como respaldo.
- El email del admin no va en migraciones: se asigna con `infra/scripts/make-admin.sh`.
- **Privacidad:** en local no se procesan correos de usuarios reales. Pruebas reales solo con una conexión
  del equipo (`WORKER_ONLY_EMAIL_IDS`) y primero con `WORKER_DRY_RUN=true`. No se guarda el cuerpo de los correos.
- No toques los repos viejos (`../cashflow-backend`, `../cashflow-saturn`, `../cash-flow-front`)
  ni el dump.
- `go test ./...` debe quedar verde en cada commit. El CI (`.github/workflows/ci.yml`) arranca Postgres con
  `apps/api/testdata/schema_v17.sql`: las migraciones 1–17 usan pg_cron y no corren en una base vacía.
- Producción (Coolify): `infra/coolify/RUNBOOK.md`. Los scripts de `infra/scripts/prod/` exigen `--container` o `DATABASE_URL`.
- Archivos con LF (`.gitattributes`); `*.ps1` con CRLF.
