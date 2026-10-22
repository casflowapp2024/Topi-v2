#!/usr/bin/env bash
# Funciones comunes de los scripts de infra (se carga con `source`).
# psql corre siempre en un contenedor: solo hace falta Docker.
#
# Destino de la base (parse_target):
#   (nada)                 compose local (infra/docker-compose.yml, variables de infra/.env)
#   --container <nombre>   un contenedor Postgres por nombre (en el servidor: el de Coolify);
#                          usuario y base salen de sus POSTGRES_USER / POSTGRES_DB
#   DATABASE_URL=...       una URL postgresql://; psql corre en un postgres:16-alpine temporal
#                          en la red Docker PG_NETWORK (por defecto `coolify`, la de Coolify)
# Los scripts de infra/scripts/prod/ exigen --container o DATABASE_URL (TOPI_REQUIRE_TARGET=1).

# Git Bash (MSYS) convierte rutas en argumentos: desactivarlo
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
SQL_DIR="$SCRIPT_DIR/sql"
PG_IMAGE="${PG_IMAGE:-postgres:16-alpine}"
PG_NETWORK="${PG_NETWORK:-coolify}"

win_path() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

TARGET=""          # compose | container | url
PG_CONTAINER=""
ARGS=()
PG_RUN_ARGS=()   # opciones extra de `docker run` en modo url (p. ej. -v para un dump)

# parse_target "$@": consume --container <nombre> y deja el resto en ARGS
parse_target() {
  ARGS=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --container) [[ $# -ge 2 ]] || { echo "ERROR: --container necesita un nombre" >&2; exit 2; }
                   PG_CONTAINER="$2"; shift 2 ;;
      --container=*) PG_CONTAINER="${1#*=}"; shift ;;
      *) ARGS+=("$1"); shift ;;
    esac
  done

  if [[ -n "$PG_CONTAINER" ]]; then
    TARGET=container
    docker inspect "$PG_CONTAINER" >/dev/null 2>&1 || { echo "ERROR: no existe el contenedor $PG_CONTAINER" >&2; exit 2; }
  elif [[ -n "${DATABASE_URL:-}" ]]; then
    TARGET=url
  elif [[ "${TOPI_REQUIRE_TARGET:-0}" == "1" ]]; then
    echo "ERROR: indica la base: --container <nombre> o DATABASE_URL=postgresql://..." >&2
    echo "       (en el servidor: docker ps --format '{{.Names}}  {{.Image}}' | grep postgres)" >&2
    exit 2
  else
    TARGET=compose
    load_local_env
  fi
}

# Variables de infra/.env (las del entorno tienen prioridad). Solo para el compose local.
load_local_env() {
  if [[ -f "$INFRA_DIR/.env" ]]; then
    while IFS='=' read -r key value; do
      [[ -z "$key" || "$key" == \#* ]] && continue
      [[ -z "${!key:-}" ]] && export "$key=$value"
    done < <(tr -d '\r' < "$INFRA_DIR/.env")
  fi
  DB_USER="${POSTGRES_USER:-topi}"
  DB_NAME="${POSTGRES_DB:-cashflow}"
  COMPOSE=(docker compose -f "$(win_path "$INFRA_DIR/docker-compose.yml")")
}

# pg_exec <comando> [args...]: corre un cliente de Postgres (psql, pg_restore...) contra el destino.
# Con `container` y `compose` corre dentro del contenedor de la base; con `url`, en uno temporal.
# Los argumentos de conexión los pone pg_exec; stdin pasa tal cual.
pg_exec() {
  local cmd="$1"; shift
  case "$TARGET" in
    container)
      docker exec -i "$PG_CONTAINER" sh -c \
        'cmd="$1"; shift; exec "$cmd" -U "${DB_USER:-$POSTGRES_USER}" -d "${DB_NAME:-${POSTGRES_DB:-$POSTGRES_USER}}" "$@"' \
        sh "$cmd" "$@" ;;
    url)
      docker run --rm -i --network "$PG_NETWORK" -e DATABASE_URL "${PG_RUN_ARGS[@]}" "$PG_IMAGE" sh -c \
        'cmd="$1"; shift; exec "$cmd" -d "$DATABASE_URL" "$@"' sh "$cmd" "$@" ;;
    compose)
      "${COMPOSE[@]}" exec -T postgres "$cmd" -U "$DB_USER" -d "$DB_NAME" "$@" ;;
    *) echo "ERROR: parse_target no se llamó" >&2; exit 2 ;;
  esac
}

# psql_db [args...]: psql contra la base de la app; el SQL va por stdin
psql_db() {
  pg_exec psql -q -v ON_ERROR_STOP=1 "$@"
}

# psql_sql <archivo.sql> [args...]: corre un SQL de infra/scripts/sql/
psql_sql() {
  local file="$SQL_DIR/$1"; shift
  psql_db "$@" < "$file"
}

require_email() {
  if [[ $# -ne 1 || "$1" != *@* ]]; then
    echo "uso: $(basename "$0") [--container <pg>] <email>" >&2
    exit 2
  fi
}
