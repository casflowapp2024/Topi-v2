#!/usr/bin/env bash
# Estado de la migración de cuentas y últimos eventos de auth.
#   infra/scripts/auth-report.sh [--container <pg>] [dias]     (por defecto 7 días para los eventos)
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
parse_target "$@"; set -- "${ARGS[@]}"
DAYS="${1:-7}"
[[ "$DAYS" =~ ^[0-9]+$ ]] || { echo "uso: $(basename "$0") [dias]" >&2; exit 2; }

psql_sql auth-report.sql -v days="$DAYS"
