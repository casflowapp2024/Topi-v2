// Flujo 8: usuario nuevo → signup → onboarding → dashboard vacío sin errores.
const { test, expect } = require('../support/fixtures');

test('8. usuario nuevo: signup → onboarding → dashboard vacío', async ({ page, guard }, testInfo) => {
  // contrato front/API: un usuario recién registrado no tiene user_extra; GET /user-extra responde
  // 404 y hocs/Layout.js lo crea (add_user_extra_data). Solo se acepta aquí.
  guard.allow(404, '/user-extra');
  const email = `e2e-${testInfo.project.name}-${Date.now()}@topi.test`;
  const password = 'E2e-Nuevo-2026!';

  await page.goto('/create_account/');
  await page.fill('#name', 'E2E');
  await page.fill('#lastName', 'Nuevo');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.fill('#confirmPassword', password);
  await page.getByRole('button', { name: 'Crea tu cuenta' }).click();
  await page.waitForURL('**/dashboard');

  // onboarding: objetivo → el paso de correo (OAuth real) se deja para después
  const onboarding = page.getByRole('dialog');
  await expect(onboarding.getByText('Bienvenido a Topi!').first()).toBeVisible();
  await onboarding.getByText('Organizar gastos').click();
  await expect(onboarding.getByText('Conecta tu email a Topi').first()).toBeVisible();
  await onboarding.getByText('Hacerlo más tarde').click();
  await expect(onboarding).toBeHidden();

  // dashboard vacío
  await expect(page.getByRole('heading', { name: 'Tu Balance' }).first()).toBeVisible();
  await page.waitForLoadState('networkidle');
});
