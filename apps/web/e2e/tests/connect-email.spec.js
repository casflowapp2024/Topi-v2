// Al iniciar sesión sin ninguna conexión de correo utilizable se lleva al usuario a conectar
// Gmail/Outlook y, al conectar, se pide "leer ahora" (POST /email/read). La API se simula con
// page.route (no necesita el compose) y el OAuth real se reemplaza por la página de retorno del
// popup (/glink-oauth-popup-success?code=...), que es la que le pasa el code a la app.
//
//   (cd .. && npm run build)        # REACT_APP_API_URL=http://localhost:8080 (por defecto en .env)
//   E2E_SKIP_USERS=1 npx playwright test tests/connect-email.spec.js
const path = require('path');
const { test, expect, API_URL } = require('../support/fixtures');
const { startStaticServer } = require('../support/static-server');

const BUILD_DIR = path.resolve(process.env.NEW_BUILD_DIR || path.join(__dirname, '..', '..', 'build'));
const PORT = Number(process.env.CONNECT_EMAIL_TEST_PORT || 4181);

const meta = (total = 0) => ({ total, skip: 0, limit: 20 });
const ok = data => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'Success', data }) });

const ACCOUNT = {
  id: 7,
  name: 'Ahorros',
  last_four_digits: '1234',
  initial_balance: 1000,
  bank: { id: 3, name: 'bancolombia' },
  type: { id: 1, type: 'Ahorros' },
  email: { id: null, email: '', provider: '', active: false, error: null },
  automation: { configured: false },
};

/**
 * API simulada. `state.emails` es lo que devuelve /email/list; el register agrega el correo nuevo.
 * Devuelve las peticiones hechas para verificarlas.
 */
async function mockApi(page, { onboardingCompleted, emails = [], accounts = [ACCOUNT] }) {
  const state = { emails: [...emails], accounts: accounts.map(a => ({ ...a })) };
  const calls = [];
  await page.route(`${API_URL}/**`, async route => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/\/+$/, '');
    const method = req.method();
    calls.push({ method, path: p, query: url.search, body: req.postData() });

    if (method === 'OPTIONS') return route.fulfill({ status: 204 });
    if (p === '/users') return route.fulfill(ok({ name: 'Ana', last_name: 'Prueba', email: 'ana@example.com', verified: true }));
    if (p === '/user-extra') {
      return route.fulfill(ok({
        user_id: 'u-1', utc_offset: -5, whatsapp: '', onboarding_completed: onboardingCompleted,
        birthday: '', local_currency: 'COP', language: 'es', read_email: false, config: { dark_mode: false },
      }));
    }
    if (p === '/email/list') return route.fulfill(ok({ emails: state.emails, meta: meta(state.emails.length) }));
    if (p === '/email/auth-url') {
      // en vez de Google: la página de retorno del popup con un code de prueba
      return route.fulfill(ok({ url: `${server.url}/glink-oauth-popup-success?code=fake-code` }));
    }
    if (p === '/email/register' && method === 'POST') {
      const body = JSON.parse(req.postData());
      state.emails.push({ id: 42, email: body.email, provider: body.provider, active: true, error: null });
      return route.fulfill(ok(null));
    }
    if (p.startsWith('/email/') && method === 'DELETE') {
      const id = Number(p.split('/').pop());
      state.emails = state.emails.filter(e => e.id !== id);
      state.accounts.forEach(a => { if (a.email.id === id) a.email = { ...ACCOUNT.email }; });
      return route.fulfill(ok(null));
    }
    if (p === '/email/read' && method === 'POST') return route.fulfill(ok({ reads: [] }));
    if (p === '/accounts/list') return route.fulfill(ok({ accounts: state.accounts, meta: meta(state.accounts.length) }));
    if (p.startsWith('/accounts/') && method === 'PUT') {
      const id = Number(p.split('/').pop());
      const body = JSON.parse(req.postData());
      const email = state.emails.find(e => e.id === body.email_id);
      state.accounts.forEach(a => { if (a.id === id && email) a.email = { ...email }; });
      return route.fulfill(ok({}));
    }
    if (p === '/transactions/list') return route.fulfill(ok({ transactions: [], meta: { ...meta(), news: 0, read_email_onboarding: false } }));
    if (p === '/categories/list') return route.fulfill(ok({ categories: [], meta: meta() }));
    if (p === '/banks/list' || p === '/banks/official') return route.fulfill(ok({ banks: [], meta: meta() }));
    if (p === '/account-types/list') return route.fulfill(ok({ account_types: [], meta: meta() }));
    // reportes del dashboard: vacíos
    if (p === '/analysis/financial-analysis') {
      return route.fulfill(ok({
        daily: { date: [], expense: [], mtd_expense: [], income: [], mtd_income: [], mtd_savings: [], running_savings_balance: [] },
        monthly: { month: [], expense: [], expense_diff: [], income: [], savings: [], savings_diff: [], running_savings_balance: [] },
        expense_budget: 0, income_budget: 0, savings_budget: 0,
      }));
    }
    if (p === '/analysis/accounts-balance') return route.fulfill(ok({ balance_by_account: [] }));
    return route.fulfill(ok({}));
  });
  return { calls, state };
}

