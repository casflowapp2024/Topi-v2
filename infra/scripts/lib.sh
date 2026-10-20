#!/usr/bin/env bash
# Funciones comunes de los scripts de infra (se carga con `source`).
# psql corre DENTRO del contenedor postgres del compose: solo hace falta Docker.

# Git Bash (MSYS) convierte rutas en argumentos: desactivarlo
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

win_path() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

# Variables de infra/.env (las del entorno tienen prioridad)
if [[ -f "$INFRA_DIR/.env" ]]; then
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    [[ -z "${!key:-}" ]] && export "$key=$value"
  done < <(tr -d '\r' < "$INFRA_DIR/.env")
fi

DB_USER="${POSTGRES_USER:-topi}"
DB_NAME="${POSTGRES_DB:-cashflow}"
COMPOSE=(docker compose -f "$(win_path "$INFRA_DIR/docker-compose.yml")")

# psql_db [args...]: psql contra la base de la app; el SQL va por stdin
psql_db() {
  "${COMPOSE[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" "$@"
}

require_email() {
  if [[ $# -ne 1 || "$1" != *@* ]]; then
    echo "uso: $(basename "$0") <email>" >&2
    exit 2
  fi
}
