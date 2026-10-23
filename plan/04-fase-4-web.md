# Fase 4: frontend listo para producción (sin n8n ni chatbot)

## Decisiones (21-oct)
- **Fuera del alcance:** n8n y el chatbot del front. Se eliminan del repo (el dueño tiene otros planes; el código viejo sigue en `cash-flow-front`).
- Se mantiene CRA (`react-scripts`). Migrar a Vite **no** entra en esta fase.
- Dominios previstos: web `https://www.topi.cash` (con `topi.cash` → redirección a `www`), API `https://api.topi.cash`.

## Hallazgos
1. **Service worker peligroso para el corte.** `public/service-worker.js` es *cache-first* para `/` e `/index.html` con un nombre de caché fijo (`topi-pwa-cache-v1`).
   Los usuarios que instalaron la PWA seguirían viendo el `index.html` viejo, que apunta a bundles que ya no existen en el servidor nuevo y a la URL vieja de API Gateway.
   Resultado: **pantalla en blanco** hasta que el SW se actualice. Se resuelve en esta fase (ver abajo).
2. `public/headers.json` y `public/static.json` son configuraciones de otros hostings (Vercel/Heroku). Con Coolify/nginx no aplican.
   Además, ponen `Cross-Origin-Embedder-Policy: require-corp`, que nada en el código necesita (no se usa `SharedArrayBuffer`) y puede bloquear recursos de terceros (Google Analytics, imágenes). **Se eliminan.**
3. El chatbot está montado en `src/hocs/Layout.js` (import y `<Chatbot />`, también el disparador del navbar móvil) y en `REACT_APP_N8N_CHAT_BOT_WEBHOOK_URL`.
4. `src/components/zobs/` (184 KB) es código muerto, **salvo** `DropDownAccounts.js`, `DropDownPeriod.js` y `SummaryCategories.js`, que se importan desde fuera.
5. Las variables `REACT_APP_*` se **hornean en el build**: en producción, `REACT_APP_API_URL` tiene que llegar como build arg.

## Tareas
### A. Limpieza
- Borrar `src/components/chatbot/`, su uso en `Layout.js`, `assets/chatbot/`, la variable N8N de `.env.example` e `infra/n8n/`.
- Mover los 3 componentes usados de `zobs/` a su carpeta lógica, actualizar imports y borrar `zobs/`. También `public/headers.json`, `public/static.json`, `gemini.md` (pasar a `CLAUDE.md` lo que valga la pena) y los archivos `* copy.js` sin uso.
- `npm run build` sin errores. Las advertencias de ESLint por imports sin uso que deje la limpieza se corrigen.

### B. Service worker seguro (crítico)
- Nuevo `service-worker.js`:
  - Navegaciones (`request.mode === 'navigate'`) → **network-first**, con caché solo como respaldo offline.
  - `/static/*` (con hash en el nombre) → cache-first.
  - Las llamadas a la API **nunca** pasan por la caché.
  - Nombre de caché versionado (p. ej. `topi-v2-<fecha de build>`); en `activate` se borran todas las cachés que no sean la actual, incluida `topi-pwa-cache-v1`.
  - `skipWaiting()` + `clients.claim()`.
- En `index.js`: al detectar `controllerchange`, recargar la página una sola vez. Así los usuarios con la PWA vieja pasan a la versión nueva sin intervención.
- nginx sirve `service-worker.js`, `index.html` y `manifest.json` con `Cache-Control: no-cache`.
- Probar el escenario: registrar el SW viejo (copiado del repo viejo) en el navegador, servir el build nuevo y verificar que la app se actualiza sola, sin pantalla en blanco.

### C. Imagen de producción
- `apps/web/Dockerfile` multi-stage: `node:20-alpine` (`npm ci`, `npm run build` con `ARG REACT_APP_API_URL`, `ARG REACT_APP_GA_TRACKING_ID`) → `nginx:alpine`, usuario no root, `EXPOSE 8080`.
- `apps/web/nginx.conf`:
  - Fallback SPA a `/index.html`.
  - `/static/` con `Cache-Control: public, max-age=31536000, immutable`; `index.html`, `service-worker.js` y `manifest.json` con `no-cache`.
  - gzip.
  - Headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` mínima.
  - Sin COEP/COOP.
  - `/healthz` → 200.
- `.dockerignore` (node_modules, build, .env).
- Servicio `web` en `infra/docker-compose.yml` (puerto 3000 → 8080) construido con `REACT_APP_API_URL=http://localhost:8080`. La API local debe tener `HTTP_ALLOWED_ORIGINS` con `http://localhost:3000`.

