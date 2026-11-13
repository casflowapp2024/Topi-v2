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
