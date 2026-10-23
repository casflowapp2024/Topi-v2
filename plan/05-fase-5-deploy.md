# Fase 5: deploy en Hetzner + Coolify

## Contexto
- La producción vieja está caída (AWS apagado), así que **no hay sistema vivo que proteger**: se despliega directo en los dominios finales.
  El riesgo se controla con el worker, que sale **apagado o en modo prueba** y se abre por etapas (aquí y en la Fase 6).
- Los datos de producción = el mismo `cashflowprod.dump` del 17-oct, restaurado en el Postgres de Coolify.
- Dominios: `https://www.topi.cash` (web), `https://topi.cash` → redirección a `www`, `https://api.topi.cash` (API). DNS bajo control del equipo.
- El repo `topi` **aún no tiene remoto**. Coolify despliega desde GitHub → primer paso: repo privado y push.

## Arquitectura en Coolify (proyecto `topi`, entorno `production`)
| Recurso Coolify | Tipo | Origen | Dominio | Notas |
|---|---|---|---|---|
| `topi-db` | Database → PostgreSQL 16 | imagen `postgres:16-alpine` | ninguno (**no público**) | Backups programados a S3 |
| `topi-api` | Application → Dockerfile | GitHub, base dir `apps/api` | `https://api.topi.cash` | Puerto 8080. Migra al arrancar |
| `topi-web` | Application → Dockerfile | GitHub, base dir `apps/web` | `https://www.topi.cash`, `https://topi.cash` (redirige a www) | Build args `REACT_APP_*` |
| `topi-worker` | Application → Dockerfile | GitHub, base dir `apps/worker` | ninguno | Sin puertos expuestos |

¿Por qué recursos separados y no un solo docker-compose? Coolify trae **backups nativos** para recursos de base de datos, permite
deploy y rollback independientes por servicio, y con *watch paths* solo redespliega lo que cambió (`apps/api/**`, etc.).
Todos van al mismo *destination* (red Docker de Coolify) y se hablan por el **hostname interno** que muestra Coolify.

## Parte A: trabajo en el repo (Claude Code)
1. ✅ **Scripts de producción** en `infra/scripts/prod/`. Corren **en el servidor** por SSH, contra un contenedor Postgres por nombre
   (`--container <nombre>`) o un `DATABASE_URL`, sin depender del compose local:
   - `restore-prod.sh --container <pg> --dump <ruta> [--force]`: misma lógica de `restore.sh` (excluir `pg_cron`, `--no-owner --no-acl`).
     **Se niega** si la base ya tiene tablas, salvo `--force`. Al final imprime los conteos esperados (transactions 8748, user_extra 62, emails 23).
   - `make-admin.sh`, `reset-password.sh` y `auth-report.sh` con el mismo esquema `--container`/`DATABASE_URL`. Sin duplicar SQL: compartir con los locales vía `lib.sh`.
   - `backup-check.sh`: descarga el último backup del bucket S3, lo restaura en un contenedor temporal y compara conteos. Sirve para probar que los backups funcionan.
2. ✅ **Smoke test de producción**: `infra/scripts/smoke-prod.sh [API_URL] [WEB_URL]`. **No** crea datos ni toca usuarios reales. Verifica:
   - `GET /` de la API = 200; `/docs` no expuesto en producción (o protegido).
   - CORS: preflight desde `https://www.topi.cash` permitido; desde un origen cualquiera, rechazado.
   - Contrato de login: credenciales falsas → 401/403 con el mensaje exacto que espera el front.
   - Web: `/` 200, `/dashboard` 200 (fallback SPA), `/healthz` 200, `index.html` y `service-worker.js` con `no-cache`, `/static/*` con `immutable`, sin COEP, `topi.cash` → 301/308 a `www`.
   - TLS válido en los 3 dominios.
3. ✅ **Endurecer la API para producción** (cambios pequeños):
   - Swagger (`/docs`) deshabilitado cuando `APP_ENV=production`.
   - `GET /health` (nuevo, sin auth): `{"status":"ok","db":"ok","worker_last_seen":"<timestamp>"}`. El worker escribe un *heartbeat*
     en una tabla `worker_heartbeat` (migración 000021) en cada vuelta del loop. Si el último heartbeat tiene más de 10 min → `"worker":"stale"` (sigue respondiendo 200: es para monitoreo, no para reiniciar la API).
   - El `HEALTHCHECK` del Dockerfile de la API apunta a `/health`.
   - Verificar `TRUSTED_PROXIES` para que el rate limit vea la IP real detrás del proxy de Coolify (Traefik o Caddy).
4. ✅ **CI en GitHub Actions** (`.github/workflows/ci.yml`), en cada push y PR: `go test ./...` (con Postgres de servicio para los tests de integración), `pytest` del worker y `npm run build` del web.
   Playwright **no** corre en CI (es pesado y usa el dump real, que no va al repo).
