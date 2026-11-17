# 29. Prueba local de punta a punta del onboarding (con lectura real)

Rama `feat/lanzamiento` (plan 27, sin merge). Objetivo: que JuanMa recorra la bienvenida como un usuario nuevo,
con un correo real del equipo leído por el worker, y vea salir cada aviso (lectura, conexión caída, banco no
soportado) en la app, en el correo y en el panel admin. Hasta ahora solo se probó con datos sembrados por SQL.

Reglas que mandan (CLAUDE.md): en local solo se lee **una conexión del equipo**, primero con `WORKER_DRY_RUN=true`;
cero secretos en el repo; nada de AWS.

## 1. Qué se monta

Todo con prefijo `ob-`, puertos propios para no chocar con otras sesiones ni con el :3000/:8080 de JuanMa.

| Pieza | Cómo | Puerto |
|---|---|---|
| Postgres 16 | `initdb` en el scratchpad (sin Docker), base `topi_ob` cargada con `apps/api/testdata/schema_v17.sql`; la API aplica 18–50 al arrancar | :54462 (el :54452 lo tomó otra sesión) |
| API | `go run ./cmd/http`, `APP_ENV=local`, `MAIL_PROVIDER=log` (fase A) o `resend` + `MAIL_ONLY_TO` (fase B) | :8098 |
| Front | `npm run build` de la rama con `REACT_APP_API_URL=http://localhost:8098`, servido estático por `spa.py` (como nginx) | :3098 |
| Worker | venv con Python 3.11 local, `python -m worker run`, `WORKER_DRY_RUN=true` y `WORKER_ONLY_EMAIL_IDS=<id>` | — |

- `.claude/launch.json` (en `topiv2/`): entradas `ob-api` y `ob-web`, que corren scripts del scratchpad con Git
  Bash. El worker no tiene puerto: corre con `run-ob-worker.sh` en una pestaña de Terminal, para ver su log.
- Modos que se cambian sin tocar código, en archivos del scratchpad: `ob-mode.env` (`MAIL_PROVIDER` y
  `MAIL_ONLY_TO`) y `ob-worker.env` (`WORKER_DRY_RUN` y `WORKER_ONLY_EMAIL_IDS`).
- **Secretos:** JuanMa crea `C:\Users\juanm\WorkSpace\topiv2\ob-secrets.env`, que queda fuera del repo, junto a
  `mp-sandbox.env`. Los scripts lo cargan y yo no lo leo ni lo copio. Lleva:
  ```
  GMAIL_CLIENT_ID=...
  GMAIL_CLIENT_SECRET=...
  GMAIL_PROJECT_ID=...
  OUTLOOK_CLIENT_ID=...        # solo si se prueba Outlook
  OUTLOOK_CLIENT_SECRET=...
  GEMINI_API_KEY=...           # proyecto con facturación (Uso limitado)
  RESEND_API_KEY=...           # solo para la fase B
  ```
  El resto (JWT, `INTERNAL_API_KEY`, base) son valores de prueba que genero yo en el scratchpad.
- **Usuario de prueba:** se registra desde la app, no por SQL. Con `MAIL_PROVIDER=log` el código de verificación
  sale en el log de la API (`APP_ENV=local`). Después lo hago admin con `make-admin` en la base local.
- **Guardas de los scripts:** el worker **no arranca** si `WORKER_ONLY_EMAIL_IDS` está vacío (vacío = todas las
  conexiones) ni si la base no es `topi_ob`. La API con `resend` no arranca sin `MAIL_ONLY_TO` (ya lo hace el código).

## 2. OAuth en localhost (lo hace JuanMa)

Se usa el **mismo cliente OAuth de producción** y solo se agrega una URI más; no se quita nada. La URI debe coincidir
exacta, sin barra final: `http://localhost:3098/gmail-auth-connect`.

**Google Cloud** (proyecto de Topi):
1. Console → *APIs y servicios* → *Credenciales* → el cliente OAuth 2.0 de tipo *Aplicación web* que usa producción.
2. *Orígenes autorizados de JavaScript* → *Agregar URI* → `http://localhost:3098`.
3. *URIs de redireccionamiento autorizados* → *Agregar URI* → `http://localhost:3098/gmail-auth-connect`.
4. *Guardar*. Puede tardar entre 5 minutos y unas horas en aplicarse. Si sale `redirect_uri_mismatch`, es que aún no
   se aplicó.
