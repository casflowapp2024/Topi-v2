# E2E del front (Playwright)

Paquete aparte de `apps/web` para no meter Playwright en el lockfile ni en la imagen.

```bash
cd apps/web/e2e
npm ci
npx playwright install chromium
```

Proyectos: `desktop` (Desktop Chrome) y `mobile` (Pixel 7).

## Flujos de la app (`tests/flows.spec.js`, `signup.spec.js`, `token-refresh.spec.js`)

```bash
apps/web/e2e/scripts/run-local.sh            # todo: restore → compose up → flujos → flujo 7 → restore
```

- Usuarios: `global-setup.js` elige 2 migrados reales del dump (uno por proyecto) con historial y una
  cuenta ligada a un correo activo, y si ya tenían contraseña los devuelve a "crear contraseña"
  (`infra/scripts/reset-password.sh`). Se guardan en `.auth/` (fuera de git).
- `support/fixtures.js` (`guard`): cada test falla si hubo errores de consola, excepciones o respuestas
  4xx/5xx de la app o la API. Excepciones declaradas: el 403 del login de un migrado (flujo 1), el 404
  de `GET /user-extra` de un usuario recién registrado (flujo 8) y los 401 del token vencido (flujo 7).
- "Leer ahora" (flujo 5): Conexiones no tiene ese botón (solo el onboarding), así que se llama a
  `POST /email/read` con la sesión del navegador y se verifica el job en `email_jobs`. El worker local
  corre en dry run y sin conexiones: no se lee ningún correo.
- El flujo 7 necesita la API con `ACCESS_TOKEN_TTL` corto; lo hace `run-local.sh` (`E2E_TTL_SECONDS`, 20 por defecto).

## Service worker: actualización desde la PWA vieja (`tests/sw-upgrade.spec.js`)

Sirve dos builds en el mismo origen (`support/static-server.js` aplica las mismas reglas que
`nginx.conf`) y comprueba que un navegador con el SW viejo (`topi-pwa-cache-v1`) pasa solo al
build nuevo, sin recargar a mano y sin quedarse en blanco. No necesita el compose.

Build "viejo" = el front con el `service-worker.js` del repo viejo (`../cash-flow-front`, solo se lee):

```bash
OLD=$(mktemp -d)/old-web
git worktree add --detach "$OLD" 21e27ee      # último commit con el SW viejo
cp ../../../../cash-flow-front/public/service-worker.js "$OLD/apps/web/public/"
(cd "$OLD/apps/web" && npm ci && REACT_APP_API_URL=https://old-api.invalid/prod npx react-scripts build)
(cd .. && REACT_APP_API_URL=http://localhost:8080 npm run build)
OLD_BUILD_DIR="$OLD/apps/web/build" npx playwright test tests/sw-upgrade.spec.js
```

Sin `OLD_BUILD_DIR` estos tests se saltan.
