# 30. Arreglos del onboarding (hallazgos del plan 29)

Rama `feat/lanzamiento`. Cada bloque va en un commit con sus tests, sin push. Al final se verifica en local con el
entorno `ob-*` del plan 29 (API :8098, web :3098, worker limitado a la conexión de prueba).

## Bloque 1. La cuenta ligada pide la lectura (hallazgo 3)

Hoy solo `linkEmailAndReadNow` (front) pide `POST /email/read`, y solo al conectar si ya hay cuentas.

- `AccountService` recibe por *setter* un `ReadRequester`, que es `EmailService.ReadEmail`. Se cablea en
  `injector.go`. Va por setter porque `EmailService` ya depende de `AccountService`, y por constructor habría un
  ciclo.
- `CreateAccount` pide la lectura prioritaria si la cuenta trae `email_id`. `UpdateAccount`, si el `email_id`
  cambia a uno nuevo o si cambia el banco.
  - Va en segundo plano y nunca hace fallar la creación, como `readAfterReconnect`.
  - El dedupe ya existe: `ReadEmailBodyRequest.DedupeKey`.
- Se salta si la conexión tiene error o está inactiva.
- Tests: servicio con mock del `ReadRequester` (crea con correo, crea sin correo, cambia correo, edición sin cambio).

## Bloque 2. El Inicio y el checklist en vivo (hallazgos 10, 11 y 12)

- **Señal única en el front:** `lib/dataEvents.js`, con `emitDataChanged(kind)` y `onDataChanged(fn)` sobre
  `window`.
  - Se emite al crear movimientos leídos, al resolver algo en Por revisar, al guardar un presupuesto y al
    crear o editar una cuenta.
  - Así cada tarjeta no tiene que conocer a las demás.
- **Lectura en vivo** (`OnboardingChecklist`):
  - Mientras alguna conexión esté en `reading_first`, o después de una señal de cuenta nueva, consulta
    `GET /email/status` cada 5 s, en vez de cada 60 s, con un tope de 10 min.
  - Cuando suben `transactions_created` o `emails_processed`, emite `transactions`.
  - `AAGenDashboard` (resumen y gráfica), `ReviewInbox` (cola) y `DashPlan` escuchan y vuelven a pedir sus datos.
  - Texto vivo: "Leyendo tus correos… 12 correos revisados · 5 movimientos".
- **Checklist:**
  - Vuelve a pedir `GET /onboarding/status` con cada señal.
  - El paso 3 muestra "Te quedan N".
  - Al llegar a 4 de 4 muestra "¡Listo! Topi ya anota tus movimientos solo" con un botón *Entendido*. El cierre se
    guarda por usuario en `localStorage` y la tarjeta se oculta después.
- **Mismo conteo:** `OnboardingFacts.PendingReview` cuenta lo mismo que la tarjeta: movimientos por verificar o
  pago sin contraparte, más las preguntas de cuotas. La condición de cuotas se saca a una constante compartida con
  `NeedsInstallments`. Las sugerencias de transferencia y las tarjetas con pagos de más siguen solo en la tarjeta,
  porque no son del onboarding.
- **D1 (decidido):** el paso 3 se sigue marcando con la primera revisión, como hoy. "Te quedan N" se muestra
  mientras no esté hecho.
- Tests:
  - `OnboardingChecklist.test.js`: polling, refresco por señal, estado de cierre y "Te quedan N".
  - `ReviewInbox.test.js`: emite la señal al resolver.
  - Test de repositorio para el conteo.

## Bloque 3. El worker crea los movimientos a medida que lee (hallazgo 9)

- En `jobs.py`, el paso 5 (mapear cuentas, marcar moneda y pagos de tarjeta, `create_transactions`) se mueve a
  `_flush()`.
  - Se llama cada 3 correos con movimientos y al final.
  - La idempotencia no cambia: `source_message_id`, `processed_emails` y `update_message` siguen por mensaje.
- Gmail lista del más nuevo al más viejo, así que lo primero que aparece en el Inicio es lo de hoy.
- Tests: pytest de `jobs` (varios flushes, un fallo a mitad que reintenta sin duplicar, dry run igual que hoy).

## Bloque 4. Banco no soportado: pedir el remitente (hallazgo 18)

Lo decidido: sin lista de bancos, sin reenvío de ejemplos, preguntar el remitente y decidir con la primera
lectura.

- **Ventana de la primera lectura (D4).** Sin estado previo para un remitente, el worker lee desde el día 1 del mes
  anterior si hoy es antes del día 12 (hora Bogotá), y si no, desde el día 1 del mes en curso.
  - Esa misma lectura crea los movimientos y sirve para decidir el aviso. No hay un listado aparte.
  - Las lecturas siguientes no cambian: desde `last_run` menos el solape.
- **El worker anota lo que encontró**, por conexión y remitente:
  - Guarda `first_found` (correos listados en la primera lectura) y `first_read_at` en `email_sync_state`
    (migración 000051, con `down`).
  - Solo se escribe la primera vez.