5. Nada en la pantalla de consentimiento: sigue sin verificar (18/100).

**Azure** (registro de la app de Outlook):
1. portal.azure.com → *Microsoft Entra ID* → *Registros de aplicaciones* → la app de Topi → *Autenticación*.
2. En la plataforma **Web** (no SPA) → *Agregar URI* → `http://localhost:3098/gmail-auth-connect` → *Guardar*.
   Azure acepta `http` solo para `localhost`.

Atajo: si `http://localhost:3000/gmail-auth-connect` ya está registrada, se puede servir el front de prueba en :3000
mientras el front de JuanMa esté apagado. Recomiendo agregar :3098 para no depender de eso.

## 3. Qué cuenta conectar

- **Recomendado: Gmail del equipo que ya dio permiso** (la que ya está conectada en producción, o
  `cashflowapp2024@gmail.com` si recibe notificaciones de un banco soportado). Volver a autorizar con un usuario que
  ya autorizó no gasta otro de los 100 cupos.
- **Alternativa: Outlook**, que no gasta cupos. Sirve si a esa cuenta le llegan notificaciones de un banco.
- Requisitos:
  - Que al buzón le lleguen notificaciones de un banco soportado de los últimos días (la primera lectura trae
    los últimos días).
  - Para la fase de banco no soportado, ligar además una cuenta de un banco que no esté en la lista, o probarla en
    una segunda conexión.
- Leer el buzón desde local no afecta a producción, porque es solo lectura, y la conexión de producción sigue igual.
  **No revocar el acceso de Topi** en la cuenta de Google o Microsoft para provocar la caída: revocar invalida todos
  los tokens del cliente, también el de producción. La caída se provoca solo en la base local (§5).

## 4. Guion paso a paso

Fase A con `MAIL_PROVIDER=log`. En cada paso: qué hace JuanMa, qué debería ver y qué reviso yo en log o SQL.

1. **Registro** en `http://localhost:3098`: landing → *Crear cuenta* con un correo de prueba (en la fase B, uno de
   `MAIL_ONLY_TO`). Código de verificación: lo copio del log de `ob-api`.
2. **Inicio → "Empieza con Topi"**: 0 de 4, siguiente paso *Conecta tu correo*. Yo reviso `GET /onboarding/status`.
3. **Conectar correo**: *Conectar correo* → proveedor y dirección → popup de Google.
   - Sale **"Google no verificó esta app"** → *Configuración avanzada* → *Ir a Topi (no seguro)* → permitir lectura.
   - Anotar si el texto de ayuda de `GoogleUnverifiedHint` alcanza para entender qué hacer.
   - Al volver: el paso 1 queda hecho y aparece el aviso **"no tiene cuentas ligadas"**.
   - Yo saco el `emails.id` de la conexión nueva y lo pongo en `WORKER_ONLY_EMAIL_IDS`.
4. **Cuenta ligada**: *Cuentas* → crear la cuenta del banco que notifica a ese correo, ligada a esa conexión. El
   aviso cambia a **"Leyendo tus correos…"**, con "Esperamos movimientos de <banco>" y "La primera lectura empieza en
   unos minutos".
5. **Worker en DRY_RUN**: arranco `ob-worker`. Toma el job prioritario del registro, lee y extrae, pero no crea nada.
   - Reviso en el log qué correos encontró y qué transacciones habría creado (sin montos en este plan).
   - La app sigue en "Leyendo…", porque en DRY_RUN no se mueve `last_run`.
6. **Worker real**: con el OK de JuanMa sobre lo que se vio en el paso 5, lo reinicio con `WORKER_DRY_RUN=false` y
   la misma conexión.
   - Aparece el **primer movimiento** y el paso 2 queda hecho.
   - El aviso de lectura se va (estado `ok`) y "Última lectura hace N min" se actualiza.
7. **Por revisar**: abrir la bandeja, revisar o confirmar lo pendiente (categoría, cuotas si es tarjeta). Se marca
   el paso 3.
8. **Presupuesto**: *Ir a Presupuestos* → poner uno. Se marca el paso 4 y la tarjeta "Empieza con Topi" se oculta.
9. **Opinión**: *¿Qué le falta a Topi?* → mandar una opinión, para verla en el panel.

## 5. Cómo provocar cada aviso