### D. Configuración y URLs
- `.env.example` del web: solo `REACT_APP_API_URL` y `REACT_APP_GA_TRACKING_ID` (opcional: si está vacío, no se carga Google Analytics).
- `grep` de URLs hardcodeadas (`execute-api`, `cloudfront`, `amazonaws`, `/prod`, `localhost`) en `src/` → ninguna.
- La API en producción: `HTTP_ALLOWED_ORIGINS=https://www.topi.cash,https://topi.cash`. Documentarlo en `apps/api/.env.example`.
- Reconexión de Gmail/Outlook: la ruta `/gmail-auth-connect/` del front y `GMAIL_REDIRECT_URIS`/`OUTLOOK_REDIRECT_URL` de la API apuntan a `https://www.topi.cash/gmail-auth-connect` (sin cambios respecto a producción). Documentar en el README que en local hay que agregar `http://localhost:3000/gmail-auth-connect` como redirect URI en Google Cloud y Azure si se quiere probar la reconexión.

### E. Prueba end-to-end (Playwright)
- `apps/web/e2e/` con Playwright contra el compose local (postgres restaurado + api + worker + web), con viewport de escritorio y de móvil:
  1. Usuario migrado real del dump: login → aviso de migración → crea contraseña → entra.
  2. Dashboard: las 3 pestañas (general, presupuestos/categorías, cuentas) cargan datos sin errores de consola ni respuestas 4xx/5xx.
  3. Transacciones: listar, crear, editar y borrar una de prueba.
  4. Cuentas y categorías: crear y borrar una de prueba.
  5. Conexiones: la página carga, se ve el estado de los correos y "leer ahora" responde OK (el job queda en `email_jobs`).
  6. Ajustes: cambiar contraseña → logout → login con la nueva.
  7. Token vencido: con `ACCESS_TOKEN_TTL` corto, la sesión se renueva sola con el refresh token.
  8. Usuario nuevo: signup → onboarding → dashboard vacío sin errores.
- Después de correrla, restaurar la base (`restore.sh`) para no dejar datos de prueba.

## Criterios de aceptación
- [x] `grep -rniE "n8n|chatbot|zobs" apps/web/src infra` vacío; `infra/n8n/` eliminado.
- [x] `npm run build` sin errores; `docker build` de `apps/web` OK; la imagen pesa menos de 50 MB.
- [x] `docker compose up` levanta postgres + api + worker + web; `http://localhost:3000` funciona y un refresh en una ruta interna (p. ej. `/dashboard`) no da 404.
- [x] Headers verificados con `curl -I` (caché de `/static`, `no-cache` en `index.html`/SW, sin COEP).
- [x] Escenario del SW viejo → la app se actualiza sola, sin pantalla en blanco.
- [x] Los 8 flujos E2E pasan en escritorio y móvil, sin errores de consola.
- [x] Ninguna URL de AWS o `/prod` en el código del front.

## Resultado (22-oct)
- Imagen `nginxinc/nginx-unprivileged:alpine-slim` (22 MB, usuario 101, :8080). `npm ci --legacy-peer-deps`
  por un conflicto de peers previo (`@testing-library/react@13` pide react 18; la app usa 19).
- SW: además de lo pedido, si encuentra `topi-pwa-cache-v1` recarga las ventanas abiertas con
  `client.navigate()` (sin `await` dentro de `waitUntil`: esperarla bloquea la activación). El JS de la PWA
  vieja no escucha `controllerchange`. Probado con el SW real del repo viejo (`e2e/tests/sw-upgrade.spec.js`).
- E2E: `apps/web/e2e/scripts/run-local.sh` (restore → compose → flujos → flujo 7 con TTL de 20 s → restore).
  Excepciones declaradas al "sin errores": 403 del login de un migrado (contrato), 404 de `GET /user-extra`
  del usuario recién registrado (el front lo crea) y los 401 del token vencido (flujo 7).
  Flujo 5: Conexiones no tiene botón "leer ahora" (solo el onboarding); se llama `POST /email/read` con la
  sesión del navegador y se verifica el job en `email_jobs`. Los flujos 2–6 reutilizan la sesión del 1
  (la API limita los logins a 10/min por IP).
- Bugs reales encontrados por el E2E y corregidos (con OK):
  1. API: `GET/PUT/DELETE /transactions/:id` → 500 desde la migración 000020 (`t.*` en `GetTransactionByID`).
  2. API + web: banco preseleccionado al azar al crear una cuenta → 409 intermitente (`/banks/official`
     sin orden + `AccountCreate` fijaba el banco al montar).
  3. Web: la landing llamaba `GET /users/` con `Bearer null` en cada visita anónima (401).
- Pendiente aparte: `onboarding2/StepCreateAccount.js` también preselecciona `banks[0]` (con el orden
  estable de la API ya es determinista).
