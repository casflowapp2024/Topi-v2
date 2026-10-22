#!/usr/bin/env bash
# Deja una cuenta en estado "crear contraseña" (para "olvidé mi contraseña" o para
# revertir una cuenta reclamada por otra persona):
#   password_hash = NULL, token_version + 1 (las sesiones abiertas dan 401),
#   revoca los refresh tokens y registra admin_reset en auth_events.
#   infra/scripts/reset-password.sh [--container <pg>] <email>     (sin --container: compose local)
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_target "$@"; set -- "${ARGS[@]}"
require_email "$@"

result="$(psql_sql reset-password.sql -At -v email="$1")"
result="$(grep -v -E '^(BEGIN|COMMIT)$' <<<"$result" || true)"
if [[ -z "$result" ]]; then
  echo "ERROR: no existe un usuario con email $1" >&2
  exit 1
fi

echo "OK: $result"
echo "La próxima vez que entre, Topi le pedirá crear una contraseña nueva."
