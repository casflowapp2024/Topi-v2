# Modelo de negocio — cubrir la operación sin incomodar al usuario gratis

Objetivo: que Topi **se pague sola** (servidor, IA, verificación de Google, dominio, correo), no hacerse rico.
Principios:
1. **Gratis es todo lo que la app promete** (lectura automática, cuentas, presupuestos, Por revisar, avisos).
2. **No se ofrece lo que no existe.** Plus sale a la venta solo cuando sus funciones ya están en producción.
3. **Nada gratis se vuelve pago.** Por eso toda función nueva nace con su límite de plan gratis visible.
4. Sin anuncios, sin vender datos, sin pruebas que caducan, cancelar tan fácil como suscribirse.

> No es asesoría legal ni tributaria: facturación (DIAN), retracto y habeas data se validan con un
> contador/abogado antes de cobrar.

## Orden (actualizado el 14-nov-2026)

El panel admin (etapa 1) mostró que, aparte del equipo, hay **1 usuario activo**. Antes de pedir apoyo o cobrar
hace falta tracción: el lanzamiento público pasa a ser la etapa 3.

| Etapa | Qué | Estado | Promete algo pago | Plan |
|---|---|---|---|---|
| **1. Medir + fundadores** | Panel admin, métricas, North Star, costo por usuario, lista de fundadores | **Hecha** (en `main` desde 7f49490, 12-nov) | No | `25-admin-metricas.md` |
| **2. Apoyar a Topi** | Pago único voluntario con Mercado Pago | **Implementada y apagada** (`SUPPORT_ENABLED=false`) | No | este archivo, §N1 |
| **3. Lanzamiento público** | Verificación de Google, activación guiada, banco no soportado, conexión caída, opiniones, landing, reactivación, despliegue por etapas | Siguiente | No | `27-lanzamiento.md` |
| **4. Fase 4 en beta** | Avisos, push, Pregúntale a Topi (**1 pregunta/día gratis**), diversión; derechos por plan ya activos | Pendiente | No (todo lo existente es gratis con límites) | `24-ux-fase-4.md` |
| **5. Lanzar Plus** | Planes, cobro recurrente, página Planes, fundadores confirmados | Pendiente | Sí, cuando 1–4 están en prod | este archivo, §N2–N3 |

**Criterio para encender Apoyar a Topi** (`SUPPORT_ENABLED=true`): **≥ 50 "usuarios al día semanales"** (North Star,
plan 25) **durante 4 semanas seguidas**. Hasta entonces la opción no aparece y no se crean pagos; el webhook sigue
activo para no perder notificaciones.

Decidir precio y contenido final de Plus con 1–2 meses de datos de la etapa 4 (uso de la IA, % de usuarios
que llegan al límite diario, costo por usuario activo).

## Planes

### Topi (gratis, para siempre)
- Lectura automática de hasta **2** conexiones de correo; cuentas, presupuestos, Por revisar, Inicio,
  gráficas, multimoneda, patrimonio.
- Aviso del día dentro de la app y notificaciones push.
- **Pregúntale a Topi: 1 pregunta por día.**
- Correos: recuperación, conexión caída, resumen mensual.

### Topi Plus (hipótesis: COP 9.900/mes o 79.900/año; se confirma en la etapa 5)
- Pregúntale a Topi: **hasta 30 preguntas por día** (ajustable por configuración, no por código).
- Hasta 5 conexiones de correo.
- Funciones que existan al lanzar: exportar, metas, resumen mensual completo tipo historia, WhatsApp,
  hogar/pareja. **Solo se listan las que estén en producción el día del lanzamiento.**

### Fundadores
- **Elegibles**: usuarios registrados antes de la fecha de corte `FOUNDER_CUTOFF` (= el día que se despliega
  la etapa 1).
- **Confirmados**: elegibles con actividad real en los últimos 90 días al momento de lanzar Plus (ingresó a la
  app, o tiene una conexión de correo sana con transacciones leídas). Así se descartan las cuentas fantasma sin
  borrar a nadie: un elegible que vuelva antes del lanzamiento queda confirmado.
