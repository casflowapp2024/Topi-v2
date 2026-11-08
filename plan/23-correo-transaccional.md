# Correo transaccional (en paralelo con el modelo de negocio)

Hoy `CLAUDE.md` prohíbe enviar correos y "olvidé mi contraseña" lo resuelve el admin a mano. Este plan
habilita el envío de forma controlada.

## Proveedor: Resend
- API HTTP (Hetzner normalmente bloquea SMTP saliente: no usar SMTP), SDK de Go, webhooks de rebote/queja,
  plan gratis suficiente para empezar (~3.000 correos/mes, ~100/día; validar límites al crear la cuenta).
- Todo detrás de un puerto `domain.Mailer`; cambiar a Brevo u otro debe ser solo un adaptador nuevo.

## Requisitos manuales (runbook, los hace JuanMa)
1. Dominio propio (si aún no lo hay). Enviar desde un subdominio, p. ej. `mail.<dominio>`, para proteger
   la reputación del dominio principal.
2. Cuenta en Resend → agregar el dominio → crear en el DNS los registros que indique (SPF, DKIM) y un
   DMARC inicial `p=none` con reporte; subir a `quarantine` cuando todo pase.
3. Crear API key solo con permiso de envío y el secreto del webhook; ponerlos en Coolify.
Documentarlo en `infra/coolify/RUNBOOK.md` (sección nueva) y las variables en `.env.example` y plantillas.

## Variables
`MAIL_PROVIDER=log|resend` (por defecto `log`), `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`,
`MAIL_FROM="Topi <hola@mail.<dominio>>"`, `MAIL_REPLY_TO`, `MAIL_DAILY_QUOTA=100`,
`MAIL_ONLY_TO` (lista permitida fuera de prod), `APP_BASE_URL`.

## Arquitectura (API en Go)
- Puerto `domain.Mailer` (`Send(ctx, Message) (providerID, error)`), adaptadores `adapter/mail/resend` y
  `adapter/mail/logmailer` (local: escribe en el log, **no envía**).
- **Outbox**: tabla `email_outbox` (id, user_id, to, template, payload jsonb sin datos sensibles, priority,
  status `pending|sending|sent|failed|suppressed`, attempts, send_after, provider_id, last_error,
  created_at, sent_at). Un proceso en la API toma lotes con `FOR UPDATE SKIP LOCKED`, respeta
  `MAIL_DAILY_QUOTA` (los transaccionales de prioridad 1 siempre primero), reintenta con backoff y marca
  `failed` tras N intentos.
- Plantillas con `html/template` + versión texto, embebidas (`embed`), en español, con la paleta de marca,
  sin imágenes remotas pesadas. Asuntos sin montos ni comercios.
- Webhook `POST /mail/webhook/resend` con verificación de firma: rebote duro o queja → `users.email_status`
  = `bounced|complained` y no se le envía más (salvo recuperación de contraseña si el usuario la pide).
- Preferencias: columnas o tabla `notification_prefs` (`email_monthly_summary`, `email_connection_alerts`,
  `email_product_news=false`). Enlace de baja firmado sin login + cabeceras `List-Unsubscribe` y
  `List-Unsubscribe-Post` en los no transaccionales.

## Casos de uso v1
1. **Recuperar contraseña con código** (reemplaza el flujo del admin):
   `POST /auth/password/forgot` (respuesta idéntica exista o no el correo), código de 6 dígitos guardado
   como hash, vence en 10 min, 5 intentos, límite por IP y por correo; `POST /auth/password/reset` con
   código → nueva contraseña, sube `TokenVersion` (cierra sesiones). Front: `ForgotPassword.jsx` con los
   dos pasos (hoy muestra un mailto al soporte).
   **Seguridad**: `set-initial-password` hoy deja crear contraseña sin código a usuarios sin contraseña.
   Con correo disponible, ese flujo debe pedir el código enviado al correo (o cerrarse con
   `InitialPasswordUntil`). El script del admin queda como respaldo.