| Aviso | Cómo | Qué se ve |
|---|---|---|
| **Conexión caída (simulada)** | `curl -X PUT localhost:8098/email/admin/error/<id> -H "X-API-Key: <de prueba>" -d '{"error":"token_expired_or_revoked"}'` | Banner arriba con *Reconectar* en un toque; correo `connection_down` en el log (1 cada 7 días por `alert_sent_at`); fila en `connection_incidents` |
| **Conexión caída (real, por el worker)** | En la base local: `UPDATE emails SET refresh_token='revocado', access_token='x' WHERE id=<id>`, y luego encolar la lectura (`python -m worker enqueue-now`) | Google responde `invalid_grant`, el worker llama al mismo endpoint y se ve lo mismo. Producción no se toca |
| **Reconectar** | Tocar *Reconectar* → popup → mismo correo | Mismo `emails.id` y mismas cuentas, incidente cerrado, lectura prioritaria encolada |
| **Banco no soportado** | Conexión sana, con cuenta ligada y sin transacciones automáticas (cuenta de un banco no soportado, o antes del paso 6). `UPDATE emails SET created_at = now() - interval '49 hours' WHERE id=<id>` y reiniciar `ob-api`: el proceso corre al arrancar y luego cada hora | En la app, "Todavía no vemos movimientos de tu banco" + lista de bancos soportados (+ dirección de ejemplos si `BANK_SAMPLES_ADDRESS`); correo `bank_unsupported` en el log, una vez por conexión (`unsupported_alert_at`) |

- **Correos de verdad (fase B):** reinicio `ob-api` con `MAIL_PROVIDER=resend` y `MAIL_ONLY_TO=<correo de JuanMa>`.
  - El usuario de prueba tiene que estar registrado con ese mismo correo; vale un alias `+onb` si se pone igual en
    la lista.
  - Para repetir un aviso: `UPDATE emails SET alert_sent_at=NULL, unsupported_alert_at=NULL WHERE id=<id>`.
  - Ojo: el cupo diario de Resend es de toda la cuenta y lo comparte producción. Son unos 5 correos.

## 6. Panel admin (`/admin`, el usuario de prueba hecho admin)

- **Lectura**: conexiones sanas, caídas e incidentes, con la caída y la reconexión simuladas.
- **Lanzamiento**: criterios de la etapa I.1:
  - correo conectado en 24 h;
  - 1.ª transacción automática en 48 h.

  Con un solo usuario saldrá 100 % o 0 %. Antes, `POST /admin/metrics/refresh`.
- **Opiniones**: la del paso 9, más el aviso `admin_feedback` (solo "hay N", sin texto) en el log.

## 7. Hallazgos

(Se llenan durante la prueba: qué falló o confundió y la propuesta de arreglo.)

1. **Conectar sin `GMAIL_CLIENT_ID` abre Google igual** y el usuario ve "Access blocked: Authorization Error /
   Missing required parameter: client_id (400 invalid_request)". Pasó porque aún no existía `ob-secrets.env`. En
   producción no debería pasar, pero si la variable se pierde en un deploy, cada usuario nuevo choca con una pantalla
   de Google que culpa a la app.
   **Propuesta:**
   - La API valida al arrancar que existan las credenciales de cada proveedor y registra un error si falta alguna.
   - `GET /email/auth-url` responde 503 con un mensaje claro si el proveedor no está configurado.
   - El front muestra "No pudimos abrir Google ahora, intenta más tarde" en vez de abrir el popup.
2. **Davibank aparece como "ScotiaBank".** Los avisos de `DAVIbankInforma@davibank.com` se leen con el banco oficial
   `ScotiaBank`, pero quien tiene Davibank no lo encuentra en la lista. Lo mismo pasa con el texto "Esperamos
   movimientos de ScotiaBank".
   **Propuesta:** renombrarlo a "Davibank (antes Scotiabank Colpatria)", o aceptar los dos nombres en el buscador de
   bancos, cuidando que los usuarios que ya lo tienen sigan ligados.

3. **Crear la cuenta después de conectar no pide la lectura** (el más grave). `linkEmailAndReadNow` solo pide
   `POST /email/read` al conectar, y solo si ya hay cuentas. En el orden del onboarding (primero correo, luego
   cuenta) no se encola ningún job, y la primera lectura queda para la corrida horaria del worker: hasta 1 h. Por eso
   "se crea la cuenta, se cierra el popup y no pasa nada". Además "La primera lectura empieza en unos minutos" no es
   cierto en ese caso.
   **Propuesta:**
   - La API encola la lectura prioritaria (`priority=1`) cuando se crea una cuenta, o se le cambia el `email_id`, a
     una conexión sana. Se hace en el servicio, no en el front, y con dedupe.
   - El front, al cerrar el modal, vuelve al Inicio con "Leyendo tus correos…" activo y hace polling de
     `GET /email/status` cada ~10 s hasta el primer movimiento.
