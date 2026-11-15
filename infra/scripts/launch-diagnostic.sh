#!/usr/bin/env bash
# Diagnóstico del lanzamiento (plan/27, bloque 0): embudo por usuario, solo conteos.
#   infra/scripts/launch-diagnostic.sh [--container <pg>] [AAAA-MM-DD]   (por defecto: hoy en Bogotá)
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_target "$@"; set -- "${ARGS[@]}"

if [[ $# -ge 1 ]]; then
  [[ "$1" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "uso: $(basename "$0") [AAAA-MM-DD]" >&2; exit 2; }
  psql_sql launch-diagnostic.sql -v as_of="'$1'"
else
  psql_sql launch-diagnostic.sql
fi
