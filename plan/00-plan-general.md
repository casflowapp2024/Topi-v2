# Plan general

## Contexto
- AWS está apagado: **no hay** Cognito, DynamoDB (`saturn-last-run`), S3, SQS ni CloudWatch. Solo queda el dump.
- Dump `cashflowprod.dump`: PG 16, restaura limpio salvo `pg_cron` (extensión de RDS; se ignora).
- Datos: 62 usuarios en `user_extra` (56 con email, todos únicos; los 6 sin email no tienen datos),
  8.748 transacciones (jul-2025 → 17-oct-2026), 73 cuentas, 23 conexiones de correo (10 activas), migraciones en versión 17.
- Todas las tablas usan `user_id` = `sub` de Cognito (varchar). **Se conserva tal cual** como ID de usuario: no se transforma ninguna tabla.

## Decisiones
1. **Monorepo nuevo** `topi/` sin historia git (los repos viejos tienen secretos commiteados en `cdk.json` y `.env`).
   ```
   topi/
     apps/api      ← Go (desde cashflow-backend/cashflow), solo cmd/http
     apps/worker   ← Python (desde cashflow-saturn/lambda_code), proceso long-running
     apps/web      ← React (desde cash-flow-front)
     infra/        ← docker-compose local, scripts de restore, n8n
     plan/ → (este plan)
   ```
2. **Sin AWS**: fuera Lambda, API Gateway, CDK, SQS, Secrets Manager, Glue/S3, EventBridge, DynamoDB, Cognito.
3. **Auth propia solo con email + contraseña**. Se elimina el login con Google (Hosted UI de Cognito).
   OJO: el **OAuth de Gmail/Outlook para leer correos se mantiene**: es otra cosa, vive en Google Cloud/Azure, no en AWS.
4. **Cola = Postgres** (`email_jobs` con `FOR UPDATE SKIP LOCKED`). Sin Redis en v1 (en prod no estaba configurado).
5. **Cron** dentro del worker: lectura horaria + `REFRESH MATERIALIZED VIEW CONCURRENTLY` (reemplaza pg_cron).
6. **Sin servicio de correo** (decisión 19-oct): registro sin verificación; los migrados crean su contraseña desde el login; “olvidé mi contraseña” lo resuelve el admin con un script.
7. Se mantienen dominio `www.topi.cash` y los **mismos OAuth clients** de Google/Microsoft (se rotan solo los secrets) → los refresh tokens guardados en `emails` siguen siendo válidos.

## Arquitectura destino (Coolify)
```
www.topi.cash → web (estático, nginx, headers COOP/COEP)
api.topi.cash → api (Go, Dockerfile)      ─┐
worker        → Python (cron + cola)       ├─ Postgres 16 (backup diario a Hetzner Object Storage/B2)
n8n           → chatbot (self-hosted)     ─┘
```

## Fases
| Fase | Objetivo | Resultado verificable |
|---|---|---|
| 0 | Rotar secretos | Nuevos client secrets Google/Azure, nueva API key Gemini; los viejos revocados |
| 1 | Monorepo + entorno local + API sin AWS | `docker compose up` levanta Postgres restaurado + API; `go build/test` OK; cero imports `aws-*` salvo cognito (se va en F2) |
| 2 | Auth propia (contraseña, sin correo) | signup/login contra `users`; migrados crean su contraseña desde el login |
| 3 | Worker de correos | Lee desde el corte del 17-oct, sin duplicados; botón “leer ahora” encola job |
| 4 | Frontend + n8n | Front sin Google login, apunta a API nueva; chatbot operando |
| 5 | Deploy Coolify | Servicios arriba con dominios, TLS y backups |
| 6 | Corte | DNS → Hetzner; aviso a usuarios (el front muestra el mensaje de migración); monitoreo 1 semana |

## ¿Se pueden migrar las cuentas (incluidas las de Google)? → Sí
- No se pueden recuperar contraseñas (Cognito no las exporta y ya no existe). **Todos** los usuarios, los de Google y los de contraseña, pasan por el mismo flujo:
  1. Se crea `users` a partir de `user_extra` (`id = user_id`, `email = lower(email)`, `password_hash = NULL`, `verified = true`).
  2. Al intentar login sin contraseña, la API responde `user needs to reset the password` y el front muestra el aviso de migración y el formulario para crearla (sin código; riesgo aceptado, ver 02-fase-2-auth.md).
- Los datos quedan intactos porque el `user_id` no cambia.
- El rol admin vivía en grupos de Cognito (perdido) → `make-admin.sh cashflowapp2024@gmail.com`.

## Reanudar la lectura de correos (sin DynamoDB)
- Última corrida observada: `max(created_at)` de transacciones automáticas = **2026-10-17 09:00 UTC**.
- `email_sync_state(email_id, sender_email, last_run)` se siembra con ese corte global para todos los pares activos (email, remitente). Es más seguro que el máximo por par, porque pares sin movimientos también corrían cada hora.
- Riesgo: AWS pudo correr algunas horas más antes del apagado → en la primera corrida se aplica **dedupe** contra transacciones existentes: misma `account_id`, `amount`, `expense` y `date` (±2 min).
- Desde ahí: nueva columna `transactions.source_message_id` (único por usuario) → idempotencia permanente.

## Retos / lo que no se puede
- Contraseñas no recuperables → reset obligatorio para todos (ver arriba).
- Logs, métricas y correos crudos de S3: perdidos. No se volverán a guardar: solo metadatos en `processed_emails` (decisión 19-oct).
- `gmail.readonly` es un scope restringido de Google: para pasar de ~100 usuarios se exige verificación + auditoría CASA anual. A futuro, evaluar el modelo de “reenvío de correos” a `@in.topi.cash`.
- `pg_cron` no está en el Postgres de Coolify → se reemplaza con el cron del worker.
- Prefijo `/prod` de API Gateway: la API nueva no lo usa; se ajustan front, worker y n8n.
- Si hay app móvil (`topi://gauth`), queda afectada por el retiro del login con Google.
- Gemini Flash-Lite cuesta centavos al mes con este volumen; mantenerlo. Opcional: parsers regex por banco con el LLM como respaldo.
