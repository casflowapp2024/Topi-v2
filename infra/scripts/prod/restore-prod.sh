#!/usr/bin/env bash
# Restaura el dump de producción (pg_dump formato custom, PG 16) en el Postgres de Coolify.
# Corre EN EL SERVIDOR (por SSH), sin el compose local:
#
#   infra/scripts/prod/restore-prod.sh --container <pg> --dump /root/cashflowprod.dump [--force]
#   DATABASE_URL=postgresql://topi:...@<host-interno>:5432/cashflow \
#     infra/scripts/prod/restore-prod.sh --dump /root/cashflowprod.dump [--force]
#
# - Misma lógica que infra/scripts/restore.sh: excluye pg_cron del TOC, --no-owner --no-acl.
# - Se NIEGA si la base ya tiene tablas. Con --force borra el schema public y restaura encima
#   (detén topi-api antes; se pierde lo que hubiera).
# - Al final imprime los conteos y los compara con los del dump del 17-oct.
# - Después: arrancar/reiniciar topi-api, que aplica las migraciones pendientes (hasta la 21).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

export TOPI_REQUIRE_TARGET=1
parse_target "$@"
set -- "${ARGS[@]}"
DUMP=""
FORCE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dump) DUMP="${2:-}"; shift 2 ;;
    --dump=*) DUMP="${1#*=}"; shift ;;
    --force) FORCE=1; shift ;;
    *) echo "ERROR: argumento desconocido: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$DUMP" && -f "$DUMP" ]] || { echo "ERROR: --dump <ruta>: no existe '${DUMP}'" >&2; exit 2; }
DUMP="$(cd "$(dirname "$DUMP")" && pwd)/$(basename "$DUMP")"

EXPECTED_TRANSACTIONS="${EXPECTED_TRANSACTIONS:-8748}"
EXPECTED_USER_EXTRA="${EXPECTED_USER_EXTRA:-62}"
EXPECTED_EMAILS="${EXPECTED_EMAILS:-23}"

# 1. La base tiene que estar vacía (salvo --force)
TABLES="$(psql_db -At -c "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")"
if [[ "$TABLES" != "0" ]]; then
  if [[ "$FORCE" != "1" ]]; then
    echo "ERROR: la base ya tiene $TABLES tablas. No restauro encima." >&2
    echo "       Para reemplazarla (se pierde lo que haya): detén topi-api y repite con --force." >&2
    exit 3
  fi
  echo "==> --force: la base tenía $TABLES tablas; borrando el schema public"
  psql_db -c "SET client_min_messages = warning; DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
fi

# 2. El dump y la lista del TOC tienen que estar donde corre pg_restore
if [[ "$TARGET" == container ]]; then
  D=/tmp/topi-restore.dump; L=/tmp/topi-restore.list
  cleanup() { docker exec "$PG_CONTAINER" rm -f "$D" "$L" "$L.full" >/dev/null 2>&1 || true; }
  trap cleanup EXIT
  echo "==> Copiando el dump al contenedor $PG_CONTAINER"
  docker cp "$(win_path "$DUMP")" "$PG_CONTAINER:$D" >/dev/null
  in_pg() { docker exec -i "$PG_CONTAINER" sh -c "$1"; }
else
  WORK="$(mktemp -d)"
  trap 'rm -rf "$WORK"' EXIT
  D=/dump/restore.dump; L=/work/restore.list
  PG_RUN_ARGS=(-v "$(win_path "$DUMP"):$D:ro" -v "$(win_path "$WORK"):/work")
  in_pg() { docker run --rm -i "${PG_RUN_ARGS[@]}" "$PG_IMAGE" sh -c "$1"; }
fi

echo "==> TOC del dump sin pg_cron"
in_pg "pg_restore -l $D > $L.full && grep -viE cron $L.full > $L"
echo "    entradas excluidas:"
in_pg "grep -iE cron $L.full | sed 's/^/      /'" || true

echo "==> pg_restore (--no-owner --no-acl)"
pg_exec pg_restore --no-owner --no-acl --exit-on-error -j 4 -L "$L" "$D"

# 3. Conteos
read -r TX UE EM VERSION < <(psql_db -At -F ' ' -c "SELECT (SELECT count(*) FROM transactions),
  (SELECT count(*) FROM user_extra), (SELECT count(*) FROM emails), (SELECT max(version) FROM schema_migrations)")
echo "==> Conteos (esperados: transactions $EXPECTED_TRANSACTIONS, user_extra $EXPECTED_USER_EXTRA, emails $EXPECTED_EMAILS)"
printf '    transactions = %s\n    user_extra   = %s\n    emails       = %s\n' "$TX" "$UE" "$EM"
printf '    schema_migrations.version = %s (topi-api la sube a 21 al arrancar)\n' "$VERSION"
if [[ "$TX" == "$EXPECTED_TRANSACTIONS" && "$UE" == "$EXPECTED_USER_EXTRA" && "$EM" == "$EXPECTED_EMAILS" ]]; then
  echo "==> OK: los conteos coinciden con el dump. Siguiente paso: arrancar/reiniciar topi-api."
else
  echo "ERROR: los conteos no coinciden con los esperados" >&2
  exit 4
fi
