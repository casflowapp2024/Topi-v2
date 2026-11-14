# Prompt para Claude Code — Lanzamiento público (etapa 3)

> Abre Claude Code en `C:\Users\juanm\WorkSpace\topiv2\topi` y pega lo de abajo.

---

Vamos con la etapa 3 del modelo de negocio de Topi: el lanzamiento público. Hoy, aparte del equipo, hay 1 usuario
activo: hay que arreglar lo que hace que la gente se vaya (lectura que no arranca, conexiones que se caen en
silencio), abrir la puerta (verificación de Google, página pública) y salir por etapas midiendo con la North Star.

Lee completos `CLAUDE.md`, `plan/27-lanzamiento.md` (la especificación), `plan/25-admin-metricas.md` (métricas y
panel), `plan/23-correo-transaccional.md` (Mailer, outbox, plantillas) y `plan/22-modelo-negocio.md` (orden de
etapas; Apoyar a Topi queda apagado con `SUPPORT_ENABLED=false`).

Restricciones críticas:
1. Privacidad: nada de nombres, correos ni montos de usuarios en planes, eventos, logs ni en el outbox. Los correos
   de ejemplo de bancos (§C) llegan al buzón del equipo; **la app nunca guarda cuerpos de correo en la base**.
   `product_events` con lista cerrada y props solo ids/enums. Todo lo nuevo del panel admin, auditado.
2. Seguridad primero (§H): las rutas que usa el worker aceptan solo `X-API-Key`; un JWT, aunque sea de admin,
   recibe 403. Las rutas sin uso se eliminan. Tests que lo prueben.
3. Correos solo por `Mailer` + `email_outbox`, respetando preferencias, bajas, cuota y dedupe. La reactivación (§G)
   es **uno a uno con vista previa**, nunca masiva, y bloqueada para conexiones caídas hasta que §D esté en producción.
4. Nada de Plus, precios ni Apoyar a Topi en la landing ni en la app. No enciendas `SUPPORT_ENABLED`.
5. Migraciones desde el siguiente número libre en `main` (después de 000045), siempre con `down`. Variables nuevas
   documentadas en `.env.example`, `infra/coolify/api.env.template` y el RUNBOOK.
6. La verificación de Google (§A) la hace JuanMa en Google Cloud Console: tú preparas lo que depende del código
   (landing, Política de privacidad con "Limited Use", textos) y la lista de pasos; no supongas su estado, pregúntalo.
7. Cero secretos, nada de AWS, no toques los repos viejos ni el dump.

Forma de trabajo:
- Rama `feat/lanzamiento` desde `main`.
- Primero un plan corto por bloque: tablas y columnas nuevas, endpoints, eventos, plantillas de correo, componentes
  del front y cómo lo vas a probar. Espera mi OK.
- Orden con commits pequeños, uno o más por bloque: (0) diagnóstico como script SQL agregado; (H) seguridad de rutas;
  (D) conexión caída en la app; (B) bienvenida y estado de lectura; (C) banco no soportado; (E) opiniones;
  (F) landing; (G) reactivación personal; (I) métricas de paso por etapa en el panel.
- Tras cada bloque: `go test ./...` (e integración si tocas repositorios), tests del worker si lo tocas, jest y al
  final `npm run build`.
- Pruebas de punta a punta en local con `MAIL_PROVIDER=log`, usuarios ficticios y una copia del dump restaurada;
  nunca con correos reales de usuarios. Capturas de cada vista nueva en móvil y PC, claro y oscuro, y Lighthouse móvil
  de la landing.
- Al final verifica los criterios de aceptación de `plan/27-lanzamiento.md`, márcalos con su evidencia y muéstrame
  comandos, salidas resumidas y capturas. No hagas merge a `main` hasta que yo lo pruebe.
- Recuérdame lo manual: verificación de Google (marca, acceso a datos, CASA), buzón de soporte para correos de
  ejemplo y variables en Coolify.
