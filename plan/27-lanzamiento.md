# Lanzamiento público (etapa 3 del modelo de negocio)

Por qué ahora: el panel admin muestra que, aparte del equipo, **hay 1 usuario activo**. Antes de pedir apoyo
(etapa 2, implementada y apagada con `SUPPORT_ENABLED=false`) o de vender Plus (etapa 5) hace falta tracción.
Este plan arregla lo que hace que la gente se vaya (lectura que no arranca, conexiones que se caen en silencio),
abre la puerta (verificación de Google, página pública) y sale por etapas midiendo con la North Star del plan 25
("usuarios al día semanales", UAS).

Orden de etapas actualizado en `22-modelo-negocio.md`: 1 medir (hecha) → 2 Apoyar a Topi (apagada) →
**3 lanzamiento** → 4 Fase 4 en beta → 5 Plus.

## Diagnóstico (copia local del dump, 14-nov-2026)

Consulta agregada sobre la copia del dump restaurada en local y migrada por la API (`topi_val`), sin nombres ni
correos (SQL en la sección "Cómo se calculó"). **El último dato del dump es del 17-oct-2026**, antes de reanudar la
lectura en Hetzner: sirve para ver de dónde se fue la gente; el estado de hoy es el del panel admin en producción.
Incluye las cuentas del equipo.

| Métrica (a 17-oct-2026) | Usuarios |
|---|---|
| Registrados | 56 |
| Sin ninguna conexión de correo | 36 (5 de ellos registran a mano) |
| Con conexión | 20 (gmail 15 conexiones, outlook 8) |
| — conexión sana | 9 |
| — conexión caída (error de credenciales u otro) | 3 |
| — conexión desactivada sin error | 8 (5 leían antes; mediana de la última lectura: ~5,6 meses antes del corte) |
| **A. Se fueron por conexión caída** (caída, leía antes, 0 lecturas en 30 días) | **3** |
| **B. Conexión pero 0 transacciones leídas en toda su historia** | **7** (4 con la conexión sana: banco no soportado o correos que no llegan) |
| **C. Reciben lectura (≥ 1 automática en 30 d) pero no abrieron la app en 30 d** | **3** |
| "Al día" en 30 días (lectura + app abierta) | 2 |
| Activos en la app en 30 días (cualquier uso) | 3 |
| Transacciones automáticas / total | 7.485 / 8.748 (86 %) |

Lectura del diagnóstico:
- El embudo se rompe **antes** de la lectura: 36 de 56 nunca conectaron un correo → activación guiada (B).
- De los que conectaron, más de la mitad no tiene la lectura funcionando (3 caídas + 8 desactivadas + 4 sanas sin
  ninguna transacción) → banco no soportado (C) y conexión caída (D).
- Los que sí reciben lectura casi no abren la app → valor visible al entrar (Fase 4) y reactivación personal (G).
- La actividad anterior a la etapa 1 es aproximada (`user_activity_days` reconstruida con refresh tokens, logins y
  días con movimientos a mano; ver plan 25).

### Cómo se calculó
`pg_restore` del dump (sin entradas `cron`) en un Postgres 16 local, la API arrancada contra esa base para aplicar
las migraciones 18–45, y una sola consulta con CTE por usuario sobre `emails` (`active`, `error`), `transactions`
(`automated`, `created_at`) y `user_activity_days`, que devuelve solo conteos. Ventana de 30 días hacia atrás desde
el último `transactions.created_at`. La consulta queda como `infra/scripts/sql/launch-diagnostic.sql` en la
implementación (bloque 0) para repetirla en producción con `infra/scripts/prod/`.

## A. Verificación de Google (bloqueante)

`gmail.readonly` es un **alcance restringido**. Estado actual (captura de JuanMa del Centro de verificación de Google
Auth Platform, 14-nov-2026):
- **Branding status**: se envió a verificación antes y **no se aprobó**; la información de la marca no se muestra a
  los usuarios.