4. **Banner "El correo … fue vinculado exitosamente con CashFlow" dentro del modal de crear cuenta.**
   - Nombre viejo ("CashFlow").
   - Un aviso de otra acción no va en ese modal.

   **Propuesta:** quitarlo del modal y decir "Correo conectado" una sola vez, como toast o como paso tachado del
   checklist.
5. **Davibank no está en la lista de bancos al crear la cuenta.** JuanMa tuvo que crearlo a mano, con el remitente.
   Es el hallazgo 2 visto desde la UI.
6. **Toggle "leer transacciones de su correo" en la cuenta durante el onboarding.** Si el correo ya está conectado y
   el objetivo es leerlo, la opción sobra.
   **Propuesta:** en el onboarding, venir encendida y oculta, ligada a la conexión recién hecha. Mostrarla solo al
   editar o si hay más de una conexión.
7. **El checklist desaparece después de conectar** y la pantalla de crear cuenta no muestra en qué paso va.
   **Propuesta:**
   - Mantener el paso a paso visible (barra "Paso 2 de 4" o el checklist en el mismo Inicio).
   - Hacer de "Crea la cuenta de tu banco" un sub-paso explícito de "Conecta tu correo".
   - Abrir el modal de crear cuenta desde el propio Inicio, sin cambiar de vista, para no perder el hilo.
8. **La espera mata el efecto "wow" y el usuario no sabe cuánto esperar.**
   **Propuesta:**
   - Con el arreglo 3 la primera lectura sale en segundos, porque el job prioritario lo toma el worker en
     `WORKER_POLL_SECONDS`.
   - Mostrar un estado vivo: "Buscando correos de Davibank… 12 correos revisados", según `emails_processed`, y
     después "3 movimientos encontrados".
   - Dar una cota honesta ("suele tardar menos de un minuto") en vez de "unos minutos".
   - Si a los 5 min no hay nada, pasar a "No encontramos notificaciones recientes; te avisamos cuando llegue la
     próxima".

9. **DRY_RUN (16-nov, sin el arreglo 3: el job se encoló con `python -m worker enqueue-now`).**
   - Query `from:(DAVIbankInforma@davibank.com) after:<1-nov>`.
   - 22 correos listados y extraídos: 21 transacciones que habría creado y 1 descartada. Las 21 son gastos de la TC
     y todas con `should_verify=true`, así que el usuario nuevo arranca con 21 movimientos en Por revisar.
   - ~22 s en total, porque se hace una llamada a Gemini por correo, en serie.
   **Propuestas:**
   - Crear cada transacción apenas se extrae, y no al final del job: el primer movimiento aparece en ~1 s.
   - Con muchas pendientes, que Por revisar ofrezca "confirmar todas las de esta categoría".

10. **El Inicio no se actualiza mientras lee.** El paso 2 se tachó, pero "Gastado este mes" y "Por revisar" siguieron
    en $0 / "Todo al día" hasta recargar.
    **Propuesta:**
    - Mientras alguna conexión está en `reading_first`, o hay un job prioritario en curso, el Inicio consulta
      `GET /email/status` cada ~5 s.
    - Cuando cambian `transactions_created` o `emails_processed`, vuelve a pedir el resumen, la gráfica y Por revisar.
    - Las cifras suben en vivo, con un contador "Leyendo… 12 de 22 correos". Junto con el hallazgo 9, crear cada
      transacción apenas se extrae, el usuario ve llenarse el Inicio.
    - SSE es una mejora posterior; el polling basta.
