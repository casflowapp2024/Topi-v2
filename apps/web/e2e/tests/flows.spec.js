// Flujos 1–6 con un usuario migrado real del dump (uno por proyecto, ver global-setup.js).
// En serie: el flujo 1 crea la contraseña que usan los siguientes y el 6 la cambia.
const { test, expect, API_URL } = require('../support/fixtures');
const { query } = require('../support/db');
const { migratedUser, saveCreds } = require('../support/users');

test.describe.configure({ mode: 'serial' });

const stamp = () => `${Date.now()}`.slice(-7);
const NEW_PASSWORD = 'E2e-Topi-2026!';
const CHANGED_PASSWORD = 'E2e-Topi-2026!b';

// Un enlace de navegación visible (el escritorio y el móvil tienen menús distintos)
const navLink = (page, href) => page.locator(`a[href="${href}"]:visible`).first();

async function login(page, email, password) {
  await page.goto('/login/');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('heading', { name: 'Tu Balance' }).first()).toBeVisible();
}

// La API limita los logins a 10/min por IP (RATE_LIMIT_PER_MIN): los flujos 2–6 siguen con la
// sesión que abrió el flujo 1 (los tokens en localStorage, como un usuario que vuelve a la app).
// Las alertas de éxito de la app son transitorias: se verifica la respuesta de la API.
const apiCall = (page, method, pattern) =>
  page.waitForResponse(r => r.request().method() === method && pattern.test(new URL(r.url()).pathname));

async function resume(page, session) {
  await page.goto('/login/');
  await page.evaluate(s => {
    localStorage.setItem('token', s.token);
    localStorage.setItem('refresh_token', s.refresh_token);
  }, session);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Tu Balance' }).first()).toBeVisible();
}

