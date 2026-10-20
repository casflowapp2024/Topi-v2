#!/usr/bin/env bash
# Restaura el dump de producción (pg_dump formato custom, PG 16) en el Postgres local.
#
#   infra/scripts/restore.sh [ruta/al/dump]      (por defecto ../cashflowprod.dump respecto al repo)
#
# - Excluye del TOC todas las entradas de pg_cron (extensión de RDS que no existe aquí).
# - Restaura con --no-owner --no-acl.
# - Idempotente: dropea y recrea la base de datos en cada corrida.
# - Corre pg_restore DENTRO del contenedor: solo necesita Docker (Linux, macOS, Git Bash o WSL).
# Después levanta la API, que aplica las migraciones pendientes (queda en versión 18).
set -euo pipefail

# Git Bash (MSYS) convierte rutas tipo /dump/... en argumentos: desactivarlo.
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
REPO_DIR="$(dirname "$INFRA_DIR")"

# En Git Bash, rutas en formato Windows (C:/...) para docker.exe
win_path() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

COMPOSE=(docker compose -f "$(win_path "$INFRA_DIR/docker-compose.yml")")

# Variables de infra/.env (las del entorno tienen prioridad)
if [[ -f "$INFRA_DIR/.env" ]]; then
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    [[ -z "${!key:-}" ]] && export "$key=$value"
  done < <(tr -d '\r' < "$INFRA_DIR/.env")
fi

DB_USER="${POSTGRES_USER:-topi}"
DB_NAME="${POSTGRES_DB:-cashflow}"
DUMP_FILE="${1:-${DUMP_FILE:-$REPO_DIR/../cashflowprod.dump}}"

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "ERROR: no existe el dump: $DUMP_FILE" >&2
  exit 1
fi

# Ruta absoluta (en Git Bash, formato Windows para Docker Desktop)
DUMP_FILE="$(win_path "$(cd "$(dirname "$DUMP_FILE")" && pwd)/$(basename "$DUMP_FILE")")"
export DUMP_FILE

echo "==> Dump: $DUMP_FILE"
echo "==> Levantando postgres"
"${COMPOSE[@]}" stop api >/dev/null 2>&1 || true
"${COMPOSE[@]}" up -d --wait postgres

pg() { "${COMPOSE[@]}" exec -T postgres "$@"; }

echo "==> Generando lista del TOC sin pg_cron"
pg sh -c 'pg_restore -l /dump/cashflowprod.dump > /tmp/full.list && grep -viE "cron" /tmp/full.list > /tmp/restore.list'
echo "    entradas excluidas:"
pg sh -c 'grep -iE "cron" /tmp/full.list | sed "s/^/      /"' || true

echo "==> Recreando la base $DB_NAME"
pg psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE);" \
  -c "CREATE DATABASE \"$DB_NAME\";"

echo "==> pg_restore (--no-owner --no-acl)"
pg pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl --exit-on-error -j 4 \
  -L /tmp/restore.list /dump/cashflowprod.dump

echo "==> Conteos"
pg psql -U "$DB_USER" -d "$DB_NAME" -At -F ' = ' -c "
  SELECT 'transactions', count(*) FROM transactions
  UNION ALL SELECT 'user_extra', count(*) FROM user_extra
  UNION ALL SELECT 'schema_migrations.version', max(version) FROM schema_migrations;"

if [[ "${NO_API:-0}" != "1" ]]; then
  echo "==> Levantando la API (aplica migraciones pendientes)"
  "${COMPOSE[@]}" up -d --build --wait api
  pg psql -U "$DB_USER" -d "$DB_NAME" -At -c \
    "SELECT 'schema_migrations.version = ' || version || ' dirty=' || dirty FROM schema_migrations;"
fi

echo "==> Listo"