5. ✅ **Plantillas de variables** `infra/coolify/*.env.template` (api, worker, web-build-args, db): cada variable con comentario
   *secreto / no secreto / valor de producción*. Sin valores reales.
6. ✅ **Runbook** `infra/coolify/RUNBOOK.md`: los pasos manuales de la Parte B, con los comandos exactos.
7. ✅ **`.gitignore` y dump**: confirmar que ningún `.env` real, dump ni `e2e/.auth` está trackeado antes del primer push. Ejecutar un escáner de secretos (`gitleaks detect` o equivalente) sobre todo el historial de `topi`.

### Estado de la Parte A (22-oct)
Commits `6e2dc17` (gitleaks + .gitignore), `705b37c` (000021, heartbeat, `/health`, `APP_ENV`), `f2c20c9` (scripts),
`f2ef0ed` (CI), `632ff9c` (plantillas + RUNBOOK). Probado en local:
- gitleaks sobre todo el historial: limpio (1 falso positivo, la clave de relleno de `jwt_test.go`, ignorado por
  fingerprint en `.gitleaksignore`). Trackeados solo los `.env.example`; dump y `e2e/.auth` ignorados.
- `go vet` + `go test ./...` + integración; pytest del worker 102/102 (incluidos los de base); build del web.
- `restore-prod.sh` contra un Postgres desechable: base vacía → 8748/62/23; con tablas sin `--force` → se niega
  (exit 3); con `--force` → 8748/62/23; modo `DATABASE_URL` → 8748/62/23.
- `smoke-prod.sh http://localhost:8080 http://localhost:3000` con `APP_ENV=production`: 18 ok, 0 fallas
  (TLS y redirección de `topi.cash` solo se comprueban con URLs https).
- `backup-check.sh` contra un S3 de prueba (S3Mock): backups custom y gzip+SQL restauran y coinciden con la base.

Decisiones y diferencias con lo escrito arriba:
- `APP_ENV=production` se acepta como alias de `prod` (el código comparaba con `prod` y `/docs` quedaba expuesto).
- `/health` responde **503** si la base no responde (200 aunque el worker esté stale). El heartbeat se escribe
  como mucho cada 30 s (el loop vuelve cada 0,5 s con trabajo).
- `smoke-prod.sh` deja 1 fila `login_fail` en `auth_events` por corrida (`smoke-test@invalid.test`).
- **CI:** las migraciones 1–17 usan `pg_cron` (solo RDS) y no corren en una base vacía → el Postgres del CI
  arranca con `apps/api/testdata/schema_v17.sql` (esquema v17 sin datos de usuarios) y la API migra 18 → 21.
- `TRUSTED_PROXIES`: el código ya lo soportaba; el RUNBOOK (B2.2/B2.3) dice cómo sacar la subred y cómo verificarlo.
- Pendiente de la Parte B: CI en verde en GitHub (requiere el push), todo lo demás de B0–B7.

## Parte B: pasos manuales (el equipo, siguiendo el runbook)
### B0. Prerrequisitos
- [ ] Repo privado en GitHub (p. ej. `casflowapp2024/topi`), push de `main`. Coolify conectado vía **GitHub App** solo a ese repo.
- [ ] **Secretos rotados**: client secret de Google (Gmail) y de Azure (Outlook), API key de Gemini **de un proyecto con facturación activa**.
      Los valores viejos están en el historial de los repos viejos. Rotar un client secret **no** invalida los refresh tokens guardados.
- [ ] Generar: `POSTGRES_PASSWORD`, `JWT_SECRET`, `INTERNAL_API_KEY` (`openssl rand -hex 32` cada uno).
- [ ] Bucket S3-compatible para backups. Opciones de $0: **Cloudflare R2** (10 GB gratis, sin costo de salida) o Backblaze B2 (10 GB gratis). La base pesa menos de 100 MB.
- [ ] Servidor: Coolify actualizado; RAM libre de al menos 1,5 GB para Topi; swap configurado; Hetzner Cloud Firewall con 22 (idealmente solo tu IP), 80 y 443 abiertos; el puerto 5432 **cerrado**; el panel de Coolify detrás de su propio dominio con HTTPS o con el puerto restringido.
- [ ] DNS: bajar el TTL de `@`, `www` y `api` a 300 s un día antes. **No borrar** registros MX/TXT existentes.

### B1. Base de datos
1. Crear `topi-db` (PostgreSQL 16, usuario `topi`, base `cashflow`, contraseña generada). **No** marcarla como pública.
2. Configurar el backup: diario a las 03:30 (Bogotá), destino S3 (R2/B2), retención de 30 copias. Ejecutar un backup manual de prueba.
3. Subir el dump al servidor (`scp cashflowprod.dump root@<ip>:/root/`) y correr `restore-prod.sh --container <pg> --dump /root/cashflowprod.dump`.
4. Verificar los conteos. **Borrar el dump del servidor** cuando la restauración esté verificada.

