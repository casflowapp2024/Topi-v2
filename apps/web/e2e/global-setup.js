// Elige 2 usuarios migrados reales del dump (desktop y mobile) con historial y una cuenta ligada a
// un correo activo (para que "leer ahora" encole un job). Si una corrida anterior ya les creó
// contraseña, los devuelve a "crear contraseña" con infra/scripts/reset-password.sh.
const { execFileSync } = require('child_process');
const path = require('path');
const { query } = require('./support/db');
const { USERS_FILE, writeJson } = require('./support/users');

const RESET_SCRIPT = path.resolve(__dirname, '..', '..', '..', 'infra', 'scripts', 'reset-password.sh');

module.exports = async () => {
  if (process.env.E2E_SKIP_USERS === '1') return;
  const rows = query(`
    SELECT u.id, u.email, u.password_hash IS NOT NULL
    FROM users u
    WHERE u.migrated
      AND (SELECT count(*) FROM transactions t WHERE t.user_id = u.id) >= 20
      AND EXISTS (
        SELECT 1 FROM accounts a
        JOIN emails e ON e.id = a.email_id AND e.user_id = a.user_id AND e.active
        JOIN banks b ON b.id = a.bank_id AND coalesce(b.email, '') <> ''
        WHERE a.user_id = u.id)
    ORDER BY u.id
    LIMIT 2;`);
  if (rows.length < 2) {
    throw new Error('No hay 2 usuarios migrados con historial y cuenta ligada a un correo activo: ¿restore.sh?');
  }
  for (const [, email, hasPassword] of rows) {
    if (hasPassword === 't') execFileSync('bash', [RESET_SCRIPT, email], { stdio: 'ignore' });
  }
  const [desktop, mobile] = rows.map(([id, email]) => ({ id, email }));
  writeJson(USERS_FILE, { desktop, mobile });
};
