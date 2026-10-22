// psql dentro del contenedor postgres del compose local (solo hace falta Docker).
const { execFileSync } = require('child_process');
const path = require('path');

const COMPOSE_FILE = path.resolve(__dirname, '..', '..', '..', '..', 'infra', 'docker-compose.yml');

function compose(args, input) {
  return execFileSync('docker', ['compose', '-f', COMPOSE_FILE, ...args], {
    input,
    encoding: 'utf8',
    env: { ...process.env, MSYS_NO_PATHCONV: '1' },
  });
}

// Filas como arrays de strings (separador |). Los valores van como variables psql (:'nombre').
function query(sql, vars = {}) {
  const varArgs = Object.entries(vars).flatMap(([k, v]) => ['-v', `${k}=${v}`]);
  const out = compose([
    'exec', '-T', 'postgres', 'sh', '-c',
    'psql -q -v ON_ERROR_STOP=1 -At -F"|" -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"', 'psql', ...varArgs,
  ], sql);
  return out.split('\n').filter(Boolean).map(line => line.split('|'));
}

module.exports = { COMPOSE_FILE, compose, query };