11. **El checklist no se actualiza al revisar ni al crear el presupuesto, y desaparece sin cerrar el ciclo.** El
    backend sí marcó `review` y `budget` (a las 21:01:10, al volver al Inicio), pero la tarjeta se quedó en "2 de 4"
    con "Tienes 21 movimientos por revisar" aunque ya estaban todos revisados. Al navegar y volver, se ocultó sin
    decir que se había terminado.
    **Propuesta:**
    - Volver a pedir `GET /onboarding/status` después de resolver un pendiente y al crear un presupuesto.
    - Que el contador del paso 3 baje en vivo ("Te quedan 12").
    - Al llegar a 4 de 4, mostrar un estado de cierre ("¡Listo! Topi ya trabaja solo…") que el usuario descarta.
    - Revisar desde la tarjeta Por revisar del Inicio es la experiencia correcta, porque no saca al usuario del
      Inicio: el checklist solo tiene que reflejarlo.
12. **Conteos distintos:** el checklist dice "21 por revisar" y la tarjeta dice "Por revisar · 25". Los 4 de más son
    las preguntas de cuotas de compras grandes, que se cuentan aparte.
    **Propuesta:** contar igual en los dos lados. Lo más simple es contar movimientos con algo pendiente, no
    preguntas.
13. **El selector de emojis al crear una categoría** queda debajo de la barra de navegación y ocupa todo el ancho.
    **Propuesta:**
    - Centrarlo verticalmente en un `Dialog` con `z-index` por encima de la barra.
    - Ancho máximo como el de los demás modales (~`max-w-md`).
    - En móvil, hoja inferior.
14. **La tarjeta Presupuestos confunde cuando hay un solo presupuesto.**
    - Solo "Babies" tiene presupuesto ($200 k), pero Salud, Inversiones, Comida… salen como
      "-$ 785.820 de $ 0 · Atento 100%", con signo negativo.
    - "Hoy puedes gastar $0 · Te pasaste" compara todo el gasto del mes contra los $200 k de una sola categoría.

    **Propuesta:**
    - Mostrar solo las categorías con presupuesto y una línea "Sin presupuesto: $X".
    - Montos de gasto en positivo.
    - Que "Hoy puedes gastar" use solo lo gastado en categorías con presupuesto, o que diga "con tus presupuestos"
      cuando no cubren todo.

15. **La ventana emergente del OAuth era una página en blanco** con "Conexión completada." o "Redirigiéndote a
    CashFlow…". Además:
    - escribía el código OAuth en la consola, en las dos ventanas;
    - mostraba "completada" aunque el usuario cancelara;
    - si Google devolvía solo `error=access_denied`, se quedaba cargando para siempre;
    - la ventana de Topi aceptaba mensajes de cualquier origen.

    **Hecho en este cambio, sin commit** (`containers/OAuthPopupCard.jsx`, `GlinkOauthPopupSuccess.jsx`,
    `GmailConnectAuthCallBack.jsx`, `LinkTransEmailForm.js`):
    - tarjeta con la marca de Topi, en cuatro estados: conectando, listo (se cierra a los 0,9 s), error (con botón
      *Cerrar*) y sin ventana de origen (con *Volver a Topi*);
    - el código ya no va a la consola;
    - se acepta `error` además de `error_description`;
    - la ventana de Topi solo acepta mensajes del mismo origen.

    Verificado en :3098 los cuatro estados, los tres sin ventana de origen directamente y el de "listo" en el flujo
    real. Queda un parpadeo blanco breve mientras carga el chunk perezoso de la ruta.
16. **`logmailer` repite `provider_id` al reiniciar la API** (`log-%d` con un contador en memoria): `log-1` choca con
    el índice único `email_outbox_provider_id` y el correo queda en `sending` ("sent but could not mark it").
    Pasó con `connection_down` y `bank_unsupported`. Solo afecta a local. Pero si marcar un envío falla por
    cualquier razón, la fila se reclama después del tiempo de bloqueo y se reenvía: puede llegar duplicado.
    **Propuesta:**
    - `provider_id` único en el logmailer: un UUID o `log-<outbox id>`.
    - Que un "enviado pero no marcado" no se reintente a ciegas: por ejemplo, marcar `sent` sin `provider_id`.
17. **Banco no soportado.**
    - Simulado con una conexión ficticia (id 4, `arq-prueba@topi.test`, tokens falsos, fuera de
      `WORKER_ONLY_EMAIL_IDS`), una cuenta "ARQ" ligada y `created_at` 49 h atrás.
    - Al reiniciar la API se marcó `unsupported_alert_at` y salió `bank_unsupported` en el log.
    - El correo lista "ScotiaBank" entre los bancos que se leen, lo que confirma el hallazgo 2. También pide
      reenviar un ejemplo a `BANK_SAMPLES_ADDRESS`.

