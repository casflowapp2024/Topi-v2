#!/usr/bin/env bash
# Producción: igual que infra/scripts/auth-report.sh (mismo SQL, infra/scripts/sql/auth-report.sql) pero exige
# el destino y nunca usa el compose local. Corre en el servidor:
#   infra/scripts/prod/auth-report.sh --container <pg> [dias]
#   DATABASE_URL=postgresql://... infra/scripts/prod/auth-report.sh [dias]
set -euo pipefail
export TOPI_REQUIRE_TARGET=1
exec "$(dirname "${BASH_SOURCE[0]}")/../auth-report.sh" "$@"
