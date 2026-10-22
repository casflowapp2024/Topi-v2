# E2E del front (Playwright)

Paquete aparte de `apps/web` para no meter Playwright en el lockfile ni en la imagen.

```bash
cd apps/web/e2e
npm ci
npx playwright install chromium
```

Proyectos: `desktop` (Desktop Chrome) y `mobile` (Pixel 7).

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