test.describe('usuario migrado', () => {
  let user;
  let password;
  let session;

  test.beforeAll(({}, testInfo) => {
    user = migratedUser(testInfo.project.name);
  });

  test('1. login → aviso de migración → crea contraseña → entra', async ({ page, guard }) => {
    // contrato de la API: el login de una cuenta sin contraseña responde 403 "user needs to reset the password"
    guard.allow(403, '/users/login');
    await page.goto('/login/');
    await page.fill('#email', user.email);
    await page.fill('#password', 'no-la-tiene-1A!');
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

    await expect(page.getByText('Actualizamos Topi.')).toBeVisible();
    await expect(page.locator('#migration-email')).toHaveValue(user.email);
    await page.fill('#new-password', NEW_PASSWORD);
    await page.fill('#confirm-new-password', NEW_PASSWORD);
    await page.getByRole('button', { name: 'Crear contraseña y entrar' }).click();

    await page.waitForURL('**/dashboard');
    await expect(page.getByRole('heading', { name: 'Tu Balance' }).first()).toBeVisible();
    password = NEW_PASSWORD;
    saveCreds(test.info().project.name, { email: user.email, password });
    session = await page.evaluate(() => ({
      token: localStorage.getItem('token'),
      refresh_token: localStorage.getItem('refresh_token'),
    }));
  });

  test('2. dashboard: general, presupuestos y cuentas cargan datos', async ({ page }) => {
    await resume(page, session);
    await expect(page.getByRole('heading', { name: 'Últimas Transacciones' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    await navLink(page, '/dashboard/budgets').click();
    await page.waitForURL('**/dashboard/budgets');
    await expect(page.getByRole('button', { name: 'Agregar Presupuesto' }).first()).toBeVisible();
    await page.waitForLoadState('networkidle');

    await navLink(page, '/dashboard/accounts').click();
    await page.waitForURL('**/dashboard/accounts');
    await expect(page.getByRole('heading', { name: 'Mis Cuentas' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Resumen de la cuenta' }).first()).toBeVisible();
    await page.waitForLoadState('networkidle');
  });

  test('3. transacciones: listar, crear, editar y borrar', async ({ page }) => {
    const description = `E2E trx ${stamp()}`;
    const edited = `${description} editada`;
    await resume(page, session);
    await navLink(page, '/dashboard/transactions').click();
    await page.waitForURL('**/dashboard/transactions');
    await expect(page.getByRole('textbox', { name: 'Buscar por Descripción' })).toBeVisible();
    // listar: el usuario migrado tiene historial
    await expect(page.locator('li.cursor-pointer').first()).toBeVisible();

    // crear
    await page.getByRole('button', { name: 'Crear', exact: true }).click();
    const createDialog = page.getByRole('dialog');
    await createDialog.locator('#description').fill(description);
    await createDialog.locator('label[for="amount"] + div input').first().fill('12345');
    const txCreated = apiCall(page, 'POST', /^\/transactions\/create/);
    await createDialog.getByRole('button', { name: 'Crear', exact: true }).click();
    expect((await txCreated).ok()).toBeTruthy();
    await createDialog.getByRole('button', { name: 'Cerrar modal' }).click();

    // editar
    const row = page.locator('li.cursor-pointer', { hasText: description });
    await row.first().click();
    const detail = page.getByRole('dialog');
    await detail.getByRole('button', { name: 'Editar' }).click();
    await detail.locator('#description').fill(edited);
    // la alerta de éxito es transitoria: se verifica la respuesta de la API y la lista
    const updated = page.waitForResponse(r => /\/transactions\/\d+$/.test(r.url()) && r.request().method() === 'PUT');
    await detail.getByRole('button', { name: 'Actualizar' }).click();
    expect((await updated).status()).toBe(200);
    await detail.getByRole('button', { name: 'Cerrar modal' }).first().click();
    await expect(page.locator('li.cursor-pointer', { hasText: edited }).first()).toBeVisible();

    // borrar
    await page.locator('li.cursor-pointer', { hasText: edited }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
    const txDeleted = apiCall(page, 'DELETE', /^\/transactions\/\d+$/);
    await page.getByRole('dialog').getByRole('button', { name: 'Si, Eliminar!' }).click();
    expect((await txDeleted).status()).toBe(200);
    await expect(page.locator('li.cursor-pointer', { hasText: edited })).toHaveCount(0);
  });

  test('4. cuentas y categorías: crear y borrar', async ({ page }) => {
    const accountName = `E2E cuenta ${stamp()}`;
    const categoryName = `E2E cat ${stamp()}`;
    await resume(page, session);

    // cuenta
    await page.goto('/accounts/');
    await page.getByRole('button', { name: 'Adicionar Producto' }).click();
    const accDialog = page.getByRole('dialog');
    await accDialog.locator('#name').fill(accountName);
    await accDialog.locator('#lastFourDigits').fill('9876');
    // toggle "Lectura automatizada": el checkbox es sr-only, se pulsa su label
    await accDialog.locator('label:has(#automated)').click();
    await expect(accDialog.locator('#automated')).not.toBeChecked();
    const accCreated = apiCall(page, 'POST', /^\/accounts\/create/);
    await accDialog.getByRole('button', { name: 'Crear', exact: true }).click();
    expect((await accCreated).ok()).toBeTruthy();
    await page.keyboard.press('Escape');

    await page.getByText(accountName, { exact: false }).first().click();
    const accDetail = page.getByRole('dialog');
    await accDetail.getByRole('button', { name: 'Eliminar' }).click();
    const accDeleted = apiCall(page, 'DELETE', /^\/accounts\/\d+$/);
    await accDetail.getByRole('button', { name: /Si, (Eliminar|Desvincular)!/ }).click();
    expect((await accDeleted).status()).toBe(200);
    await page.goto('/accounts/');
    await expect(page.getByRole('heading', { name: 'Cuentas y Productos' })).toBeVisible();
    await expect(page.getByText(accountName)).toHaveCount(0);

    // categoría
    await page.goto('/plan/');
    await page.getByRole('button', { name: 'Crear Categoria' }).click();
    const catDialog = page.getByRole('dialog', { name: 'Crear Categoría' });
    await catDialog.getByRole('textbox', { name: 'Categoría' }).fill(categoryName);
    await catDialog.getByRole('textbox', { name: 'Presupuesto Mensual' }).fill('50000');
    await catDialog.getByRole('button', { name: 'Crear', exact: true }).click();
    await page.keyboard.press('Escape');
    const catHeading = page.getByRole('heading', { name: categoryName, exact: false });
    await expect(catHeading.first()).toBeVisible();

    await catHeading.first().click();
    const catDetail = page.getByRole('dialog');
    await catDetail.getByRole('button', { name: 'Eliminar' }).click();
    const catDeleted = apiCall(page, 'DELETE', /^\/categories\/\d+$/);
    await catDetail.getByRole('button', { name: 'Si, Eliminar!' }).click();
    expect((await catDeleted).status()).toBe(200);
    await page.goto('/plan/');
    await expect(page.getByRole('button', { name: 'Crear Categoria' })).toBeVisible();
    await expect(page.getByRole('heading', { name: categoryName })).toHaveCount(0);
  });

  test('5. conexiones: estado de los correos y "leer ahora" encola un job', async ({ page }) => {
    const connected = query(
      `SELECT email FROM emails WHERE user_id = :'uid' AND active ORDER BY id;`, { uid: user.id }).map(r => r[0]);
    await resume(page, session);

    await page.goto('/settings/connections');
    await expect(page.getByRole('heading', { name: 'Emails Vinculados' })).toBeVisible();
    for (const email of connected) {
      await expect(page.getByText(email, { exact: false }).first()).toBeVisible();
    }

    // "leer ahora" no tiene botón en Conexiones (solo en el onboarding): se llama a la API con la
    // sesión del navegador, como lo haría el front.
    const [[since]] = query('SELECT now();');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const headers = { Authorization: `Bearer ${token}` };
    const accounts = await page.request.get(`${API_URL}/accounts/list?skip=0&limit=50`, { headers });
    expect(accounts.ok()).toBeTruthy();
    const items = (await accounts.json()).data.accounts || [];
    const linked = items.filter(a => a.email_id || (a.email && a.email.id)).map(a => a.id);
    expect(linked.length).toBeGreaterThan(0);

    const read = await page.request.post(`${API_URL}/email/read`, { headers, data: { account_ids: linked } });
    expect(read.status()).toBe(200);

    const jobs = query(
      `SELECT id, status FROM email_jobs
       WHERE payload->>'user_id' = :'uid' AND priority = 1 AND updated_at >= :'since';`,
      { uid: user.id, since });
    expect(jobs.length).toBeGreaterThan(0);
  });

  test('6. ajustes: cambiar contraseña → logout → login con la nueva', async ({ page }) => {
    const [[name]] = query(`SELECT name FROM users WHERE id = :'uid';`, { uid: user.id });
    await resume(page, session);
    // como un usuario: botón con su nombre en la barra superior → modal de ajustes (perfil).
    // "Cerrar sesión" solo existe en el pie de ese modal, no en la ruta /settings/profile.
    await page.getByRole('button', { name: name || 'Usuario', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Cambiar contraseña' })).toBeVisible();
    await page.getByPlaceholder('Contraseña actual').fill(password);
    await page.getByPlaceholder('Nueva contraseña', { exact: true }).fill(CHANGED_PASSWORD);
    await page.getByPlaceholder('Confirma la nueva contraseña').fill(CHANGED_PASSWORD);
    // la alerta de éxito dura 3 s: se verifica la respuesta de la API
    const changed = page.waitForResponse(r => r.url().includes('/users/password') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
    expect((await changed).status()).toBe(200);
    password = CHANGED_PASSWORD;
    saveCreds(test.info().project.name, { email: user.email, password });

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.waitForURL(url => !url.pathname.startsWith('/dashboard') && !url.pathname.startsWith('/settings'));

    await login(page, user.email, CHANGED_PASSWORD);
  });
});
