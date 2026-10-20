# Prompt para Claude Code — Fase 1

> Abre Claude Code en `C:\Users\juanm\WorkSpace\topiv2` y pega lo de abajo.

---

Vamos a migrar el proyecto Topi (finanzas personales) de AWS a un servidor Hetzner con Coolify. AWS ya está apagado. En esta carpeta están:
- `cashflow-backend/` (API Go en `cashflow/`, más CDK)
- `cashflow-saturn/` (lector de correos en Python, Lambdas)
- `cash-flow-front/` (React CRA)
- `cashflowprod.dump` (pg_dump formato custom de PostgreSQL 16, la única fuente de datos)
- `plan/` (plan de migración)

Antes de tocar nada, lee completos `plan/00-plan-general.md` y `plan/01-fase-1.md`, y lee `plan/02-fase-2-auth.md` y `plan/03-fase-3-worker.md` como contexto. Tu tarea es **ejecutar solo la Fase 1** tal como está en `plan/01-fase-1.md`.

Reglas:
1. **No modifiques** los repos viejos (`cashflow-backend`, `cashflow-saturn`, `cash-flow-front`) ni el dump. Todo el trabajo nuevo va en `topiv2/topi/`, un repo git nuevo sin historia.
2. **Cero secretos** en el repo nuevo. Los repos viejos tienen credenciales en `cdk.json`, `.env*` y `env_config.txt`: no copies sus valores. Solo `.env.example` con placeholders. Antes del commit, corre un grep de secretos y muéstrame el resultado.
3. Respeta la arquitectura hexagonal existente (`core/domain`, `core/port`, `core/service`, `adapter/*`). Los cambios de infraestructura van en adaptadores; los servicios no deberían cambiar salvo lo mínimo.
4. Cognito **se queda** en esta fase, pero su config es opcional al arrancar. Se reemplaza en la Fase 2. No implementes auth nueva todavía.
5. SQS se reemplaza por inserciones en la tabla `email_jobs` (migración `000018`, esquema en el plan), con el mismo payload JSON que antes iba a SQS.
6. Quita Lambda, CDK, Secrets Manager, el Lambda `extract_logs` y todo lo de Glue/S3. Corre `go mod tidy`.
7. Docker local: `infra/docker-compose.yml` con `postgres:16` y la API. Usa `infra/scripts/restore.sh` para restaurar el dump excluyendo las entradas de `pg_cron` (genera la lista con `pg_restore -l`, filtra y usa `-L ... --no-owner --no-acl`). En Windows asegúrate de que el script funcione desde Git Bash o WSL, o agrega un equivalente `.ps1`.
8. Mantén verdes los tests existentes (`go test ./...`). Si un test dependía de Lambda o SQS, adáptalo y no lo borres sin explicarme por qué.
9. Crea `CLAUDE.md` y `README.md` en la raíz de `topi/` y copia `plan/` dentro del repo.

Forma de trabajo:
- Primero dame un plan corto de los cambios (archivos a borrar, crear y modificar) y espera mi OK.
- Luego trabaja por pasos con commits pequeños y descriptivos en `topi/`.
- Al final verifica **todos** los criterios de aceptación de `plan/01-fase-1.md`: ejecuta los comandos, muéstrame la salida resumida y marca los checkboxes en la copia del plan dentro del repo.
- Si algo del plan es inconsistente con el código real, detente y pregúntame en vez de improvisar.
