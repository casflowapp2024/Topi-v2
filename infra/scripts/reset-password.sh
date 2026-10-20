#!/usr/bin/env bash
# Deja una cuenta en estado "crear contraseña" (para "olvidé mi contraseña" o para
# revertir una cuenta reclamada por otra persona):
#   password_hash = NULL, token_version + 1 (las sesiones abiertas dan 401),
#   revoca los refresh tokens y registra admin_reset en auth_events.
#   infra/scripts/reset-password.sh <email>
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_email "$@"

result="$(psql_db -At -v email="$1" <<'SQL'
BEGIN;
WITH target AS (
  UPDATE users
  SET password_hash = NULL, password_set_at = NULL,
      token_version = token_version + 1, updated_at = now()
  WHERE lower(email) = lower(trim(:'email'))
  RETURNING id, email, token_version
), revoked AS (
  UPDATE refresh_tokens SET revoked_at = now()
  WHERE user_id IN (SELECT id FROM target) AND revoked_at IS NULL
  RETURNING id
), event AS (
  INSERT INTO auth_events (user_id, email, event, user_agent)
  SELECT id, email, 'admin_reset', 'infra/scripts/reset-password.sh' FROM target
)
SELECT id || ' ' || email || ' token_version=' || token_version
       || ' refresh_revocados=' || (SELECT count(*) FROM revoked)
FROM target;
COMMIT;
SQL
)"

result="$(grep -v -E '^(BEGIN|COMMIT)$' <<<"$result" || true)"
if [[ -z "$result" ]]; then
  echo "ERROR: no existe un usuario con email $1" >&2
  exit 1
fi

echo "OK: $result"
echo "La próxima vez que entre, Topi le pedirá crear una contraseña nueva."
