# Modelo de negocio — cubrir la operación sin incomodar al usuario gratis

Objetivo: que Topi **se pague sola** (servidor, IA, verificación de Google, dominio), no hacerse rico.
Principio: **gratis es todo lo que la app promete; se paga lo que cuesta dinero extra o lo usa el usuario
avanzado.** Sin anuncios, sin vender datos, sin pruebas que caducan, sin patrones oscuros.

> Nota: esto no es asesoría legal ni tributaria. Los puntos de facturación (DIAN), retracto y habeas data
> hay que validarlos con un contador/abogado antes de cobrar.

## 1. Costos a cubrir (supuestos a medir)

| Costo | Tipo | Cómo se mide |
|---|---|---|
| Servidor Hetzner + Coolify, backups | Fijo mensual | Factura |
| Dominio + correo transaccional (plan gratis, ver `23-correo-transaccional.md`) | Fijo | Factura |
| Gemini (lectura de correos y, en Fase 4, Pregúntale a Topi) | Variable por usuario | **Nuevo: `llm_usage`** |
| Verificación de Google para `gmail.readonly` (CASA anual) | Fijo anual, probablemente el mayor | Cotización |
| WhatsApp (si se activa) | Variable por mensaje | Factura Meta |
| Apple Developer / Google Play (si hay apps nativas) | Fijo anual / único | — |

Punto de equilibrio aproximado: `costos_mensuales / precio_neto_plus`. Con ~US$50–100/mes y ~US$2,5 neto
por suscriptor, son 20–40 suscriptores; con 2–5 % de conversión, ~1.000 usuarios activos.

### Verificación de Google (bloqueante a revisar primero)
El flujo actual (ventana emergente de OAuth + callback) es el correcto; lo que importa es **el estado de la
pantalla de consentimiento** del proyecto de Google Cloud, porque el alcance `gmail.readonly` es
"restringido":
- **Testing**: solo entran usuarios agregados a mano como "test users" y los tokens vencen cada 7 días.
- **En producción sin verificar**: el usuario ve "Google no ha verificado esta app" y hay un tope de 100
  usuarios para alcances restringidos.
- **En producción verificada**: sin advertencia ni tope; exige la evaluación de seguridad **CASA** cada año.
Cómo verlo: Google Cloud Console → Google Auth Platform → *Audience* (estado) y *Verification Center*.
Tarea: registrar el estado en este archivo y, si no está verificada, presupuestar la verificación + CASA.
Outlook (Microsoft) pide verificación de editor; es más liviana.

## 2. Planes

### Topi (gratis, para siempre)
- Lectura automática de hasta **2** conexiones de correo.
- Cuentas, presupuestos, "Por revisar", Inicio completo, gráficas, multimoneda.
- Avisos dentro de la app y notificaciones push (Fase 4).
- Historial completo de lo que ya existe (no se esconde nada que hoy se ve).

### Topi Plus (hipótesis de precio: COP 9.900/mes o 79.900/año)
- **Pregúntale a Topi** (Fase 4; gratis: unas pocas preguntas al mes para probar).
- Avisos por **WhatsApp** (cuando exista el canal).
- **Hogar / pareja**: cuentas y presupuestos compartidos (futuro).
- Hasta **5** conexiones de correo.
- Exportar a Excel/CSV, metas y resumen mensual completo.
- Insignia "Plus" discreta y prioridad en soporte.

### Fundadores
Todo usuario creado antes de la fecha de lanzamiento de Plus queda con **Plus de por vida**
(`users.founder = true`). Se comunica como agradecimiento.

### Apoyar a Topi
Pago único voluntario (montos sugeridos COP 10.000 / 20.000 / 50.000 o libre). Sale primero porque valida la
disposición a pagar sin construir todo Plus.

### Reglas
1. Nada que hoy es gratis pasa a ser pago.
2. Los límites se muestran como información amable, nunca bloquean a mitad de una tarea ni esconden datos.
3. Cancelar es igual de fácil que suscribirse (2 clics), desde Configuración.
4. Sin publicidad, sin vender ni compartir datos, sin recomendaciones pagadas de productos financieros.
5. Un usuario que deja de pagar vuelve a gratis: no pierde datos; las funciones Plus quedan en solo lectura.