- Fundador confirmado = Plus de por vida, **solo para los primeros 30** (decisión de JuanMa, 16-nov-2026); el resto
  no. El admin revisa y confirma la lista en el panel (§ en plan 25). **Se anuncia en la landing** (decisión de
  JuanMa, 24-nov-2026): "Los primeros 30 que conecten su correo serán fundadores: todo lo que lancemos, de por vida",
  sin nombrar Plus ni precios.
- No se borran usuarios ni datos por no ser fundadores; limpiar cuentas abandonadas es otra decisión (habeas
  data) que requiere OK explícito.

## Implementación

### N1 · Apoyar a Topi (etapa 2) — implementada, apagada
Estado (14-nov-2026): en la rama `feat/apoyar-topi`, verificada en el sandbox real y detrás de `SUPPORT_ENABLED`
(por defecto `false`: menú oculto y `POST /billing/support` → 404; el webhook y la consulta de pagos existentes
siguen). Se enciende con el criterio de la tabla de etapas.
- **Spike** (½ día, sin código de producción): Wompi vs Mercado Pago para (a) pago único por link/checkout,
  (b) cobro recurrente en Colombia, (c) webhooks con firma, (d) comisiones, (e) sandbox. Decisión escrita
  aquí antes de codificar.
- Puerto `domain.Billing` + adaptador. Tabla `payments` (id, user_id, provider, provider_ref único,
  kind `support|subscription`, amount decimal, currency, status, raw_status, timestamps).
- Webhook `POST /billing/webhook/:provider`: firma verificada, idempotente por `provider_ref`; el front nunca
  marca un pago.
- Front: "Apoyar a Topi" en el menú de usuario → hoja con montos (10.000 / 20.000 / 50.000 / libre) →
  checkout → gracias. Recibo con la plantilla `billing_generic` del correo (ya existe).

#### Spike: Wompi vs Mercado Pago (13-nov-2026)

Fuentes: documentación oficial leída el 13-nov-2026 (enlaces en cada fila). Las páginas oficiales de tarifas
(`wompi.com/es/co/planes-tarifas`, `mercadopago.com.co/costs-section`, `/ayuda/costos`) respondieron 403/503 a la
lectura automática: **las comisiones salen de comparativas de terceros y hay que confirmarlas en el panel de cada
pasarela antes de producción.**

