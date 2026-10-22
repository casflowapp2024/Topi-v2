#!/usr/bin/env bash
# Producción: igual que infra/scripts/reset-password.sh (mismo SQL, infra/scripts/sql/reset-password.sql) pero exige
# el destino y nunca usa el compose local. Corre en el servidor:
#   infra/scripts/prod/reset-password.sh --container <pg> <email>
#   DATABASE_URL=postgresql://... infra/scripts/prod/reset-password.sh <email>
set -euo pipefail
export TOPI_REQUIRE_TARGET=1
exec "$(dirname "${BASH_SOURCE[0]}")/../reset-password.sh" "$@"
