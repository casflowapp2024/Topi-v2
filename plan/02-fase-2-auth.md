# Fase 2: auth propia (solo email + contraseña), sin Cognito, sin Google y sin servicio de correo

## Decisiones del negocio (19-oct-2026)
- **No hay servicio de correo.** Nada de códigos ni verificación. Costo $0.
- **Registro sin verificación**: el usuario queda activo apenas se registra.
- **Usuarios migrados** (56, `password_hash IS NULL`): al intentar entrar, el front avisa que Topi se migró y les pide
  **crear su contraseña** sin código. Riesgo aceptado: quien conozca el email de otro podría reclamar su cuenta.
  Mitigaciones baratas (abajo): solo funciona una vez por cuenta, tiene ventana de tiempo, queda en log y el admin puede revertirlo.
- **Olvidé mi contraseña**: sin correo, lo resuelve el admin con un script (deja la cuenta “sin contraseña” y el usuario la crea de nuevo con el mismo flujo).
- **Admin**: `cashflowapp2024@gmail.com`. Ya existe en el dump como usuario migrado (`24c80408-1011-7053-7c1e-29e6475d63e2`); se le asigna el rol con script.

## Hallazgos del código que condicionan el diseño
1. **El front compara los mensajes de error como texto exacto** (p. ej. `LogInView.jsx` compara `"user is not authorized, incorrect username or password"`).
   Los strings existentes de `core/domain/error.go` **no cambian**, y el formato de error sigue siendo `{"messages": [...]}`.
2. **Respuesta de login**: el front guarda `payload.data.access_token`. Se mantiene `domain.AuthTokens`
   (`id_token, access_token, refresh_token, expires_in, token_type`); `id_token` = mismo JWT.
3. **El front no renueva tokens**: ante un 401 cierra la sesión. Se agrega refresh en esta fase.
4. `GetUser` con token de acceso llamaba a Cognito → ahora se lee de la DB por `sub`.
5. El admin se definía por el grupo Cognito `admin`, que se perdió → `users.role`.
6. El worker entraba con un usuario admin a 5 rutas `admin/*` → ahora con header `X-API-Key` (`INTERNAL_API_KEY`).
7. `ErrPasswordResetRequiredException` (`"user needs to reset the password"`) ya existe → la API responde eso cuando la cuenta no tiene contraseña.

## Modelo (migración 000019_auth)
```sql
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,                 -- sub de Cognito (migrados) | uuid v4 (nuevos)
  email VARCHAR(255) NOT NULL,
  password_hash TEXT,                          -- NULL = debe crear contraseña
  name VARCHAR(255) NOT NULL DEFAULT '',
  last_name VARCHAR(255) NOT NULL DEFAULT '',
  role VARCHAR(20) NOT NULL DEFAULT 'user',    -- user | admin
  migrated BOOLEAN NOT NULL DEFAULT false,
  password_set_at TIMESTAMPTZ,
  token_version INT NOT NULL DEFAULT 0,        -- +1 al cambiar/resetear contraseña → invalida sesiones
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower ON users (lower(email));

CREATE TABLE refresh_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auth_events (                      -- auditoría barata
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id VARCHAR(255), email VARCHAR(255), event VARCHAR(40) NOT NULL, -- signup|login_ok|login_fail|initial_password_set|admin_reset|refresh_reuse
  ip VARCHAR(64), user_agent TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO users (id, email, name, last_name, migrated)
SELECT user_id, lower(trim(email)), name, last_name, true
FROM user_extra WHERE trim(email) <> ''
ON CONFLICT DO NOTHING;
```
Esperado tras migrar el dump: `users` = 56, todos con `migrated = true` y `password_hash IS NULL`.

## Endpoints
| Endpoint | Regla |
|---|---|
| `POST /users/signup` | email normalizado (lower/trim). Política de contraseña igual a la de Cognito (≥8, mayúscula, minúscula, número, símbolo) → `ErrInvalidPasswordException`. Email existente → `ErrUsernameExistsException`. Responde con los tokens (login automático) **además** de lo que respondía antes. |
| `POST /users/login` | Ya no acepta `code`. Email inexistente o contraseña mala → `ErrNotAuthorizedException`. `password_hash NULL` → `ErrPasswordResetRequiredException` (no revela nada más). |
| `POST /users/set-initial-password` (nuevo) | `{email, password, confirm_password}`. Solo si el usuario existe **y** `password_hash IS NULL`; si no, `ErrNotAuthorizedException`. Valida la política, guarda el hash, pone `password_set_at`, registra `initial_password_set` en `auth_events` y devuelve tokens. Si `INITIAL_PASSWORD_UNTIL` (fecha, opcional) ya pasó → `ErrNotAuthorizedException`. |
| `POST /users/refresh` (nuevo) | Rota el refresh token. Si se reusa un token revocado, revoca todos los del usuario y registra `refresh_reuse`. |
| `POST /users/logout` (nuevo) | Revoca el refresh token. |
| `PUT /users/password` (nuevo, autenticado) | Cambiar contraseña con la actual. `token_version+1`. |
| `GET/PUT /users/` | Lee/actualiza `users` y sincroniza name/last_name en `user_extra`. |
| `POST /users/confirm`, `POST /users/resend-confirmation` | Se mantienen como **no-op 200** por compatibilidad; el front deja de usarlos. |
| `POST /users/forgot-password`, `PUT /users/forgot-password/confirm` | **Se eliminan** (no hay correo). |
| `/users/social-auth-url*` | **Se eliminan**. |