2. **Verificar correo al registrarse** (campo `Verified` ya existe): enlace/código; no bloquear a usuarios
   migrados ni existentes.
3. **Conexión de correo caída**: cuando una conexión pasa a error de credenciales (códigos que ya usa el
   front), un correo "Topi dejó de leer tu correo X, reconéctalo" con enlace a Conexiones. Máximo uno por
   conexión cada 7 días. Es el aviso más valioso: hoy la app deja de funcionar en silencio.
4. **Resumen mensual** (día 1, **desactivado por defecto**: lo activa el usuario en el front; con baja en un clic): ingresos, gastos, ahorro,
   categoría donde más gastó y enlace al Inicio. Repartido en los primeros días del mes según la cuota.
5. (Lo usa el modelo de negocio) **Recibos y avisos de pago**: plantilla genérica `billing_*` lista para N1/N3.

## Restricciones
- Privacidad: en local y en desarrollo `MAIL_PROVIDER=log`; si se usa `resend` fuera de prod, solo a
  `MAIL_ONLY_TO`. Nunca se envía el cuerpo de correos bancarios ni datos de tarjeta.
- Actualizar `CLAUDE.md`: reemplazar "Nada de envío de correos" por la regla nueva (solo vía `Mailer` +
  outbox, proveedor Resend, `log` en local, `MAIL_ONLY_TO` fuera de prod).
- Migraciones con `down`. Cero secretos.

## Criterios de aceptación
- [x] `Mailer` con adaptadores `log` y `resend`; outbox con cuota diaria, prioridad, reintentos (tests).
- [x] Recuperar contraseña por código de punta a punta (tests de vencimiento, intentos, enumeración y
      límite); sesiones viejas invalidadas.
- [x] `set-initial-password` ya no permite crear contraseña sin probar el control del correo.
- [x] Verificación de correo para usuarios nuevos sin afectar a los existentes.
- [x] Aviso de conexión caída con límite de 1 cada 7 días.
- [x] Resumen mensual con baja en un clic y `List-Unsubscribe`.
- [x] Webhook con firma inválida → 401; rebote suprime envíos.
- [x] Runbook con pasos de DNS y Resend; variables en `.env.example` y Coolify.
- [x] `go test ./...`, jest y `npm run build` verdes; `CLAUDE.md` actualizado.

## Decisiones (7-nov-2026)
- Remitente `Topi <hola@mail.topi.cash>` (subdominio `mail.topi.cash`); `MAIL_REPLY_TO=cashflowapp2024@gmail.com`.
- `MAIL_ONLY_TO=cashflowapp2024@gmail.com` fuera de prod.
- Resumen mensual opcional: desactivado por defecto para todos, el usuario lo activa en el front. Más adelante,
  con métricas de uso, se podrá activar para usuarios activos.
- Usuarios sin contraseña (migrados o reseteados): el front los lleva a recuperar la contraseña con código por
  correo; `set-initial-password` sin código se cierra.
- Migraciones: 000038 es de patrimonio (`net_worth_history`); correo usa la 000039; modelo de negocio, 000040+.

## Estado (7-nov-2026, rama feat/correo)
Criterios verificados con `go test ./...`, integración (Postgres 16 local con `schema_v17.sql`), jest, `npm run build`
y un E2E contra la API local con `MAIL_PROVIDER=log` (40 comprobaciones: registro y verificación, recuperar sin
enumeración, token viejo inválido, 5 intentos, límite de 3 códigos/15 min, migrado sin contraseña, aviso único de
conexión, resumen con baja one-click, webhook 401/200 y supresión por rebote). Falta lo manual de RUNBOOK B8
(Resend, DNS, Coolify, webhook) y probarlo en producción.
- Vistas previas: `MAIL_PREVIEW_DIR=<dir> go test -run TestWritePreviews ./internal/adapter/mail/templates/`.
- Swagger (`apps/api/docs`) no se regeneró: estaba desactualizado desde antes y regenerarlo mete ~9.500 líneas ajenas.