// Para afirmar que NO hubo redirección: esperar a que la app tenga los correos y darle margen.
async function settleAfterEmailList(page, load) {
  const emailList = page.waitForResponse(r => r.url().startsWith(`${API_URL}/email/list`));
  await load();
  await emailList;
  await page.waitForTimeout(1500);
}

let server;
test.beforeAll(async () => { server = await startStaticServer(BUILD_DIR, PORT); });
test.afterAll(async () => { await server.close(); });

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fake-access-token');
    localStorage.setItem('refresh', 'fake-refresh-token');
  });
});

test('sin conexión: lleva a conectar el correo y, al conectar, pide "leer ahora"', async ({ page }) => {
  const { calls } = await mockApi(page, { onboardingCompleted: true });

  await page.goto(`${server.url}/dashboard`);
  await page.waitForURL('**/dashboard/connect-email');
  await expect(page.getByRole('heading', { name: 'Conecta tu correo' })).toBeVisible();

  await page.fill('#emailAutomated', 'ana.banco@gmail.com');
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  await (await popup).waitForEvent('close');

  await expect(page.getByText('¡Correo conectado!')).toBeVisible();
  await expect(page.getByText('Estamos leyendo tus últimas transacciones')).toBeVisible();

  const register = calls.find(c => c.path === '/email/register');
  expect(register.query).toBe('?code=fake-code');
  expect(JSON.parse(register.body)).toEqual({ email: 'ana.banco@gmail.com', provider: 'gmail' });

  // la cuenta sin correo queda ligada al correo nuevo y se lee ya
  const put = calls.find(c => c.method === 'PUT' && c.path === '/accounts/7');
  expect(JSON.parse(put.body).email_id).toBe(42);
  const read = calls.filter(c => c.path === '/email/read');
  expect(read).toHaveLength(1);
  expect(JSON.parse(read[0].body)).toEqual({ account_ids: [7] });
});

test('sin conexión: "Hacerlo más tarde" vuelve al inicio y no insiste en la siguiente carga', async ({ page }) => {
  await mockApi(page, { onboardingCompleted: true });

  await page.goto(`${server.url}/dashboard`);
  await page.waitForURL('**/dashboard/connect-email');
  await page.getByRole('button', { name: 'Hacerlo más tarde' }).click();
  await page.waitForURL(/\/dashboard$/);

  // nueva sesión del navegador (sessionStorage limpio) dentro de las 24 h
  await page.evaluate(() => sessionStorage.clear());
  await settleAfterEmailList(page, () => page.reload());
  expect(new URL(page.url()).pathname).toBe('/dashboard');
});

test('conexión en error: ofrece reconectar con el mismo correo', async ({ page }) => {
  const broken = { id: 9, email: 'ana.banco@gmail.com', provider: 'gmail', active: true, error: 'token_expired_or_revoked' };
  const { calls } = await mockApi(page, {
    onboardingCompleted: true,
    emails: [broken],
    accounts: [{ ...ACCOUNT, email: { ...broken } }],
  });

  await page.goto(`${server.url}/dashboard`);
  await page.waitForURL('**/dashboard/connect-email');
  await expect(page.getByRole('heading', { name: 'Reconecta tu correo' })).toBeVisible();
  await page.getByRole('button', { name: 'Reconectar' }).click();

  await expect(page.locator('#emailAutomated')).toHaveValue('ana.banco@gmail.com');
  expect(calls.some(c => c.method === 'DELETE' && c.path === '/email/9')).toBe(true);
});

test('con una conexión activa no redirige', async ({ page }) => {
  const active = { id: 5, email: 'ana.banco@gmail.com', provider: 'gmail', active: true, error: null };
  const { calls } = await mockApi(page, {
    onboardingCompleted: true,
    emails: [active],
    accounts: [{ ...ACCOUNT, email: { ...active } }],
  });

  await settleAfterEmailList(page, () => page.goto(`${server.url}/dashboard`));
  expect(new URL(page.url()).pathname).toBe('/dashboard');
  expect(calls.some(c => c.path === '/email/read')).toBe(false);
});

test('onboarding pendiente y sin correos: abre el onboarding en "Conecta tu email"', async ({ page }) => {
  await mockApi(page, { onboardingCompleted: false, accounts: [] });

  await page.goto(`${server.url}/dashboard`);
  await expect(page.getByRole('heading', { name: 'Conecta tu email a Topi' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/dashboard');
});