18. **Replantear el aviso de banco no soportado (propuesta de JuanMa).** Hubo que leerlo tres veces para entenderlo.
    - La lista de bancos no escala: con más países o más bancos se vuelve impresentable.
    - Pedir que reenvíen correos al buzón del equipo se siente poco profesional, y no hace falta.

    **Propuesta de JuanMa:** pedir solo el remitente de las notificaciones. Con eso Topi ya puede leer de su correo
    los avisos de ese remitente y dejar que la IA los extraiga. El aviso saldría con reglas más largas, por ejemplo
    3 semanas con una cuenta ligada y sin nada leído.

    **Opinión y ajustes:**
    - El mecanismo ya existe. Un banco propio guarda su remitente (`banks.email`), y el worker ya leyó Davibank así,
      con el banco creado a mano. "Banco no soportado" casi siempre significa que el remitente es incorrecto o que
      la extracción no funciona, no que falte código.
    - **No esperar semanas, decidir con lo que dice la primera lectura** (el worker ya sabe `listed` y `created`):
      - `listed = 0` en los últimos 30 días → de inmediato: "No encontramos correos de <remitente>. ¿Desde qué
        correo te escribe tu banco?", con ayuda corta para copiarlo de una notificación.
      - `listed > 0` y 0 movimientos → "Encontramos N correos de tu banco, pero aún no sabemos leerlos." Al equipo
        le llega una señal agregada por dominio del remitente, que no es un dato personal.
      - Tres semanas choca con la meta de I.1 (1.ª automática en 48 h ≥ 50 %). El aviso de 48 h queda solo para
        "conectado, sin cuentas, sin nada".
    - **Límites para no salirse del Uso limitado de Google ni de la Política:**
      - Solo remitentes que el usuario declara como su banco.
      - Nunca escanear el buzón buscando bancos.
      - Mostrar el dominio y pedir confirmación ("Topi leerá solo los correos de @arqfinance.com").
      - Los movimientos de remitentes nuevos entran con `should_verify` hasta que la extracción demuestre calidad.
      - Un remitente pasa a oficial cuando lo usan ≥ 5 usuarios con buena tasa de extracción.
    - **Quitar** la lista de bancos del aviso y del correo, y la petición de reenviar ejemplos.
      `BANK_SAMPLES_ADDRESS` queda sin uso.
    - **Lo que se pierde:** sin ejemplos, el equipo no puede mejorar un banco que la IA lea mal, porque el cuerpo de
      los correos no se guarda. Si llega a pasar, pedir un ejemplo de forma puntual y con consentimiento explícito,
      no como paso por defecto.

    **Decisión de JuanMa (16-nov):**
    - Acepta los ajustes.
    - Acepta perder los ejemplos: no se pedirán.
    - Para más adelante: detectar lecturas malas por las correcciones de los usuarios (monto, gasto/ingreso, cuenta
      asociada) y analizar los cuerpos de los correos de ese remitente, sin ligarlos a un usuario, para mejorar el
      prompt.

    **Antes de hacerlo:** hoy la regla es "no se guarda el cuerpo de los correos" (CLAUDE.md) y la Política lo
    declara. Además, el Uso limitado de Google solo permite que una persona lea datos con consentimiento del
    usuario para mensajes específicos, o como datos agregados y anonimizados. Guardar cuerpos, aunque sea sin
    usuario, exige:
    - actualizar la Política;
    - quitar los datos personales del cuerpo (nombres, últimos dígitos, montos);
    - probablemente, pedir un consentimiento explícito.
19. **Panel admin.** Lectura cuadra con la prueba: 2 conexiones sanas, 1 caída reconectada, 1 job fallido (el del
    token dañado), 1 sana sin movimientos en 48 h ("Otros bancos" por la regla de ≥ 5 usuarios). En Lanzamiento,
    "Correo conectado en 24 h" sale "0 % de 0 registros" aunque hubo un registro con conexión hoy: las métricas
    diarias aún no estaban recalculadas. Opiniones: vacía, no se dejó ninguna. Sin errores.

Cuenta conectada en esta prueba: un Gmail personal con autorización expresa de su dueña, que ya había autorizado a
Topi antes, así que no gasta cupo. Avisos que le llegan: Davibank (soportado) y ARQ (`no-reply@arqfinance.com`, no
soportado). ARQ sirve para probar el aviso de banco no soportado.