- **Estado por banco** en `GET /email/status`: cada `banks[]` trae `reading`.
  - `reading` (aún no leído);
  - `ok`;
  - `no_emails`: leído y `first_found = 0`, sin correos procesados después;
  - `unreadable`: correos encontrados y 0 movimientos.

  La conexión toma el peor estado. `no_transactions` (48 h) queda solo como respaldo para conexiones sin
  `email_sync_state`.
- **App (`UnsupportedBankNotice`):**
  - **`no_emails`:** "No encontramos correos de **DAVIbankInforma@davibank.com** desde el <inicio de la ventana>.
    ¿Desde qué correo te escribe tu banco?"
    - Campo con el remitente y ayuda de una línea ("ábrelo en una notificación de tu banco y copia el
      remitente").
    - Confirmación con el dominio: "Topi leerá solo los correos de @davibank.com".
    - Guarda con `PUT /banks/:id` y pide la lectura.
  - **`unreadable`:** "Encontramos N correos de tu banco, pero aún no sabemos leerlos. Los anotaremos solos
    cuando aprendamos; mientras, puedes registrarlos a mano." No se pide nada más.
- **Remitentes nuevos:**
  - Un banco propio (no oficial) entra con `should_verify` en el worker hasta que lo usen ≥ 5 usuarios.
  - El panel de Lectura muestra los dominios con `unreadable` y su número de usuarios (dominio del remitente, sin
    usuarios; nombres con ≥ 5).
  - Pasar un remitente a oficial sigue siendo a mano.
- **Correo `bank_unsupported`:**
  - Mismo texto que la app según el estado y enlace al Inicio.
  - Sin lista de bancos ni buzón.
  - `bank_samples_address`, `POST /banks/sample-request` y `BANK_SAMPLES_ADDRESS` se retiran. La regla sobre
    ejemplos de CLAUDE.md se actualiza.
- **La Política de privacidad** ya dice que Topi lee solo los correos de los bancos que el usuario indica. Se
  revisa la frase sobre remitentes declarados por el usuario.
- Tests: migración, repositorio del estado por banco, dominio (`ComputeReading`), plantilla, worker (`found_30d`)
  y front.

## Bloque 5. Arreglos de interfaz (hallazgos 2/5, 4, 6, 7, 13, 14 y 16)

- **Davibank (D2):** agregar `"Davibank": "DAVIbankInforma@davibank.com"` a `enums.OfficialBanks` y dejar
  `ScotiaBank` como está, para los que ya lo tienen.
- **Banner "CashFlow":** el aviso de conexión pasa a "Correo conectado", dura 3 s y no queda pegado (hoy, en
  onboarding y ajustes, la duración es `false`).
- **Toggle de lectura:**
  - Con una sola conexión sana y un banco que se lee, la cuenta nueva viene ligada y el toggle no se muestra.
  - En su lugar va una línea: "Leeremos sus movimientos de valarpe@gmail.com · Cambiar".
  - Con más de una conexión se muestra como hoy.
- **Paso a paso:**
  - Después de conectar, `ConnectEmail` lleva al Inicio con el modal de crear cuenta abierto, en vez de dejar al
    usuario en la pantalla de conexión.
  - El checklist sigue visible, con el sub-paso "Crea la cuenta de tu banco" bajo "Conecta tu correo" mientras
    la conexión esté en `no_accounts`.
- **Selector de emojis** (`DropDownEmoji`): `Dialog` centrado por encima de la barra (`z-50`), `max-w-md`, alto
  acotado y hoja inferior en móvil.
- **Tarjeta Presupuestos** (`DashPlan`):
  - Solo categorías con `budget > 0`, montos en positivo y una línea "Sin presupuesto: $X".
  - "Hoy puedes gastar" solo cuenta el gasto de las categorías con presupuesto.
- **Logmailer:** `provider_id` = `log-<uuid>`.
- **Outbox (D3):** si el envío salió pero no se pudo marcar, la fila queda `sent` sin `provider_id` y no se
  reintenta. Se prefiere perder la marca que mandar un correo dos veces.

## Decisiones de JuanMa (16-nov)

- **D1:** el paso 3 se marca con la primera revisión, como hoy.
- **D2:** Davibank entra como banco oficial nuevo y ScotiaBank se queda.
- **D3:** un correo enviado y no marcado no se reintenta.
- **D4:** antes del día 12, la primera lectura trae el mes anterior completo y el actual. Desde el día 12, solo el
  mes actual.

## Verificación final

- `go test ./...`, `npm test` de lo tocado y pytest del worker, en verde.
- En `ob-*`, con un usuario nuevo y la conexión de prueba en `WORKER_ONLY_EMAIL_IDS`, recorrer el guion del plan 29:
  - el Inicio se llena mientras lee;
  - el checklist llega a 4 de 4 con cierre;
  - un banco con remitente equivocado muestra `no_emails` y, al corregirlo, lee.
