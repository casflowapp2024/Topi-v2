#!/usr/bin/env bash
# Estado de la migración de cuentas y últimos eventos de auth.
#   infra/scripts/auth-report.sh [dias]     (por defecto 7 días para los eventos)
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
DAYS="${1:-7}"
[[ "$DAYS" =~ ^[0-9]+$ ]] || { echo "uso: $(basename "$0") [dias]" >&2; exit 2; }

psql_db -v days="$DAYS" <<'SQL'
\pset footer off
\echo '== Usuarios'
SELECT
  count(*) FILTER (WHERE migrated)                                  AS migrados,
  count(*) FILTER (WHERE migrated AND password_hash IS NOT NULL)    AS migrados_con_contrasena,
  count(*) FILTER (WHERE migrated AND password_hash IS NULL)        AS migrados_pendientes,
  count(*) FILTER (WHERE NOT migrated)                              AS nuevos,
  count(*) FILTER (WHERE role = 'admin')                            AS admins
FROM users;

\echo '== Últimas contraseñas iniciales creadas'
SELECT created_at, email, ip, left(user_agent, 40) AS user_agent
FROM auth_events WHERE event = 'initial_password_set'
ORDER BY created_at DESC LIMIT 20;

\echo '== Intentos fallidos de crear contraseña (posibles reclamos), últimos' :days 'días'
SELECT email, count(*) AS intentos, max(created_at) AS ultimo
FROM auth_events
WHERE event = 'initial_password_fail' AND created_at > now() - make_interval(days => :days)
GROUP BY email ORDER BY intentos DESC LIMIT 20;

\echo '== Eventos por tipo, últimos' :days 'días'
SELECT event, count(*) FROM auth_events
WHERE created_at > now() - make_interval(days => :days)
GROUP BY event ORDER BY count(*) DESC;
SQL