## 3. Implementación técnica

### N0 · Medir (antes de cobrar)
- Migración `llm_usage` (user_id, feature `email_parse|ask`, model, tokens_in, tokens_out, created_at) con
  `down`. El worker registra los tokens de cada llamada a Gemini (sin guardar el contenido).
- Endpoint admin `GET /admin/metrics/costs?month=` → usuarios activos (con transacción o login en el mes),
  tokens y costo estimado por usuario (precio por token en variable de entorno, no en código).
- Vista admin mínima en el front (solo rol admin).

### N1 · Apoyar a Topi
- Puerto `domain.Billing` con adaptador de pasarela. **Spike primero** (½ día, sin código de producción):
  comparar Wompi y Mercado Pago para (a) pago único con link/checkout, (b) cobro recurrente en Colombia
  (Mercado Pago "suscripciones/preapproval" vs Wompi con fuente de pago tokenizada + cobro que dispara
  nuestro scheduler), (c) webhooks con firma, (d) comisiones, (e) sandbox. Dejar la decisión escrita aquí.
- Tabla `payments` (id, user_id, provider, provider_ref único, kind `support|subscription`, amount, currency,
  status, raw_status, created_at, updated_at). Montos como decimal/string.
- Webhook `POST /billing/webhook/:provider`: valida firma, es **idempotente** por `provider_ref`, nunca
  confía en el front para marcar un pago.
- Front: botón "Apoyar a Topi" en el menú de usuario → hoja con montos → checkout de la pasarela →
  pantalla de gracias. Recibo por correo si el servicio de correo ya está (si no, se omite).

### N2 · Planes y derechos (entitlements)
- Migración: `subscriptions` (user_id, plan `free|plus`, status `active|past_due|canceled`,
  current_period_end, provider, provider_ref, cancel_at_period_end, timestamps) y `users.founder bool`.
  Script/migración que marca fundadores a todos los usuarios existentes.
- Dominio: `Entitlements(user, sub) → {plan, maxEmailConnections, askTopiMonthly, whatsapp, export,
  household}` en un solo lugar, con tests de tabla. Plus = founder || sub activa || dentro del periodo pagado.
- API: `GET /me/entitlements`; middleware `RequireEntitlement(feature)`; los límites se validan en la API
  (p. ej. crear una tercera conexión de correo en gratis → 402/403 con código propio documentado).
- Front: `useEntitlements()` (redux), componente `ui/PlusGate` (muestra la función y una hoja "Esto es de
  Plus" con beneficios y precio, sin bloquear la navegación), página **Planes** desde el menú de usuario y
  desde Configuración, estado de la suscripción y botón Cancelar.

### N3 · Cobro recurrente
- Según el spike: suscripción gestionada por la pasarela o cobro programado por el worker con fuente
  tokenizada. Reintentos: 3 intentos en 7 días → `past_due` → vuelve a gratis al terminar el periodo.
- Avisos (correo, si existe): pago recibido, pago fallido, suscripción por renovar (anual, 7 días antes).
- Página de Términos: precio, renovación, cancelación, retracto; Política de privacidad: que se guarda de
  pagos (solo referencia de la pasarela, nunca datos de tarjeta).

### Fuera de alcance
Hogar/pareja, WhatsApp, Pregúntale a Topi (llegan en Fase 4 o después; aquí solo quedan como derechos).

## 4. Criterios de aceptación
- [ ] Estado de verificación de Google anotado en este archivo.
- [ ] `llm_usage` se llena desde el worker y el admin ve costo estimado por usuario del mes.
- [ ] Spike de pasarela documentado con la decisión.
- [ ] "Apoyar a Topi" funciona en sandbox de punta a punta; webhook con firma inválida → 401; repetido →
      no duplica.
- [ ] Usuarios existentes son fundadores; `GET /me/entitlements` correcto para free, plus, founder,
      past_due y cancelado (tests de tabla).
- [ ] Gratis no pierde nada de lo que hoy tiene (revisión explícita de funciones).
- [ ] Suscribirse y cancelar en sandbox; cancelar mantiene Plus hasta fin de periodo.
- [ ] Migraciones con `down`; `go test ./...` y jest verdes; `npm run build` OK; cero secretos.
