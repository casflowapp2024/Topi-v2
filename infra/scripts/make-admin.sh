#!/usr/bin/env bash
# Asigna el rol admin a un usuario (users.role = 'admin').
#   infra/scripts/make-admin.sh [--container <pg>] <email>     (sin --container: compose local)
# El rol se lee de la DB en cada request: aplica sin volver a iniciar sesión.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_target "$@"; set -- "${ARGS[@]}"
require_email "$@"

result="$(psql_sql make-admin.sql -At -v email="$1")"

if [[ -z "$result" ]]; then
  echo "ERROR: no existe un usuario con email $1" >&2
  exit 1
fi

echo "OK: $result"