- Hash: argon2id (`golang.org/x/crypto/argon2`) o bcrypt cost 12.
- JWT HS256 con `JWT_SECRET` (≥32 bytes, obligatorio al arrancar). Claims: `sub, email, role, tv, token_use="access", iss, iat, exp`.
  `ACCESS_TOKEN_TTL` default `1h`; `REFRESH_TOKEN_TTL` default `720h`. Si `tv` ≠ `users.token_version` → 401.
- Rate limit en memoria por IP y por email en `login`, `signup` y `set-initial-password` (p. ej. 10/min) → `ErrLimitExceededException`.
- `X-API-Key`: comparación en tiempo constante; payload `{UserID:"service", Groups:{admin:true}, Use:"access"}`. El rol admin de `users` también entra a `admin/*`.

## Scripts (infra/scripts)
- `make-admin.sh <email>` → `role='admin'`. Se usará con `cashflowapp2024@gmail.com`.
- `reset-password.sh <email>` → `password_hash=NULL`, `token_version+1`, revoca refresh tokens, registra `admin_reset`. El usuario vuelve a crear contraseña al entrar.
  Sirve para “olvidé mi contraseña” y para revertir una cuenta reclamada por otra persona.
- `auth-report.sh` → migrados que ya crearon contraseña vs pendientes, y últimos eventos de `initial_password_set`.

## Front (apps/web)
- Quitar el login con Google (`GAuthCallBack`, `login_with_code`, botón y llamadas a `/users/social-auth-url`). **No** tocar Gmail/Outlook en Conexiones.
- Login: si la API responde `"user needs to reset the password"`, mostrar en la misma pantalla:
  > **Actualizamos Topi.** Migramos la plataforma y por seguridad debes crear una nueva contraseña.
  > Si antes entrabas con Google, crea aquí una contraseña para tu correo.
  con campos nueva contraseña + confirmar → `POST /users/set-initial-password` → guarda tokens y entra.
- Registro: quitar el paso de código (`VerifyEmailCode`); tras el signup entra directo.
- “¿Olvidaste tu contraseña?” → página informativa: escribir a `cashflowapp2024@gmail.com` para restablecerla.
- Guardar `refresh_token`; interceptor axios: ante 401 intenta `/users/refresh` una vez; si falla, logout.
- Agregar “Cambiar contraseña” en Ajustes > Perfil (`PUT /users/password`).

## Limpieza
Borrar `adapter/auth/cognito`, `adapter/auth/social`, `port/cognito.go`, `port/social_auth.go`, sus mocks, la config de Cognito/Social,
enums de Cognito/OAuth social, `MicahParks/keyfunc` y `aws-sdk-go`. `grep -ri "cognito\|aws" apps/api --include=*.go` debe quedar vacío.

## Criterios de aceptación
- [x] `go build ./... && go test ./...` OK. Tests nuevos: signup, login (ok / mala / hash NULL), set-initial-password (ok / ya tenía contraseña / ventana vencida), refresh con rotación y reuso, token_version, API key, rate limit.
- [x] Tras restore + migrate: `users` = 56, versión 19.
- [x] Flujo migrado con un usuario real del dump con transacciones: login → `user needs to reset the password` → set-initial-password → `GET /transactions/list` devuelve sus transacciones viejas. Un segundo set-initial-password falla.
- [x] `reset-password.sh` deja la cuenta otra vez en estado “crear contraseña” y las sesiones viejas dan 401.
- [x] Usuario nuevo: signup → entra directo → crea cuenta y categoría.
- [x] `make-admin.sh cashflowapp2024@gmail.com` → ese usuario accede a `admin/*`; un usuario normal recibe 403; `X-API-Key` funciona.
  _(Verificado 20-oct-2026 en local: restore → versión 19, users = 56; flujo E2E con un usuario migrado de 2.180 transacciones; front probado en el navegador.)_
- [x] Sin AWS/Cognito en `go.mod`.
- [x] Front: build OK, sin Google login ni verificación por código, aviso de migración y creación de contraseña funcionando contra la API local.
