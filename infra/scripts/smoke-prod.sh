#!/usr/bin/env bash
# Smoke test de producción. Solo lectura: no crea usuarios ni llama set-initial-password.
# Única escritura indirecta: el intento de login con credenciales falsas deja 1 fila `login_fail`
# en auth_events (smoke-test@invalid.test) y consume 1 de los RATE_LIMIT_PER_MIN de esta IP.
#
#   infra/scripts/smoke-prod.sh [API_URL] [WEB_URL]
#     por defecto: https://api.topi.cash  https://www.topi.cash
#   Variables opcionales:
#     APEX_URL        dominio sin www que debe redirigir a WEB_URL (por defecto https://topi.cash;
#                     vacío = no se comprueba). Con URLs http:// (local) no se comprueba.
#     ALLOWED_ORIGIN  origen que el CORS debe aceptar (por defecto el de WEB_URL)
#
# En local (compose con la API en modo producción):
#   APP_ENV=production docker compose -f infra/docker-compose.yml up -d api
#   infra/scripts/smoke-prod.sh http://localhost:8080 http://localhost:3000
set -uo pipefail

API_URL="${1:-https://api.topi.cash}"; API_URL="${API_URL%/}"
WEB_URL="${2:-https://www.topi.cash}"; WEB_URL="${WEB_URL%/}"
ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-$WEB_URL}"
APEX_URL="${APEX_URL-https://topi.cash}"
FOREIGN_ORIGIN="https://smoke-test.invalid"
LOGIN_EMAIL="smoke-test@invalid.test"
# texto exacto que compara el front (LogInViewInside.jsx) para "credenciales incorrectas"
LOGIN_MESSAGE="user is not authorized, incorrect username or password"

PASS=0; FAIL=0; WARN=0
ok()   { PASS=$((PASS + 1)); printf '  ok    %s\n' "$1"; }
bad()  { FAIL=$((FAIL + 1)); printf '  FALLA %s\n' "$1"; [[ -n "${2:-}" ]] && printf '        %s\n' "$2"; return 0; }
warn() { WARN=$((WARN + 1)); printf '  aviso %s\n' "$1"; }
check() { local desc="$1" got="$2" want="$3"; if [[ "$got" =~ $want ]]; then ok "$desc"; else bad "$desc" "esperado /$want/, obtenido: ${got:-<vacío>}"; fi; }