- **Data access status**: se envió antes y **no se aprobó**; "Debes verificar y publicar la información de tu marca
  antes de solicitar la verificación".
- **Estado de publicación: En producción, sin verificar** (Google Auth Platform → Público, 14-nov-2026), usuarios
  externos. Aviso: "Tu app requiere una verificación".
- **Límite de usuarios de OAuth: 18 de 100 usados.** El límite cuenta a todos los que han dado permiso en la vida del
  proyecto y **no se puede restablecer**: quedan **82 cupos** hasta que Google apruebe la verificación. Cada cuenta de
  Gmail nueva que conecte (incluidas las del equipo y las pruebas) gasta uno.

Qué implica cada estado ([Manage App Audience](https://support.google.com/cloud/answer/15549945?hl=es),
[production readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)):
- **Testing**: solo usuarios agregados a mano como testers (máx. 100) y la autorización **vence a los 7 días**
  (también el refresh token): la lectura se cae sola cada semana. Es compatible con "conexión desactivada" del
  diagnóstico.
- **Producción sin verificar**: pantalla de "app no verificada" y tope de **100 usuarios nuevos en total** (de por
  vida, no se reinicia al quitar usuarios).
- **Verificada**: sin advertencia ni tope.

Pasos para verificar:
1. **Marca**: dominio `topi.cash` verificado en Search Console con la cuenta dueña del proyecto; página de inicio
   pública (F) en ese dominio que explique la app y enlace la Política de privacidad; Política de privacidad en el
   mismo dominio que diga qué se lee de Gmail, para qué, que no se guarda el cuerpo de los correos, y que cumple la
   [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy) con su
   sección "Limited Use"; logo, nombre "Topi" y correo de soporte coherentes. Enviar la marca y esperar aprobación.
2. **Acceso a datos**: justificar `gmail.readonly` (por qué no basta un alcance menor), video de YouTube (no listado)
   que muestre el flujo completo de consentimiento y el uso de los datos en la app, y la URL de la política.
3. **Evaluación de seguridad CASA** (alcance restringido con datos guardados o transmitidos en el servidor): Tier 2
   con un laboratorio autorizado (Google suele remitir a TAC Security). Se repite **cada 12 meses**
   ([Google, revalidación anual](https://support.google.com/cloud/answer/13465431)).

Tiempos y costos aproximados (fuentes de terceros, a confirmar al iniciar):
- CASA Tier 2: desde **USD 540 por app al año** en el plan básico de TAC; otros laboratorios cobran más; rango
  reportado USD 500–4.500 según el nivel ([switchlabs](https://www.switchlabs.dev/post/casa-tier-2-tier-3-security-review-providers-pricing-and-the-cheapest-option),
  [openwearables](https://openwearables.io/blog/google-casa-oauth-verification-health-apps),
  [nango](https://nango.dev/docs/api-integrations/google-shared/google-security-review)).
- Tiempo: revisión de marca días; acceso a datos + CASA entre 2–3 semanas y 4–6 semanas si hay idas y vueltas.
  Presupuestar **6–8 semanas** de calendario y el costo anual de CASA en el modelo de negocio (es el costo fijo más
  grande).

Mientras tanto:
- **Priorizar Outlook** en la bienvenida para quien tenga Hotmail/Outlook (Microsoft no tiene un tope equivalente
  para apps multi-inquilino; la verificación de editor de Microsoft es gratuita, a confirmar), y registrar a mano
  como testers a los primeros usuarios de Gmail.
- **Cuidar los 82 cupos**: no probar con cuentas de Gmail nuevas (usar las que ya consintieron), y que I.1 y I.2
  sumen como máximo ~70 cuentas de Gmail nuevas, dejando un margen para soporte. Contar los cupos en el panel admin
  (conexiones Gmail distintas) y revisar el contador de Google Auth Platform → Público cada semana.
- Avisar en la app, antes del consentimiento, que Google mostrará "app no verificada" mientras la verificación está
  en curso, y cómo continuar ("Configuración avanzada" → "Ir a Topi"), para que no abandonen ahí.
- Al estar En producción, los tokens no vencen a los 7 días (eso solo pasa en Testing): **no volver al modo de
  prueba**.

## B. Bienvenida guiada (activación)

Meta: registro → correo conectado → **primera transacción automática en < 48 h** (métrica de activación del plan 25).
- Reemplazar el onboarding actual (`hocs/Onboarding2`, `components/onboarding2/*`) por una **checklist en el Inicio**:
  1) conectar correo, 2) primera transacción leída, 3) revisar Por revisar, 4) primer presupuesto. Cada paso con su
  estado real (de la API, no del front) y que se oculta al completarse.
- Estado **"Leyendo tus correos…"** tras conectar: qué banco se espera, cuándo se leyó por última vez y que la
  primera lectura trae los últimos días. El worker ya prioriza (`email_jobs.priority=1`); falta exponer el estado
  (`GET /email/status`: última lectura, correos procesados, transacciones creadas, sin contenido).
- Elegir proveedor según el dominio del correo del usuario (outlook/hotmail/live → Outlook primero; ver A).
- Eventos (lista cerrada): `onboarding_step_completed {step}`.
- Métricas en el panel: % con conexión en 24 h, % con 1.ª automática en 48 h, mediana de horas hasta la 1.ª.

## C. Banco no soportado

Si una conexión sana lleva **48 h sin crear transacciones** (desde que se conectó o desde la última):
- **En la app**: aviso en el Inicio "Todavía no vemos movimientos de tu banco" con la lista de bancos soportados
  (`GET /banks/official`) y qué hacer.
- **Correo** (una vez por conexión, plantilla nueva `bank_unsupported`, por el `Mailer` + outbox, prioridad 3,
  respetando preferencias y bajas): mismo mensaje y enlace a la app.
- **Correo de ejemplo**: pedir que **reenvíe** un correo de notificación de su banco a una dirección de soporte del
  equipo (p. ej. `bancos@topi.cash`, buzón del equipo fuera de la app). **Topi no guarda el cuerpo de esos correos en
  la base** (`CLAUDE.md`): llegan al buzón del equipo, se usan para agregar el banco y se borran. La app solo
  registra el evento `bank_sample_requested {bank_id}`.
- Panel admin → Lectura: conexiones sanas sin transacciones por más de 48 h y por banco declarado (k ≥ 5 para mostrar
  nombres).

## D. Conexión caída

Hoy hay correo (`PUT /email/admin/error/:id`, 1 cada 7 días). Falta la app:
- **Banner persistente** arriba en todas las vistas mientras haya una conexión con error de credenciales:
  "Topi dejó de leer <proveedor>" + botón **Reconectar** que abre directo el OAuth del proveedor (un toque, sin pasar
  por Conexiones). Se puede ocultar 24 h, no para siempre.
- Al reconectar: limpiar `emails.error`, encolar lectura prioritaria y mostrar el estado de B.
- **Métrica**: tiempo desde `error` hasta reconectar (mediana y % reconectado en 7 días). Requiere guardar cuándo
  ocurrió el error (`emails.error_at`) y el evento `connection_reconnected`.
- En Testing (A) la caída semanal es esperable: el texto no culpa al usuario.

## E. "¿Qué le falta a Topi?"

- Botón en el menú de usuario → hoja con un texto corto (máx. 500 caracteres), opcionalmente "¿podemos escribirte?".
- Tabla nueva `feedback (id, user_id, text, contact_ok, app_version, created_at, read_at)`. Sin datos financieros:
  el texto lo escribe el usuario; se le advierte que no ponga datos bancarios. Límite: 3 por día por usuario.
- Panel admin → **Opiniones**: lista con fecha, id corto del usuario y texto; marcar como leída. Acceso auditado.
- Aviso al admin por correo (plantilla `admin_feedback`, al `MAIL_REPLY_TO` del equipo): solo "hay N opiniones
  nuevas" con enlace al panel, **sin el texto** (nada sensible en el outbox), máximo 1 por hora.

## F. Página de inicio pública

`Landing.jsx` existe; rehacerla para el lanzamiento y para la verificación de Google (A):
- Qué hace Topi (lee las notificaciones de tus bancos y arma tus finanzas sin digitar), **qué lee y qué no lee**
  (solo correos de remitentes bancarios configurados; no guarda el cuerpo; no puede enviar correos ni mover dinero),
  seguridad (acceso de solo lectura, el token de acceso queda solo en el servidor, desconectar en un clic; hoy los
  tokens OAuth no están cifrados en la base: cifrarlos antes de prometerlo), **bancos soportados** (de `banks/official`),
  privacidad y términos, preguntas frecuentes y botón de registro.
- SEO básico: título y descripción por ruta, Open Graph, `robots.txt`, `sitemap.xml`, datos estructurados
  `SoftwareApplication`, contenido en HTML (prerender de la landing en el build; CRA no hace SSR).
- Rápida en móvil: Lighthouse móvil ≥ 90 en rendimiento y accesibilidad; imágenes livianas; sin cargar el bundle de
  la app en la landing si se puede (división de código).

## G. Reactivación personal

- Plantilla editable `reactivation_personal` con la voz de JuanMa: "Rehicimos Topi desde cero… ¿qué te hizo dejar de
  usarla?" y, como **agradecimiento** (no gancho), que por haber estado desde el principio es fundador. Asunto y texto
  editables en el panel antes de enviar.
- **Uno a uno desde el panel admin** (Usuarios → "Escribirle"), con vista previa del correo final; nunca masivo
  (sin selección múltiple; límite de N por día configurable). Se registra en `admin_audit` y en el outbox con su
  dedupe (no se repite a la misma persona en 90 días).
- Regla: **a quien tenga la conexión caída no se le escribe** hasta que D esté en producción (el correo lo llevaría a
  una app que no le funciona). El botón se deshabilita con el motivo.
- Respuesta: `MAIL_REPLY_TO` (buzón del equipo); lo que responda se resume a mano en E.

## H. Seguridad pendiente

Rutas "admin" anteriores al panel, protegidas solo por `AdminMiddleware` (rol admin **o** la `X-API-Key` del worker),
sin `admin_audit`:

| Ruta | Quién la llama (verificado en el código) | Acción |
|---|---|---|
| `GET /accounts/admin/list` | worker (`api_client.py`, cuentas con lectura) | solo servicio |
| `GET /accounts/admin/list/by-bank` | nadie (ni worker, ni web, ni scripts) | eliminar |
| `POST /transactions/admin/create` | worker (crea las automáticas) | solo servicio |
| `GET /email/:user_id/:id` | worker (pide el token OAuth del correo) | solo servicio — **hoy un admin humano con su JWT puede leer el token OAuth de cualquier usuario** |
| `PUT /email/admin/error/:id` | worker (marca la conexión caída) | solo servicio |
| `PUT /user-extra/admin/read-email` | worker (onboarding) | solo servicio |
| `DELETE /user-extra/admin/:id` | nadie | eliminar |
| `POST/PUT/DELETE /account-types/admin*` | nadie | eliminar (los tipos van por migración) |

- Nuevo `ServiceOnlyMiddleware`: acepta solo `X-API-Key` (payload `service`) y rechaza cualquier JWT, también el de
  un admin. Las rutas del worker pasan a él; si alguna vez un humano necesita algo de esto, va bajo `/admin` con
  `AdminAuditMiddleware`.
- Tests: JWT de admin → 403 en las rutas de servicio; `X-API-Key` → 200; rutas eliminadas → 404. Revisar también
  `/init/data` (`InitDevHandler`): debe existir solo fuera de producción.

## I. Despliegue por etapas

| Etapa | Quién | Duración | Pasa a la siguiente si… |
|---|---|---|---|
| I.1 Cercanos | 20–30 personas cercanas, con seguimiento 1 a 1 (y reactivación G de antiguos) | 2–3 semanas | ≥ 60 % con correo conectado en 24 h; ≥ 50 % con 1.ª automática en 48 h; UAS ≥ 10; 0 errores graves abiertos |
| I.2 Comunidades | Comunidades de finanzas personales en Colombia (grupos, foros, creadores pequeños) | 4 semanas | UAS ≥ 50 sostenido 2 semanas; retención S4 ≥ 30 %; costo por usuario activo dentro del presupuesto |
| I.3 Abierto | Registro abierto, landing con SEO | continuo | UAS ≥ 50 durante 4 semanas → encender Apoyar a Topi (`SUPPORT_ENABLED=true`) |

- Con Google sin verificar (A), I.1 y I.2 deben caber en los **82 cupos restantes** de Gmail (Outlook no gasta
  cupos); **I.3 requiere la verificación aprobada**.
- Se mide con el panel (plan 25): North Star UAS, activación (conexión 24 h, 1.ª automática 48 h, presupuesto 7 d),
  salud de lectura, conexiones caídas y tiempo a reconectar (D), opiniones (E).

## Orden sugerido de implementación

0. Diagnóstico como script (`infra/scripts/sql/launch-diagnostic.sql`) y su versión para producción.
1. **H** (seguridad; pequeño y no depende de nada).
2. **D** (conexión caída en la app: lo que más gente pierde).
3. **B** (bienvenida y estado de lectura) + **C** (banco no soportado: comparte el estado de lectura).
4. **E** (opiniones) — antes de invitar a nadie.
5. **F** (landing) — en paralelo, es requisito de **A**.
6. **A** (enviar marca + acceso a datos + CASA) apenas F y la Política estén publicadas.
7. **G** (reactivación) solo con D en producción.
8. **I.1** → I.2 → I.3.

## Criterios de aceptación
- [ ] Diagnóstico reproducible con un script SQL agregado (sin nombres ni correos) y corrido en producción.
      (Script: `infra/scripts/sql/launch-diagnostic.sql` + `infra/scripts/prod/launch-diagnostic.sh`; en la copia del
      dump con `as_of=2026-10-17` da exactamente la tabla de arriba. **Falta correrlo en producción.**)
- [x] A (estado): En producción sin verificar, 18/100 usuarios de OAuth (14-nov-2026).
- [ ] A: marca y acceso a datos enviados; CASA contratada o descartada con decisión
      escrita; mientras tanto, tope de 100 usuarios de Gmail controlado.
- [ ] B: checklist en el Inicio con estado real; "Leyendo tus correos…"; métrica "1.ª automática en 48 h" en el panel.
- [ ] C: aviso en app y un correo por conexión tras 48 h sin transacciones; lista de bancos soportados; ningún cuerpo
      de correo guardado en la base (test/revisión).
- [ ] D: banner persistente con Reconectar en un toque; `error_at`; métrica de tiempo a reconectar.
- [ ] E: opiniones en el panel (auditado), límite por usuario, aviso por correo sin el texto.
- [ ] F: landing con qué lee/qué no lee, bancos, privacidad, FAQ; Lighthouse móvil ≥ 90; `robots.txt` y `sitemap.xml`.
- [ ] G: envío uno a uno con vista previa, dedupe de 90 días, bloqueado para conexiones caídas sin D.
- [ ] H: rutas del worker solo con `X-API-Key` (JWT de admin → 403, test); rutas sin uso eliminadas.
- [ ] I: métricas de paso por etapa visibles en el panel; decisión de pasar de etapa anotada aquí con fecha.
- [ ] Migraciones con `down`; `go test ./...`, tests del worker, jest y `npm run build` verdes; cero secretos.
