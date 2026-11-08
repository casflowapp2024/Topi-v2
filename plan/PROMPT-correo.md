# Prompt para Claude Code — Correo transaccional

> Abre Claude Code en `C:\Users\juanm\WorkSpace\topiv2\topi` y pega lo de abajo.
> Si corres en paralelo con el modelo de negocio, usa otro worktree: `git worktree add ../topi-correo -b feat/correo main`.

---

Vamos a habilitar el envío de correos en Topi con Resend, de forma controlada: recuperar contraseña con
código, verificar correo, aviso de conexión caída y resumen mensual.

Lee completos `CLAUDE.md` y `plan/23-correo-transaccional.md` (la especificación: proveedor, arquitectura
con outbox, casos de uso, restricciones y criterios de aceptación). Mira `apps/api/internal/core/service/user.go`
(flujo `SetInitialPassword`, `TokenVersion`), `apps/web/src/containers/ForgotPassword.jsx` y cómo se marcan
hoy las conexiones con error de credenciales.

Restricciones críticas:
1. Este cambio reemplaza la regla "Nada de envío de correos" de `CLAUDE.md`: actualízala con la regla nueva
   descrita en el plan en el mismo PR.
2. Todo envío pasa por el puerto `Mailer` y la tabla `email_outbox`. En local y desarrollo
   `MAIL_PROVIDER=log` (no envía nada); fuera de prod con `resend` solo a `MAIL_ONLY_TO`. No uses SMTP.
3. Recuperación de contraseña: sin enumeración de usuarios, código con hash, vencimiento, intentos y límite
   de tasa; al cambiarla se invalidan las sesiones. Cierra el hueco de `set-initial-password` sin código
   como dice el plan; si eso puede dejar a usuarios migrados sin forma de entrar, explícame la transición y
   espera mi OK.
4. Nada de datos sensibles en asuntos ni en el payload del outbox; nunca contenido de correos bancarios.
5. Migración **000039** (una sola, con `down`). La 000038 es de patrimonio; la 000040+ la reserva el plan de modelo de negocio.
6. Webhook de Resend con verificación de firma; rebotes y quejas suprimen envíos.
7. Cero secretos (las llaves van en Coolify y en `.env.example` como placeholder), nada de AWS, no toques
   los repos viejos ni el dump.

Forma de trabajo:
- Rama `feat/correo` desde `main`.
- Primero dame un plan corto: tablas, endpoints, archivos, plantillas y la transición de
  `set-initial-password`. Espera mi OK.
- Orden con commits pequeños: (1) `Mailer` + adaptadores + outbox + cuota; (2) recuperar contraseña y
  front; (3) verificación de correo; (4) aviso de conexión caída; (5) resumen mensual + preferencias y baja;
  (6) webhook; (7) runbook, variables y `CLAUDE.md`.
- Tras cada bloque: `go test ./...` (y los de integración si tocas repositorios), jest y al final
  `npm run build`.
- Al final verifica los criterios de aceptación del plan y márcalos; muéstrame comandos y salidas
  resumidas y una vista previa HTML de cada plantilla. Dame la lista exacta de pasos manuales que debo hacer
  en Resend, el DNS y Coolify. No hagas merge a `main` hasta que yo lo pruebe.
