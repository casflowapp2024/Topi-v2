# UX Fase 4 — Avisos, Pregúntale a Topi y diversión (beta)

Sale en **beta para todos**, con los límites del plan gratis visibles desde el día 1 (ver
`22-modelo-negocio.md`): así cuando se lance Plus nadie pierde nada. Requiere la etapa 1
(`25-admin-metricas.md`: `llm_usage`, `product_events`, campos de fundador) ya en `main`.

## A. Motor de avisos ("Aviso del día")
- Tabla `insights` (id, user_id, kind, priority, payload jsonb, for_day, created_at, seen_at, dismissed_at,
  feedback `up|down`, pushed_at). Único por (user_id, kind, clave de deduplicación, for_day).
- Generación diaria en el **scheduler del worker** (≈ 7:00 hora de Bogotá) + recálculo al llegar
  transacciones nuevas cuando aplique. Reglas v1 (cada una con test):
  1. **Ritmo de categoría**: "a este ritmo te pasas en Mercado el día 26" (usa la misma lógica de proyección
     del front, portada al back o calculada con los mismos datos).
  2. **Suscripción subió**: mismo comercio recurrente (≥ 3 meses) con monto mayor.
  3. **Cargo inusual**: monto muy por encima de lo habitual en ese comercio/categoría.
  4. **Tarjeta**: fecha de pago en ≤ 3 días con saldo del corte pendiente.
  5. **Ingreso grande / nómina** llegó.
  6. **Conexión caída** (en la app; el correo ya existe).
- Máximo **1 aviso visible por día** (el de mayor prioridad); el resto, en "Ver avisos anteriores".
  Tarjeta en el Inicio, descartable, con 👍/👎. Nunca en rojo salvo "te pasaste". Tono amable.
- Eventos: `insight_shown`, `insight_dismissed`, `insight_feedback`.

## B. Notificaciones push (PWA)
- Llaves VAPID en variables de entorno (Coolify), tabla `push_subscriptions` (user_id, endpoint, keys,
  user_agent, created_at, last_ok_at, failed_count); limpieza en 404/410.
- Service worker: evento `push` y `notificationclick` (abre la ruta del aviso). Cuidado con el SW actual y
  la PWA instalada: no romper la actualización.
- Pedir permiso **en contexto** (después del primer aviso útil, con una hoja que explica), nunca al cargar.
  En iPhone, guía para "Agregar a pantalla de inicio" (requisito de iOS).
- Preferencias en `notification_prefs` (columna nueva `push_daily_insight`), horario silencioso, máximo 1 push
  por día. Envío desde la API (Go, librería webpush) leyendo `insights` del día.

## C. Pregúntale a Topi
- Entrada: barra "Pregúntale a Topi…" en el Inicio (PC y móvil) con 3 preguntas sugeridas como chips.
- `POST /ask`: Gemini con **llamadas a funciones sobre herramientas fijas** (nunca SQL generado):
  `gasto_por_categoria(rango)`, `buscar_transacciones(filtros)`, `estado_presupuestos(mes)`,
  `flujo_mes(mes)`, `saldos_cuentas()`, `patrimonio()`, `comparar_periodos(a, b)`, `proximos_pagos_tarjeta()`.
  Cada herramienta reutiliza servicios existentes con el `user_id` del token.
- Respuesta corta en español: una frase, **el número** formateado y un botón de acción (ver movimientos
  filtrados, ir al presupuesto, ver cuenta). Fuera de finanzas personales → lo dice amablemente.
- Seguridad: descripciones de transacciones y nombres son **datos**, no instrucciones (defensa ante prompt
  injection); límite de tokens; timeout; sin enviar más datos que los que devuelven las herramientas.
- **Cuota**: `Entitlements.askTopiDaily` (gratis 1/día; Plus y fundadores elegibles 30/día; por variables).
  Contador visible ("Te queda 1 pregunta hoy"); al agotarse, mensaje amable con la hora de reinicio (medianoche
  Bogotá). Mientras Plus no esté a la venta, **no** se muestra precio ni botón de compra.
- Registro: `llm_usage` (feature `ask`) y evento `ask_topi_asked` (sin el texto). No se guarda el texto de la
  pregunta salvo opt-in futuro.
- Esto trae el **N2a** de `22-modelo-negocio.md` (`Entitlements`, `GET /me/entitlements`, middleware).

## D. Diversión
- **Rachas**: semanas seguidas sin pasarse del presupuesto total; días con Por revisar en cero.
- **Logros v1** (≈ 8): primera conexión, primer mes con ahorro, 10/50 ítems revisados, primer presupuesto,
  4 semanas sin pasarse en una categoría, 3 meses con datos al día, primera pregunta a Topi. Tabla
  `achievements (user_id, code, unlocked_at)`; los calcula el worker.
- Celebración breve (confeti 1 vez, respeta `prefers-reduced-motion`); el amarillo "Topi Sol" solo aquí.
- **Resumen del mes tipo historia** (día 1, en la app): 4–5 tarjetas deslizables (tu mes en un número,
  categoría ganadora, mejor semana, racha, meta). Opción de compartir como imagen con montos ocultos.

## E. Mascota (definición, no bloquea)
Hasta que se defina, los estados usan el logo con variaciones (tranquilo, atento, preocupado, celebrando,
pensando, dormido). Definir: origen del nombre "Topi", 3 adjetivos de personalidad, reglas de uso (estados
vacíos, logros, avisos; nunca tapa cifras ni regaña), estilo plano en 1–2 colores, SVG por estado. Cuando
exista, se reemplaza el componente `ui/TopiMascot` sin tocar las vistas.

## Reglas de diseño
Las mismas de fases anteriores: tokens de Tailwind, modo oscuro, móvil 360 px, estados con ícono + palabra,
skeletons, `ui/*` reutilizado (Card, Sheet, Modal, Button, Chip, EmptyState).

## Criterios de aceptación
- [ ] 6 reglas de avisos con tests; 1 aviso visible por día; descartar y 👍/👎 registran eventos.
- [ ] Push: suscribir, recibir, abrir la ruta, desuscribir; limpieza en 410; máx. 1 por día; permiso en
      contexto; SW actualiza sin pantalla en blanco.
- [ ] Pregúntale a Topi responde las 8 herramientas con datos reales de prueba; no ejecuta instrucciones
      embebidas en descripciones (test); cuota 1/día en gratis y 30/día en elegibles/Plus (tests de
      `Entitlements`); `llm_usage` registrado.
- [ ] No aparece precio ni compra de Plus en ninguna parte.
- [ ] Rachas, logros y resumen del mes funcionando; `prefers-reduced-motion` respetado.
- [ ] Métricas nuevas visibles en el panel admin (preguntas/día, % que llega al límite, feedback de avisos).
- [ ] Migraciones con `down`; `go test ./...`, tests del worker, jest y `npm run build` verdes; cero secretos.
