// Flujo 7: con ACCESS_TOKEN_TTL corto, la sesión se renueva sola con el refresh token.
// Corre aparte (scripts/run-local.sh): la API se reinicia con E2E_TTL_SECONDS de TTL y este spec
// usa las credenciales que dejaron los flujos 1–6 (.auth/creds-<proyecto>.json).
const { test, expect, API_URL } = require('../support/fixtures');
const { loadCreds } = require('../support/users');

const TTL_SECONDS = Number(process.env.E2E_TTL_SECONDS || 0);

test.skip(!TTL_SECONDS, 'solo con la API en TTL corto (E2E_TTL_SECONDS, ver scripts/run-local.sh)');

test('7. token vencido: la sesión se renueva sola', async ({ page, guard }, testInfo) => {
  test.setTimeout((TTL_SECONDS + 60) * 1000);
  const creds = loadCreds(testInfo.project.name);
  expect(creds, 'corre antes los flujos 1–6').toBeTruthy();
  // el access token vencido da 401 una vez por petición; el interceptor renueva y reintenta
  guard.allow(401, `${API_URL}/`);

  await page.goto('/login/');
  await page.fill('#email', creds.email);
  await page.fill('#password', creds.password);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await page.waitForURL('**/dashboard');
  const firstToken = await page.evaluate(() => localStorage.getItem('token'));

  await page.waitForTimeout((TTL_SECONDS + 3) * 1000);

  const refresh = page.waitForResponse(r => r.url().startsWith(`${API_URL}/users/refresh`));
  await page.locator('a[href="/dashboard/transactions"]:visible').first().click();
  expect((await refresh).status()).toBe(200);

  // sigue dentro, con datos y con un token nuevo
  await page.waitForURL('**/dashboard/transactions');
  await expect(page.locator('li.cursor-pointer').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(page.url()).not.toContain('/login');
  expect(await page.evaluate(() => localStorage.getItem('token'))).not.toBe(firstToken);
});
