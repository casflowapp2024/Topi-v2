# Modelo de negocio — cubrir la operación sin incomodar al usuario gratis

Objetivo: que Topi **se pague sola** (servidor, IA, verificación de Google, dominio, correo), no hacerse rico.
Principios:
1. **Gratis es todo lo que la app promete** (lectura automática, cuentas, presupuestos, Por revisar, avisos).
2. **No se ofrece lo que no existe.** Plus sale a la venta solo cuando sus funciones ya están en producción.
3. **Nada gratis se vuelve pago.** Por eso toda función nueva nace con su límite de plan gratis visible.
4. Sin anuncios, sin vender datos, sin pruebas que caducan, cancelar tan fácil como suscribirse.

> No es asesoría legal ni tributaria: facturación (DIAN), retracto y habeas data se validan con un
> contador/abogado antes de cobrar.

## Orden (reemplaza el orden N0–N3 anterior)

| Etapa | Qué | Promete algo pago | Plan |
|---|---|---|---|
| **1. Medir + fundadores** | Panel admin, métricas, North Star, costo por usuario, lista de fundadores | No | `25-admin-metricas.md` |
| **2. Apoyar a Topi** | Pago único voluntario (spike Wompi vs Mercado Pago) | No | este archivo, §N1 |
| **3. Fase 4 en beta** | Avisos, push, Pregúntale a Topi (**1 pregunta/día gratis**), diversión; derechos por plan ya activos | No (todo lo existente es gratis con límites) | `24-ux-fase-4.md` |
| **4. Lanzar Plus** | Planes, cobro recurrente, página Planes, fundadores confirmados | Sí, cuando 1–3 están en prod | este archivo, §N2–N3 |

Decidir precio y contenido final de Plus con 1–2 meses de datos de la etapa 3 (uso de la IA, % de usuarios
que llegan al límite diario, costo por usuario activo).

## Planes

### Topi (gratis, para siempre)
- Lectura automática de hasta **2** conexiones de correo; cuentas, presupuestos, Por revisar, Inicio,
  gráficas, multimoneda, patrimonio.
- Aviso del día dentro de la app y notificaciones push.
- **Pregúntale a Topi: 1 pregunta por día.**
- Correos: recuperación, conexión caída, resumen mensual.

### Topi Plus (hipótesis: COP 9.900/mes o 79.900/año; se confirma en la etapa 4)
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
- Fundador confirmado = Plus de por vida. El admin revisa y confirma la lista en el panel (§ en plan 25).
- No se borran usuarios ni datos por no ser fundadores; limpiar cuentas abandonadas es otra decisión (habeas
  data) que requiere OK explícito.

## Implementación

### N1 · Apoyar a Topi (etapa 2)
- **Spike** (½ día, sin código de producción): Wompi vs Mercado Pago para (a) pago único por link/checkout,
  (b) cobro recurrente en Colombia, (c) webhooks con firma, (d) comisiones, (e) sandbox. Decisión escrita
  aquí antes de codificar.

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

**Decisión: Wompi** para la etapa 2 (Apoyar a Topi), con el adaptador detrás del puerto `Billing` para poder sumar
Mercado Pago sin tocar el core.
- El pago único es justo lo que Wompi hace mejor: un formulario firmado en el servidor, sin SDK ni preferencia por
  pago, en COP y con Nequi/PSE/Bancolombia, que es como paga la mayoría de los usuarios colombianos.
- El webhook trae el estado final firmado: se verifica el checksum y, por seguridad, se confirma con
  `GET /v1/transactions/{id}` antes de marcar el pago. Mercado Pago siempre obliga a esa segunda llamada.
- Comisión probablemente menor en montos de 10.000–50.000 (por confirmar), sin mensualidad.
- La documentación oficial de Wompi se leyó completa; la de Mercado Pago quedó a medias (503 en webhooks y tarifas).

