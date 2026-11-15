#!/usr/bin/env bash
# Producción: igual que infra/scripts/launch-diagnostic.sh (mismo SQL, infra/scripts/sql/launch-diagnostic.sql) pero
# exige el destino y nunca usa el compose local. Corre en el servidor:
#   infra/scripts/prod/launch-diagnostic.sh --container <pg> [AAAA-MM-DD]
#   DATABASE_URL=postgresql://... infra/scripts/prod/launch-diagnostic.sh [AAAA-MM-DD]
set -euo pipefail
export TOPI_REQUIRE_TARGET=1
exec "$(dirname "${BASH_SOURCE[0]}")/../launch-diagnostic.sh" "$@"