| | **Wompi** (Bancolombia) | **Mercado Pago** |
|---|---|---|
| (a) Pago único | Web Checkout: formulario GET a `checkout.wompi.co/p/` con `public-key`, `currency=COP`, `amount-in-cents`, `reference` (única) y `signature:integrity` = `SHA256(reference + amount_in_cents + currency + integrity_secret)`, calculada en el servidor. `redirect-url` opcional; vuelve con `?id=<tx>`. No requiere SDK. [widget-checkout-web](https://docs.wompi.co/docs/colombia/widget-checkout-web/) | Checkout Pro: crear una *preferencia* por pago (items, `back_urls`, `auto_return`) y redirigir al checkout. [create-payment-preference](https://www.mercadopago.com.co/developers/es/docs/checkout-pro-preferences/create-payment-preference), [back-urls](https://www.mercadopago.com.co/developers/es/docs/checkout-pro-preferences/configure-back-urls) |
| Medios en Colombia | Tarjeta, Nequi, PSE, Bancolombia, Daviplata | Tarjeta, PSE, Efecty, dinero en cuenta |
| (b) Recurrente | **Sin producto de suscripción**: fuentes de pago (tarjeta o Nequi tokenizados + `acceptance_token`) que el servidor cobra con `POST /v1/transactions` + `payment_source_id`. El calendario, los reintentos y `past_due` los pone Topi. COF (`recurrent`) solo Visa/Mastercard con procesador RBM. [fuentes-de-pago](https://docs.wompi.co/docs/colombia/fuentes-de-pago/) | **Suscripciones nativas** (`preapproval_plan` / `preapproval`): semanal, mensual o anual, reintentos automáticos, pausar/cancelar con `PUT /preapproval/{id}`. La tabla de países incluye CO, pero la marca de disponibilidad no se pudo leer. [subscriptions/overview](https://www.mercadopago.com.co/developers/es/docs/subscriptions/overview), [subscription-management](https://www.mercadopago.com.co/developers/es/docs/subscriptions/subscription-management) |
| (c) Webhook y firma | Evento `transaction.updated` (estado final: APPROVED, DECLINED, VOIDED, ERROR). `checksum = SHA256(valores de signature.properties en orden + timestamp + events_secret)`, también en `X-Event-Checksum`. Las propiedades vienen en el cuerpo: no fijarlas en código. Responder 200; reintenta 3 veces en 24 h (30 min, 3 h, 24 h). URL distinta por ambiente. [eventos](https://docs.wompi.co/docs/colombia/eventos/) | `x-signature: ts=…,v1=…`; `v1 = HMAC-SHA256(secret, "id:<data.id>;request-id:<x-request-id>;ts:<ts>;")`. La notificación no trae el estado: hay que pedir `/v1/payments/{id}`. Responder 200/201 en 22 s; reintenta cada 15 min. [webhooks (orders)](https://www.mercadopago.com.co/developers/es/docs/checkout-pro-orders/resources/notifications/webhooks), [optional-notifications](https://www.mercadopago.com.co/developers/en/docs/checkout-pro-preferences/optional-notifications) |
| Consultar estado | `GET /v1/transactions/{id}` con la llave privada como Bearer. [seguimiento](https://docs.wompi.co/docs/colombia/seguimiento-de-transacciones/) | `GET /v1/payments/{id}` con el access token |
| (d) Comisión (terceros, por confirmar) | ~2,65 % + COP 700 + IVA por transacción exitosa, sin mensualidad; desembolso al día hábil siguiente ([btodigital](https://btodigital.com/pasarelas-pago-colombia-comparativa-guia-negocio/), [mentoracolombia](https://mentoracolombia.com/pasarelas-de-pago-colombia-2026-comisiones-wompi-bold-mercadopago/)) | Link/checkout ~3,29 % + IVA al instante, 2,99 % a 7 días, 2,79 % a 14 días; las fuentes no coinciden en si hay fijo ([kytcode](https://www.kytcode.lat/blog/wompi-vs-mercado-pago-vs-payu-colombia), [guiadebancos](https://www.guiadebancos.com/ar/blog/comisiones-mercado-pago-latam-2026)) |
| (e) Sandbox | `https://sandbox.wompi.co/v1`, llaves `pub_test_` / `prv_test_` / `test_events_` / `test_integrity_`. Tarjeta 4242 4242 4242 4242 → APPROVED, 4111 1111 1111 1111 → DECLINED; Nequi 3991111111 → APPROVED. [ambientes-y-llaves](https://docs.wompi.co/docs/colombia/ambientes-y-llaves/), [datos-de-prueba](https://docs.wompi.co/docs/colombia/datos-de-prueba-en-sandbox/) | Credenciales de prueba de la aplicación (cuentas de prueba solo para algunos escenarios). Tarjetas de prueba con el nombre del titular como resultado (APRO, OTHE, CONT…). [test/accounts](https://www.mercadopago.com.co/developers/es/docs/your-integrations/test/accounts), [test/cards](https://www.mercadopago.com.co/developers/es/docs/your-integrations/test/cards) |

**Decisión (JuanMa, 13-nov-2026): Mercado Pago**, con el adaptador detrás del puerto `Billing` (Wompi quedaría
como segundo adaptador sin tocar el core).
- Los aportes son pequeños (10.000–50.000): sin cargo fijo por transacción, Mercado Pago sale más barato que el
  ~2,65 % + COP 700 de Wompi. El punto de equilibrio está alrededor de COP 110.000 (tarifas por confirmar).
- Tiene suscripciones nativas (`preapproval`) para la etapa 5: Topi no tendría que mantener su propio calendario
  de cobros ni reintentos.
- Lo que cuesta: hay que crear una order por pago y, al recibir el webhook, leer siempre la order desde el servidor.

**Cambio (14-nov-2026): Checkout Pro vía Orders API, no Preferences.** Al crear la aplicación, Mercado Pago avisa que
la API de Preferences se va a deshabilitar; JuanMa creó la aplicación con Orders y el adaptador se rehizo sobre
`/v1/orders`. Detalles leídos en la documentación oficial y comprobados con las credenciales de prueba:
- Crear: `POST /v1/orders` con `X-Idempotency-Key` (= `payments.id`, así un reintento nunca crea otra order),
  `type: "online"`, `processing_mode: "manual"`, `total_amount` e `items[].unit_price` como **string**,
  `external_reference` (= `payments.id`), `taxes: [{type: "IVA", value: "0"}]` y `config.online.{success,failure,
  pending}_url` (`auto_return: "all"` solo con https). Responde `id` (`ORDTST...` en pruebas) y `checkout_url`.
  Con Orders, localhost sí se acepta en las URLs de retorno. No se manda `payer`: el correo del usuario no sale.
  [create-order](https://www.mercadopago.com.co/developers/es/docs/checkout-pro-orders/create-order),
  [back-urls](https://www.mercadopago.com.co/developers/es/docs/checkout-pro-orders/web-integration/configure-back-urls)
- Estado: `GET /v1/orders/{id}` (el id respeta mayúsculas; en minúsculas da 404). `created` → creado,
  `processing`/`action_required` → pendiente, `processed` → aprobado, `failed` → rechazado, `canceled` → cancelado,
  `refunded` → devuelto. No hay búsqueda por `external_reference` (400): la order se guarda en `checkout_ref` y se
  consulta por id. La order no trae `live_mode`: fuera de producción solo cuentan las `ORDTST...`.
  [order-status](https://www.mercadopago.com.co/developers/es/docs/checkout-pro-orders/payment-management/status/order-status)
- Webhook: evento **Order (Mercado Pago)** en Configuración de Webhooks (Prueba / Producción), `POST
  ?data.id=ORD...&type=order`. Misma firma `x-signature` con el id **en minúsculas** en el manifest. Después se lee
  la order con `GET /v1/orders/{id}`.
  [notifications](https://www.mercadopago.com.co/developers/es/docs/checkout-pro-orders/notifications)
- IVA: igual que en Preferences (sin `taxes` asume 19 % incluido); con Orders `value` va como string.
  [iva-colombia](https://www.mercadopago.com.co/developers/es/docs/checkout-pro-orders/additional-settings/iva-colombia)
- Sandbox: no hace falta cuenta de prueba; en incógnito, cualquier correo y tarjeta de prueba (titular `APRO`
  aprobada, `OTHE` rechazada, `CONT` pendiente; documento 123456789).
  [test-purchase-with-card](https://www.mercadopago.com.co/developers/es/docs/checkout-pro-orders/integration-test/test-purchase-with-card)

**Antes de producción (pasos manuales):** cuenta de vendedor Mercado Pago, confirmar tarifa y plazo de liberación
en el panel, configurar la URL de webhook y revelar la clave secreta, y que contador/abogado revisen el IVA (0) y si
un aporte voluntario necesita factura electrónica (DIAN).

### N2a · Derechos mínimos (se hace dentro de la Fase 4, etapa 4)
- `users.founder_eligible bool`, `users.founder_confirmed_at timestamptz` (de la etapa 1).
- Dominio: `Entitlements(user, sub)` en un solo lugar → `{plan, askTopiDaily, maxEmailConnections, ...}`.
  Hoy: `free` (ask 1/día, 2 conexiones) y `plus` (= fundador confirmado o suscripción activa; ask 30/día,
  5 conexiones). Valores por variables de entorno con defaults.
- `GET /me/entitlements`, middleware `RequireEntitlement`, cuotas validadas en la API.
- Mientras Plus no se lance, **los elegibles a fundador se tratan como Plus** (para que no "pierdan" nada al
  confirmarse). El límite de conexiones solo aplica a conexiones nuevas: nadie pierde una conexión existente.

### N2 · Planes (etapa 5)
- Tabla `subscriptions` (user_id, plan, status `active|past_due|canceled`, current_period_end, provider,
  provider_ref, cancel_at_period_end, timestamps).
- Front: página **Planes** (menú de usuario y Configuración), `ui/PlusGate` (muestra qué da Plus sin bloquear
  la navegación), estado de suscripción y Cancelar.

### N3 · Cobro recurrente (etapa 5)
- Según el spike. Reintentos 3 en 7 días → `past_due` → vuelve a gratis al terminar el periodo; sin perder
  datos (lo de Plus queda en solo lectura).
- Correos: pago recibido, pago fallido, renovación anual (7 días antes).
- Términos (precio, renovación, cancelación, retracto) y Privacidad (solo referencia de la pasarela, nunca
  datos de tarjeta).

### Verificación de Google
`gmail.readonly` es alcance restringido. Estado (Centro de verificación, 14-nov-2026): la marca y el acceso a datos
**se enviaron antes y no se aprobaron**; ninguno está verificado. Publicación: **En producción sin verificar**, con
el límite de OAuth en **18 de 100 usuarios** (de por vida, no se restablece). Pasos, costos (CASA Tier 2 desde ~USD 540/año) y qué hacer
mientras tanto: `27-lanzamiento.md` §A. Es el costo fijo más grande y bloquea el lanzamiento abierto.

#### Verificación de N1 (13-nov-2026, rama `feat/apoyar-topi`)
- `go test ./...` verde; integración de repositorios verde contra Postgres 16 con `schema_v17.sql` (incluye
  `TestPaymentRepository_Integration`: 5 webhooks concurrentes → una sola aprobación; pago doble → su propia fila);
  000045 `down` + `up` sin errores.
- jest: 127 pruebas verdes (12 nuevas en `components/support`); `App.test.js` ya fallaba antes (react-router-dom 7
  en el jest de CRA). `npm run build` verde.
- Punta a punta local con un Mercado Pago **falso** que firma igual que el real (`x-signature`): preferencia →
  checkout → webhook firmado → aprobado → recibo `billing_generic` (outbox con solo `payment_id`); webhook repetido 3
  veces → 1 fila y 1 recibo; sin firma → 401; `?collection_status=approved` en la URL no aprueba nada; rechazado y
  sección Dinero con capturas en `topiv2/capturas-apoyar/`.
- **Sandbox real (14-nov-2026, Orders API, credenciales de prueba de JuanMa):** hoja → $ 10.000 → order
  `ORDTST01M7DBBAKZRXMKY00TYK0NEZG0` → checkout de Mercado Pago con la tarjeta de prueba Mastercard, titular `APRO`
  (sin cuenta de prueba, correo de ejemplo) → "¡Listo! Tu pago ya se acreditó" → "Volver a la tienda" → la página de
  gracias quedó en aprobado porque la API leyó la order (`processed/accredited`). Recibo `billing_generic` generado
  una vez (Valor $10.000, Referencia = la order). Webhook firmado con la **firma secreta real** 3 veces → 200 y 1 sola
  fila; firma inválida o sin firma → 401. Capturas 11–13 en `topiv2/capturas-apoyar/`.
- **No cubierto en local:** que Mercado Pago entregue el webhook a una URL pública (no llega a localhost) y el envío
  real del recibo por Resend (en local `MAIL_PROVIDER=log`). Se comprueba en el primer deploy con el paso B9 del RUNBOOK
  ("Simular notificación" → 200).

## Criterios de aceptación
- [x] Etapa 1 completa (ver `25-admin-metricas.md`).
- [x] Spike documentado; Apoyar a Topi de punta a punta en sandbox; webhook con firma inválida → 401;
      repetido → no duplica; recibo por correo. (14-nov-2026; entrega del webhook a URL pública y envío por Resend
      se verifican en el deploy, ver "Verificación de N1".)
- [ ] `Entitlements` con tests de tabla (free, elegible, confirmado, plus activo, past_due, cancelado).
- [ ] Ninguna función existente queda limitada para usuarios actuales (revisión explícita).
- [ ] (Etapa 5) Suscribir y cancelar en sandbox; cancelar mantiene Plus hasta fin de periodo.
- [x] (Etapa 2) Migraciones con `down`; `go test ./...`, jest y `npm run build` verdes; cero secretos.
      (000045 down→up probado; `go test ./...` e integración verdes; jest 127/127 — `App.test.js` falla igual que en
      `main`, react-router-dom 7 en el jest de CRA —; build verde; `git grep` de secretos limpio. Commits 1566270…0a8e238.)
- [x] (Etapa 2) Apoyar a Topi apagable sin perder notificaciones: `SUPPORT_ENABLED=false` → config `enabled:false`,
      `POST /billing/support` 404, webhook firmado 200 y sin firma 401, pago existente consultable (14-nov-2026,
      `TestSupportDisabledByFlag` y prueba contra la API local con las credenciales de prueba).
