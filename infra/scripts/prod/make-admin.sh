#!/usr/bin/env bash
# Producción: igual que infra/scripts/make-admin.sh (mismo SQL, infra/scripts/sql/make-admin.sql) pero exige
# el destino y nunca usa el compose local. Corre en el servidor:
#   infra/scripts/prod/make-admin.sh --container <pg> <email>
#   DATABASE_URL=postgresql://... infra/scripts/prod/make-admin.sh <email>
set -euo pipefail
export TOPI_REQUIRE_TARGET=1
exec "$(dirname "${BASH_SOURCE[0]}")/../make-admin.sh" "$@"