# headers de una respuesta (en minúsculas, sin \r)
headers() { curl -sS -o /dev/null -D - --max-time 15 "$@" | tr -d '\r' | tr '[:upper:]' '[:lower:]'; }
header()  { grep -m1 "^$1:" <<<"$2" | cut -d' ' -f2-; }
status()  { curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$@"; }

echo "== API: $API_URL"
check "GET / responde 200" "$(status "$API_URL/")" '^200$'
HEALTH="$(curl -sS --max-time 15 -w '\n%{http_code}' "$API_URL/health")"
check "GET /health responde 200" "$(tail -1 <<<"$HEALTH")" '^200$'
check "/health: db ok" "$(head -1 <<<"$HEALTH")" '"db":"ok"'
if grep -q '"worker":"ok"' <<<"$HEALTH"; then ok "/health: worker ok"; else warn "/health: worker stale o sin heartbeat (normal si el worker aún no está desplegado): $(head -1 <<<"$HEALTH")"; fi
check "/docs no expuesto (404)" "$(status "$API_URL/docs/index.html")" '^404$'

H="$(headers -X OPTIONS -H "Origin: $ALLOWED_ORIGIN" -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type' "$API_URL/users/login")"
check "CORS: preflight desde $ALLOWED_ORIGIN permitido" "$(head -1 <<<"$H") $(header access-control-allow-origin "$H")" "^http/[0-9.]+ 20[04] .*${ALLOWED_ORIGIN,,}"
H="$(headers -X OPTIONS -H "Origin: $FOREIGN_ORIGIN" -H 'Access-Control-Request-Method: POST' "$API_URL/users/login")"
if [[ -z "$(header access-control-allow-origin "$H")" ]]; then ok "CORS: origen ajeno rechazado ($(head -1 <<<"$H" | cut -d' ' -f2))"
else bad "CORS: origen ajeno rechazado" "devolvió access-control-allow-origin: $(header access-control-allow-origin "$H")"; fi

LOGIN="$(curl -sS --max-time 15 -w '\n%{http_code}' -H 'Content-Type: application/json' \
  -d "{\"email\":\"$LOGIN_EMAIL\",\"password\":\"Smoke-Test-0!\"}" "$API_URL/users/login")"
check "login con credenciales falsas → 401" "$(tail -1 <<<"$LOGIN")" '^401$'
check "login: mensaje exacto que espera el front" "$(head -1 <<<"$LOGIN")" "\"messages\":\\[\"$LOGIN_MESSAGE\"\\]"

echo "== Web: $WEB_URL"
check "GET / responde 200" "$(status "$WEB_URL/")" '^200$'
H="$(headers "$WEB_URL/dashboard")"
check "GET /dashboard 200 con HTML (fallback SPA)" "$(head -1 <<<"$H") $(header content-type "$H")" '^http/[0-9.]+ 200 .*text/html'
check "GET /healthz responde 200" "$(status "$WEB_URL/healthz")" '^200$'
check "index.html con Cache-Control no-cache" "$(header cache-control "$(headers "$WEB_URL/index.html")")" '^no-cache$'
check "service-worker.js con Cache-Control no-cache" "$(header cache-control "$(headers "$WEB_URL/service-worker.js")")" '^no-cache$'
MAIN="$(curl -sS --max-time 15 "$WEB_URL/" | grep -oE '/static/js/main\.[0-9a-f]+\.js' | head -1)"
if [[ -n "$MAIN" ]]; then
  check "$MAIN con caché immutable" "$(header cache-control "$(headers "$WEB_URL$MAIN")")" 'immutable'
else
  bad "index.html referencia /static/js/main.<hash>.js"
fi
H="$(headers "$WEB_URL/")"
if grep -qE '^cross-origin-(embedder|opener)-policy:' <<<"$H"; then bad "sin COEP/COOP" "$(grep -E '^cross-origin-' <<<"$H")"; else ok "sin COEP/COOP"; fi
check "X-Content-Type-Options nosniff" "$(header x-content-type-options "$H")" '^nosniff$'
check "X-Frame-Options DENY" "$(header x-frame-options "$H")" '^deny$'

if [[ "$WEB_URL" == https://* && -n "$APEX_URL" ]]; then
  H="$(headers "$APEX_URL/")"
  check "$APEX_URL redirige (301/308) a $WEB_URL" "$(head -1 <<<"$H" | cut -d' ' -f2) $(header location "$H")" "^30[18] ${WEB_URL,,}/?$"
fi

if [[ "$API_URL" == https://* || "$WEB_URL" == https://* ]]; then
  echo "== TLS"
  for url in "$API_URL" "$WEB_URL" ${APEX_URL:+"$APEX_URL"}; do
    [[ "$url" == https://* ]] || continue
    host="${url#https://}"; host="${host%%/*}"
    # curl verifica cadena y nombre; openssl muestra el vencimiento (si está instalado)
    if curl -sS -o /dev/null --max-time 15 "https://$host/" 2>/dev/null; then
      expiry=""
      command -v openssl >/dev/null && expiry="$(openssl s_client -connect "$host:443" -servername "$host" </dev/null 2>/dev/null \
        | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
      ok "TLS válido en $host${expiry:+ (vence $expiry)}"
    else
      bad "TLS válido en $host" "$(curl -sS -o /dev/null --max-time 15 "https://$host/" 2>&1 | head -1)"
    fi
  done
else
  echo "== TLS: omitido (URLs http://)"
fi

echo
echo "Resultado: $PASS ok, $FAIL fallas, $WARN avisos"
[[ "$FAIL" -eq 0 ]]
