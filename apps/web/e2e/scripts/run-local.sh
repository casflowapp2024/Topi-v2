#!/usr/bin/env bash
# E2E completo contra el compose local (infra/docker-compose.yml):
#   1. restore.sh (base limpia del dump) y compose up de postgres + api + worker + web
#   2. flujos 1–6 y 8 (escritorio y móvil) y, con OLD_BUILD_DIR, el escenario del SW viejo
#   3. flujo 7: la API se reinicia con ACCESS_TOKEN_TTL=${E2E_TTL_SECONDS}s
#   4. siempre al final: API con su TTL normal y restore.sh (no deja datos de prueba)
# Uso: apps/web/e2e/scripts/run-local.sh [args extra de playwright]
set -euo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$E2E_DIR/../../.." && pwd)"
win_path() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
COMPOSE=(docker compose -f "$(win_path "$REPO_DIR/infra/docker-compose.yml")")
TTL="${E2E_TTL_SECONDS:-20}"

cleanup() {
  status=$?
  echo "==> Limpieza: API con TTL normal y restore de la base"
  "${COMPOSE[@]}" up -d --wait api >/dev/null 2>&1 || true
  "$REPO_DIR/infra/scripts/restore.sh" >/dev/null && echo "    base restaurada" || echo "    ERROR en restore.sh" >&2
  exit $status
}
trap cleanup EXIT

echo "==> Base limpia y compose arriba"
"$REPO_DIR/infra/scripts/restore.sh" >/dev/null
"${COMPOSE[@]}" up -d --build --wait

cd "$E2E_DIR"
failed=0
echo "==> Flujos 1–6 y 8"
npx playwright test "$@" || failed=1

echo "==> Flujo 7 (ACCESS_TOKEN_TTL=${TTL}s)"
ACCESS_TOKEN_TTL="${TTL}s" "${COMPOSE[@]}" up -d --wait api
E2E_SKIP_USERS=1 E2E_TTL_SECONDS="$TTL" npx playwright test tests/token-refresh.spec.js "$@" || failed=1
exit $failed
