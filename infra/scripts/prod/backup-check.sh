#!/usr/bin/env bash
# Prueba que los backups sirven: baja el último backup del bucket S3 (R2/B2), lo restaura en un
# Postgres temporal y compara los conteos con la base en producción. No toca la base de producción
# (solo la lee con --container). Corre en el servidor o en cualquier máquina con Docker.
#
#   S3_ENDPOINT=https://<cuenta>.r2.cloudflarestorage.com S3_BUCKET=topi-backups \
#   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
#     infra/scripts/prod/backup-check.sh [--prefix <ruta/en/el/bucket>] [--key <objeto>] [--container <pg>]
#
#   --prefix     carpeta donde Coolify deja los backups (por defecto: todo el bucket)
#   --key        un objeto concreto en vez del más reciente
#   --container  contenedor de la base en producción, para comparar conteos (opcional)
#   S3_REGION    por defecto `auto` (R2); para B2, la región del endpoint (p. ej. us-west-004)
#   S3_NETWORK   red Docker para llegar al endpoint (solo pruebas locales con MinIO)
# Formatos aceptados: pg_dump custom (.dmp), gzip de cualquiera de los dos, o SQL plano.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

AWS_IMAGE="${AWS_IMAGE:-amazon/aws-cli:2.17.0}"
PREFIX=""; KEY=""; LIVE_CONTAINER=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix) PREFIX="${2:-}"; shift 2 ;;
    --key) KEY="${2:-}"; shift 2 ;;
    --container) LIVE_CONTAINER="${2:-}"; shift 2 ;;
    *) echo "ERROR: argumento desconocido: $1" >&2; exit 2 ;;
  esac
done
for v in S3_ENDPOINT S3_BUCKET AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY; do
  [[ -n "${!v:-}" ]] || { echo "ERROR: falta la variable $v" >&2; exit 2; }
done

WORK="$(mktemp -d)"
CHECK_PG="topi-backup-check-$$"
cleanup() { docker rm -f "$CHECK_PG" >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

aws() {
  docker run --rm ${S3_NETWORK:+--network "$S3_NETWORK"} \
    -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION="${S3_REGION:-auto}" \
    -v "$(win_path "$WORK"):/work" "$AWS_IMAGE" --endpoint-url "$S3_ENDPOINT" "$@"
}

echo "==> Buscando el backup en s3://$S3_BUCKET/${PREFIX}"
if [[ -z "$KEY" ]]; then
  read -r KEY MODIFIED SIZE < <(aws s3api list-objects-v2 --bucket "$S3_BUCKET" ${PREFIX:+--prefix "$PREFIX"} \
    --query 'sort_by(Contents, &LastModified)[-1].[Key, LastModified, Size]' --output text)
  [[ -n "$KEY" && "$KEY" != "None" ]] || { echo "ERROR: no hay objetos en s3://$S3_BUCKET/$PREFIX" >&2; exit 3; }
  echo "    último: $KEY ($MODIFIED, $SIZE bytes)"
fi
aws s3 cp --only-show-errors "s3://$S3_BUCKET/$KEY" /work/backup

echo "==> Postgres temporal ($CHECK_PG)"
docker run -d --name "$CHECK_PG" -e POSTGRES_USER=check -e POSTGRES_PASSWORD="check-$$" -e POSTGRES_DB=check \
  "$PG_IMAGE" >/dev/null
for _ in $(seq 1 60); do docker exec "$CHECK_PG" pg_isready -U check -d check >/dev/null 2>&1 && break; sleep 1; done
sleep 2
docker cp "$(win_path "$WORK/backup")" "$CHECK_PG:/tmp/backup" >/dev/null

echo "==> Restaurando"
docker exec "$CHECK_PG" sh -c '
  set -e
  f=/tmp/backup
  if [ "$(head -c 2 $f | od -An -tx1 | tr -d " ")" = "1f8b" ]; then gunzip -c $f > /tmp/backup.raw; f=/tmp/backup.raw; fi
  if [ "$(head -c 5 $f)" = "PGDMP" ]; then
    echo "    formato: pg_dump custom"
    pg_restore -l $f | grep -viE "cron" > /tmp/backup.list
    pg_restore -U check -d check --no-owner --no-acl --exit-on-error -L /tmp/backup.list $f
  else
    echo "    formato: SQL plano"
    # equivalente a --no-owner --no-acl: los roles de producción no existen aquí
    sed -E "/^ALTER .* OWNER TO /d; /^(GRANT|REVOKE) /d" $f > /tmp/backup.sql
    psql -q -v ON_ERROR_STOP=1 -U check -d check -f /tmp/backup.sql >/dev/null
  fi'

COUNTS_SQL="SELECT (SELECT count(*) FROM transactions), (SELECT count(*) FROM user_extra), (SELECT count(*) FROM emails),
  (SELECT count(*) FROM users), (SELECT max(version) FROM schema_migrations)"
read -r B_TX B_UE B_EM B_US B_VER < <(docker exec "$CHECK_PG" psql -U check -d check -At -F ' ' -c "$COUNTS_SQL")

if [[ -n "$LIVE_CONTAINER" ]]; then
  TARGET=container; PG_CONTAINER="$LIVE_CONTAINER"
  read -r L_TX L_UE L_EM L_US L_VER < <(psql_db -At -F ' ' -c "$COUNTS_SQL")
else
  L_TX="-"; L_UE="-"; L_EM="-"; L_US="-"; L_VER="-"
fi

printf '\n%-28s %10s %12s\n' "" "backup" "producción"
printf '%-28s %10s %12s\n' "transactions" "$B_TX" "$L_TX" "user_extra" "$B_UE" "$L_UE" "emails" "$B_EM" "$L_EM" \
  "users" "$B_US" "$L_US" "schema_migrations.version" "$B_VER" "$L_VER"

status=0
[[ "$B_TX" =~ ^[0-9]+$ && "$B_TX" -gt 0 ]] || { echo "ERROR: el backup restaurado no tiene transacciones" >&2; status=4; }
if [[ -n "$LIVE_CONTAINER" ]]; then
  # la base sigue creciendo después del backup: el backup no puede tener más filas que producción
  for pair in "$B_TX:$L_TX" "$B_UE:$L_UE" "$B_EM:$L_EM" "$B_US:$L_US"; do
    [[ "${pair%%:*}" -le "${pair##*:}" ]] || { echo "ERROR: el backup tiene más filas que producción ($pair)" >&2; status=4; }
  done
  [[ "$B_VER" == "$L_VER" ]] || echo "aviso: versión de migraciones distinta (backup $B_VER, producción $L_VER)"
fi
[[ "$status" -eq 0 ]] && echo -e "\n==> OK: el backup $KEY se restaura y tiene datos."
exit "$status"
