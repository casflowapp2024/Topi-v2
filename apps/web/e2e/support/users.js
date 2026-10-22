// Usuarios de prueba: migrados reales del dump (sin contraseña) con una cuenta ligada a un correo
// activo, para que "leer ahora" encole un job. Se eligen en global-setup y se guardan en .auth/
// (fuera de git). Cada proyecto (desktop/mobile) usa uno distinto: crear la contraseña es de una vez.
const fs = require('fs');
const path = require('path');

const AUTH_DIR = path.join(__dirname, '..', '.auth');
const USERS_FILE = path.join(AUTH_DIR, 'users.json');

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, data) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

const migratedUser = project => readJson(USERS_FILE)[project];

// Credenciales vigentes del usuario migrado tras los flujos (las usa el flujo 7, en otra corrida)
const credsFile = project => path.join(AUTH_DIR, `creds-${project}.json`);
const saveCreds = (project, creds) => writeJson(credsFile(project), creds);
const loadCreds = project => (fs.existsSync(credsFile(project)) ? readJson(credsFile(project)) : null);

module.exports = { AUTH_DIR, USERS_FILE, writeJson, migratedUser, saveCreds, loadCreds };
