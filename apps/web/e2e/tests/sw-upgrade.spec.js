// Escenario del corte: un usuario con la PWA vieja (service worker cache-first de index.html,
// caché `topi-pwa-cache-v1`) abre la app después del deploy del build nuevo en el mismo origen.
// Debe pasar sola a la versión nueva, sin recargar a mano y sin quedarse en blanco.
//
// OLD_BUILD_DIR: build del front con el service-worker.js del repo viejo (ver e2e/README.md).
// NEW_BUILD_DIR: build nuevo (por defecto apps/web/build, generado con `npm run build`).
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { startStaticServer } = require('../support/static-server');

const OLD_BUILD_DIR = process.env.OLD_BUILD_DIR && path.resolve(process.env.OLD_BUILD_DIR);
const NEW_BUILD_DIR = path.resolve(process.env.NEW_BUILD_DIR || path.join(__dirname, '..', '..', 'build'));
const PORT = Number(process.env.SW_TEST_PORT || 4180);

function mainBundle(dir) {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  return html.match(/\/static\/js\/main\.[0-9a-f]+\.js/)[0];
}

function buildId(dir) {
  return fs.readFileSync(path.join(dir, 'service-worker.js'), 'utf8').match(/BUILD_ID = '([^']+)'/)[1];
}

// Copia del build nuevo con otro BUILD_ID: simula el deploy siguiente (v2 → v2').
function nextDeploy(dir, out) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync(dir, out, { recursive: true });
  const sw = path.join(out, 'service-worker.js');
  fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace(/BUILD_ID = '[^']+'/, "BUILD_ID = 'next-deploy'"));
  return out;
}

// Durante una navegación el contexto se destruye: se devuelve null y expect.poll reintenta.
const safeEval = (page, fn) => page.evaluate(fn).catch(() => null);
const loadedBundle = page => safeEval(page, () =>
  [...document.scripts].map(s => new URL(s.src || location.href).pathname).find(p => p.startsWith('/static/js/main.')));
const rootChildren = page => safeEval(page, () => document.getElementById('root')?.childElementCount || 0);
const cacheNames = page => safeEval(page, () => caches.keys());

// Muestrea #root cada 100 ms: cuánto tiempo seguido estuvo vacío después de cargar.
async function watchBlank(page) {
  await page.addInitScript(() => {
    window.__blankSince = null;
    window.__maxBlankMs = 0;
    setInterval(() => {
      const root = document.getElementById('root');
      if (!root) return;
      if (root.childElementCount === 0) {
        window.__blankSince = window.__blankSince || Date.now();
        window.__maxBlankMs = Math.max(window.__maxBlankMs, Date.now() - window.__blankSince);
      } else {
        window.__blankSince = null;
      }
    }, 100);
  });
}

test.describe('service worker: actualización desde la PWA vieja', () => {
  test.skip(!OLD_BUILD_DIR, 'define OLD_BUILD_DIR (ver e2e/README.md)');
  test.use({ serviceWorkers: 'allow' });

  let server;
  test.beforeEach(async () => {
    server = await startStaticServer(OLD_BUILD_DIR, PORT);
  });
  test.afterEach(async () => {
    await server.close();
  });

  async function installOldPwa(page) {
    await page.goto(`${server.url}/login/`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    // segunda carga: el SW viejo ya controla la página y cachea index.html y los bundles
    await page.reload();
    await expect.poll(() => cacheNames(page)).toContain('topi-pwa-cache-v1');
    expect(await loadedBundle(page)).toBe(mainBundle(OLD_BUILD_DIR));
  }

  async function expectNewVersion(page, consoleErrors) {
    const newBundle = mainBundle(NEW_BUILD_DIR);
    // sin page.reload(): la app tiene que cambiar sola
    await expect.poll(() => loadedBundle(page), { timeout: 20_000 }).toBe(newBundle);
    await expect.poll(() => rootChildren(page)).toBeGreaterThan(0);
    await expect.poll(() => cacheNames(page)).toEqual([`topi-v2-${buildId(NEW_BUILD_DIR)}`]);
    expect(await page.evaluate(() => navigator.serviceWorker.controller.scriptURL)).toContain('/service-worker.js');
    // el build nuevo carga sin errores de consola
    const before = consoleErrors.length;
    await page.waitForTimeout(1000);
    expect(consoleErrors.slice(before)).toEqual([]);
  }

  test('con index.html y bundles viejos en caché', async ({ page }) => {
    await installOldPwa(page);

    server.setRoot(NEW_BUILD_DIR);
    const consoleErrors = [];
    const navigations = [];
    page.on('framenavigated', f => f === page.mainFrame() && navigations.push(f.url()));
    // el usuario vuelve a abrir la app: la sirve el SW viejo desde su caché
    await page.goto(`${server.url}/login/`);
    page.on('console', m => m.type() === 'error' && consoleErrors.push(m.text()));

    await expectNewVersion(page, consoleErrors);
    // goto + la navegación del SW nuevo; nada de bucles
    expect(navigations.length).toBeLessThanOrEqual(3);
  });

  test('con index.html viejo en caché y sus bundles ya borrados del servidor', async ({ page }) => {
    await watchBlank(page);
    await installOldPwa(page);
    // peor caso: la caché vieja tiene index.html pero no el bundle, que ya no existe en el servidor
    await page.evaluate(async () => {
      const cache = await caches.open('topi-pwa-cache-v1');
      for (const req of await cache.keys()) {
        if (new URL(req.url).pathname.startsWith('/static/')) await cache.delete(req);
      }
    });

    server.setRoot(NEW_BUILD_DIR);
    const consoleErrors = [];
    await page.goto(`${server.url}/login/`);
    page.on('console', m => m.type() === 'error' && consoleErrors.push(m.text()));

    await expectNewVersion(page, consoleErrors);
    // la pantalla vacía dura solo hasta que el SW nuevo recarga la ventana
    const maxBlankMs = await page.evaluate(() => window.__maxBlankMs);
    test.info().annotations.push({ type: 'maxBlankMs', description: String(maxBlankMs) });
    expect(maxBlankMs).toBeLessThan(5000);
  });

  test('deploy siguiente (v2 → v2): recarga una sola vez por controllerchange', async ({ page }, testInfo) => {
    server.setRoot(NEW_BUILD_DIR);
    await page.goto(`${server.url}/login/`);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.reload();
    await expect.poll(() => cacheNames(page)).toEqual([`topi-v2-${buildId(NEW_BUILD_DIR)}`]);

    const next = nextDeploy(NEW_BUILD_DIR, testInfo.outputPath('next-build'));
    server.setRoot(next);
    let loads = 0;
    page.on('load', () => { loads += 1; });
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));

    await expect.poll(() => cacheNames(page), { timeout: 20_000 }).toEqual(['topi-v2-next-deploy']);
    await page.waitForTimeout(1500);
    expect(loads).toBe(1);
    expect(await rootChildren(page)).toBeGreaterThan(0);
  });
});
