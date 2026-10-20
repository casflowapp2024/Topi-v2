# Prompt para Claude Code — Fase 2

> Abre Claude Code en `C:\Users\juanm\WorkSpace\topiv2\topi` y pega lo de abajo.

---

Continuamos la migración de Topi. La Fase 1 está completa y commiteada. Ahora vamos con la **Fase 2: reemplazar Cognito con auth propia solo de email + contraseña, sin login con Google y sin ningún servicio de correo** (no hay verificación ni códigos; el objetivo es costo $0).

Lee completos `CLAUDE.md`, `plan/00-plan-general.md` y `plan/02-fase-2-auth.md`. Esa última es la especificación: decisiones, modelo, endpoints, scripts, cambios del front y criterios de aceptación. `plan/03-fase-3-worker.md` es solo contexto.

Restricciones críticas:
1. **Contrato con el front:** los strings de error existentes en `internal/core/domain/error.go` y el formato `{"messages": [...]}` no cambian. La respuesta de login mantiene la forma de `domain.AuthTokens`.
2. **El `user_id` existente es sagrado:** los usuarios migrados conservan su `id` (el sub viejo de Cognito). No se modifica ninguna tabla de negocio.
3. **No confundir** el login con Google (se elimina) con el OAuth de Gmail/Outlook para leer correos (`adapter/email/gmail`, `adapter/email/outlook`, Conexiones en el front), que se mantiene intacto.
4. **Nada de envío de correos**: no agregues SMTP, Resend ni ninguna dependencia de email.
5. `set-initial-password` solo funciona si la cuenta no tiene contraseña, respeta `INITIAL_PASSWORD_UNTIL` si está definida, tiene rate limit y registra en `auth_events`. Es el punto más sensible: hazle tests.
6. Arquitectura hexagonal: nuevos adaptadores detrás de `port.UserRepository` y `port.TokenRepository` (puedes ajustar los ports si hace falta, explícalo).
7. Seguridad: argon2id o bcrypt; comparación en tiempo constante para la API key; `JWT_SECRET` obligatorio al arrancar; cero secretos en el repo; actualiza `.env.example`.
8. El email del admin no va en migraciones: va en `infra/scripts/make-admin.sh`. Ejecútalo localmente con `cashflowapp2024@gmail.com` para probar.
9. No toques `apps/worker`, salvo documentar en `plan/03-fase-3-worker.md` que debe usar `X-API-Key`.

Forma de trabajo:
- Primero dame un plan corto: archivos a crear, borrar y modificar, cambios a los ports y librerías nuevas. Espera mi OK.
- Trabaja en este orden, con commits pequeños: (a) migración 000019 + repos Postgres, (b) servicio de auth + tokens con tests, (c) handlers, rutas y middleware (API key, refresh, logout, set-initial-password, cambio de contraseña; quitar social y forgot), (d) borrar Cognito/social y `go mod tidy`, (e) front, (f) scripts.
- Al final ejecuta `infra/scripts/restore.sh`, levanta el compose y corre de punta a punta todos los criterios de aceptación de `plan/02-fase-2-auth.md`. Usa como usuario migrado uno real del dump con transacciones. Muéstrame los comandos y las salidas resumidas y marca los checkboxes.
- Si algo de la especificación choca con el código real, detente y pregúntame.