**Lo que se pierde (para la etapa 4):** Wompi no tiene suscripciones nativas. El cobro recurrente sería con fuentes de
pago: un job del worker cobra al vencer `current_period_end`, con los reintentos (3 en 7 días) y `past_due` que N3
ya pide. Es más trabajo que `preapproval` de Mercado Pago. Se decide de nuevo al llegar a la etapa 4: si mantener el
calendario propio resulta caro, Mercado Pago entra como segundo adaptador solo para `subscription`.

**Antes de producción (pasos manuales):** cuenta de comercio Wompi, confirmar tarifa en el panel, configurar la URL
de eventos por ambiente, y que contador/abogado revisen si un aporte voluntario necesita factura electrónica (DIAN).
- Puerto `domain.Billing` + adaptador. Tabla `payments` (id, user_id, provider, provider_ref único,
  kind `support|subscription`, amount decimal, currency, status, raw_status, timestamps).
- Webhook `POST /billing/webhook/:provider`: firma verificada, idempotente por `provider_ref`; el front nunca
  marca un pago.
- Front: "Apoyar a Topi" en el menú de usuario → hoja con montos (10.000 / 20.000 / 50.000 / libre) →
  checkout → gracias. Recibo con la plantilla `billing_generic` del correo (ya existe).

### N2a · Derechos mínimos (se hace dentro de la Fase 4, etapa 3)
- `users.founder_eligible bool`, `users.founder_confirmed_at timestamptz` (de la etapa 1).
- Dominio: `Entitlements(user, sub)` en un solo lugar → `{plan, askTopiDaily, maxEmailConnections, ...}`.
  Hoy: `free` (ask 1/día, 2 conexiones) y `plus` (= fundador confirmado o suscripción activa; ask 30/día,
  5 conexiones). Valores por variables de entorno con defaults.
- `GET /me/entitlements`, middleware `RequireEntitlement`, cuotas validadas en la API.
- Mientras Plus no se lance, **los elegibles a fundador se tratan como Plus** (para que no "pierdan" nada al
  confirmarse). El límite de conexiones solo aplica a conexiones nuevas: nadie pierde una conexión existente.

### N2 · Planes (etapa 4)
- Tabla `subscriptions` (user_id, plan, status `active|past_due|canceled`, current_period_end, provider,
  provider_ref, cancel_at_period_end, timestamps).
- Front: página **Planes** (menú de usuario y Configuración), `ui/PlusGate` (muestra qué da Plus sin bloquear
  la navegación), estado de suscripción y Cancelar.

### N3 · Cobro recurrente (etapa 4)
- Según el spike. Reintentos 3 en 7 días → `past_due` → vuelve a gratis al terminar el periodo; sin perder
  datos (lo de Plus queda en solo lectura).
- Correos: pago recibido, pago fallido, renovación anual (7 días antes).
- Términos (precio, renovación, cancelación, retracto) y Privacidad (solo referencia de la pasarela, nunca
  datos de tarjeta).

### Verificación de Google (pendiente de anotar)
`gmail.readonly` es alcance restringido. Estado actual de la pantalla de consentimiento (Testing / Producción
sin verificar / Producción verificada): **por anotar**. Si no está verificada, presupuestar verificación +
CASA anual: es probablemente el costo fijo más grande.

## Criterios de aceptación
- [x] Etapa 1 completa (ver `25-admin-metricas.md`).
- [ ] Spike documentado; Apoyar a Topi de punta a punta en sandbox; webhook con firma inválida → 401;
      repetido → no duplica; recibo por correo.
- [ ] `Entitlements` con tests de tabla (free, elegible, confirmado, plus activo, past_due, cancelado).
- [ ] Ninguna función existente queda limitada para usuarios actuales (revisión explícita).
- [ ] (Etapa 4) Suscribir y cancelar en sandbox; cancelar mantiene Plus hasta fin de periodo.
- [ ] Migraciones con `down`; `go test ./...`, jest y `npm run build` verdes; cero secretos.
