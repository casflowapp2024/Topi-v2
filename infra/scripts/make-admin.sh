#!/usr/bin/env bash
# Asigna el rol admin a un usuario (users.role = 'admin').
#   infra/scripts/make-admin.sh <email>
# El rol se lee de la DB en cada request: aplica sin volver a iniciar sesión.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_email "$@"

result="$(psql_db -At -v email="$1" <<'SQL'
UPDATE users SET role = 'admin', updated_at = now()
WHERE lower(email) = lower(trim(:'email'))
RETURNING id || ' ' || email || ' role=' || role;
SQL
)"

if [[ -z "$result" ]]; then
  echo "ERROR: no existe un usuario con email $1" >&2
  exit 1
fi

echo "OK: $result"