### B2. API
1. Crear `topi-api` desde el repo: build pack Dockerfile, base dir `/apps/api`, puerto 8080, dominio `https://api.topi.cash`, watch path `apps/api/**`.
2. Variables según `api.env.template`. Claves: `APP_ENV=production`, `DB_HOST=<hostname interno de topi-db>`, `DB_SSL_MODE=disable` (red interna),
   `HTTP_ALLOWED_ORIGINS=https://www.topi.cash,https://topi.cash`, `JWT_SECRET`, `INTERNAL_API_KEY`, `TRUSTED_PROXIES`, `INITIAL_PASSWORD_UNTIL` (vacío por ahora),
   `GMAIL_*`/`OUTLOOK_*` con redirect `https://www.topi.cash/gmail-auth-connect`.
3. Deploy → revisar en los logs que las migraciones lleguen a la versión 21 → `/health` OK.
4. `make-admin.sh --container <pg> cashflowapp2024@gmail.com`.

### B3. Web
1. Crear `topi-web`: Dockerfile, base dir `/apps/web`, puerto 8080, dominios `https://www.topi.cash,https://topi.cash` con **redirección a www**, watch path `apps/web/**`.
2. Build args: `REACT_APP_API_URL=https://api.topi.cash`, `REACT_APP_GA_TRACKING_ID` (opcional). Marcarlos como *build variables*.

### B4. DNS y TLS
1. Registros A (y AAAA si el servidor tiene IPv6) de `@`, `www` y `api` → IP del servidor. Si el DNS está en Cloudflare: **DNS only** (nube gris) para que Let's Encrypt emita sin fricción.
2. Esperar los certificados en Coolify y correr `smoke-prod.sh`.

### B5. Worker (salida controlada)
1. Crear `topi-worker`: Dockerfile, base dir `/apps/worker`, sin dominio, watch path `apps/worker/**`.
2. Variables según `worker.env.template`: `DATABASE_URL` interno, `API_BASE_URL=http://<hostname interno de topi-api>:8080`, `INTERNAL_API_KEY`, `GEMINI_API_KEY`, OAuth de Gmail/Outlook.
3. **Etapa 1**: `WORKER_DRY_RUN=true`, `WORKER_ONLY_EMAIL_IDS=<conexión del equipo>`. Ver en los logs las transacciones que detectaría desde el 17-oct.
4. **Etapa 2**: `WORKER_DRY_RUN=false` con la misma conexión. Ver las transacciones creadas en la app y que una segunda corrida no duplique.
5. **Etapa 3** (Fase 6): `WORKER_ONLY_EMAIL_IDS=` vacío → todas las conexiones activas. Primera corrida = backfill desde el 17-oct.

### B6. Consolas OAuth
- Google Cloud y Azure: dejar como redirect URIs **solo** `https://www.topi.cash/gmail-auth-connect` (y `http://localhost:3000/...` si se quiere en desarrollo).
  Eliminar los de Cognito (`*.amazoncognito.com`) y CloudFront (`*.cloudfront.net`). Eliminar el OAuth client que usaba Cognito para el login con Google, que ya no existe.

### B7. Monitoreo
- Notificaciones de Coolify (email o Telegram) para deploy fallido y contenedor caído.
- Uptime: Uptime Kuma (servicio de un clic en Coolify) o UptimeRobot gratis → `https://api.topi.cash/health` (alertar si no responde o si `worker` = `stale`) y `https://www.topi.cash/healthz`.
- Límites de memoria por contenedor en Coolify (orientativos: api 256 MB, worker 384 MB, web 64 MB, db 512 MB).
- Ejecutar `backup-check.sh` una vez y anotar el resultado.

## Prohibido en producción
- **No** correr el E2E de Playwright contra producción: crea la contraseña de un usuario migrado real y deja datos de prueba.
- **No** exponer Postgres a internet. Para consultas manuales: `docker exec` en el servidor o túnel SSH.
- **No** reutilizar en producción los secretos de desarrollo (`infra/.env`).

## Criterios de aceptación
- [ ] Repo en GitHub sin secretos en el historial (gitleaks limpio); CI en verde.
- [ ] Los 4 recursos arriba en Coolify; deploy automático al hacer push a `main`, solo del servicio que cambió.
- [ ] Restore verificado en producción (8748 / 62 / 23) y migraciones en la versión 21.
- [ ] `smoke-prod.sh` pasa completo.
- [ ] Login de prueba manual con `cashflowapp2024@gmail.com` (crear contraseña → dashboard con datos) y acceso admin OK.
- [ ] Worker en etapa 2 con la conexión del equipo: crea transacciones reales del backfill; una segunda corrida no duplica.
- [ ] Backup diario configurado y **restaurado con éxito** con `backup-check.sh`.
- [ ] Alertas de uptime y de Coolify configuradas y probadas (apagar el worker → la alerta llega).
- [ ] Redirect URIs viejos eliminados de Google y Azure.
