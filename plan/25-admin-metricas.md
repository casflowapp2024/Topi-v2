# Panel de administración y métricas (etapa 1 del modelo de negocio)

Para qué: saber si Topi cumple su promesa, quién la usa de verdad (fundadores), qué cuesta y qué mejorar del
lector de correos. Solo rol `admin`.

## North Star Metric

**Usuarios al día semanales (UAS)**: usuarios que en los últimos 7 días
(a) recibieron **al menos una transacción leída automáticamente** y
(b) **abrieron la app** al menos una vez.

Por qué: el valor de Topi es "tus finanzas al día sin digitar". (a) mide que la promesa se cumple (la lectura
funciona) y (b) que al usuario le importa. Una app que lee pero nadie abre, o que se abre pero no lee, no
entrega valor. Se reporta semanal, con su tendencia de 12 semanas.

### Árbol de métricas (entradas que mueven la North Star)
1. **Activación**: % de registros nuevos con conexión de correo en 24 h; con 1.ª transacción automática en 48 h;
   con al menos un presupuesto en 7 días.
2. **Salud de lectura**: % de conexiones sanas; horas desde el último correo leído por conexión; errores por
   tipo; latido del worker.
3. **Automatización**: % de transacciones del mes creadas automáticamente vs. manuales (meta: > 90 %).
4. **Calidad**: tasa de corrección = % de transacciones automáticas cuya categoría o monto cambió el usuario;
   % que llega como `should_verify`; por banco (qué bancos/plantillas fallan más).
5. **Ciclo de revisión**: ítems en Por revisar creados vs. resueltos; mediana de tiempo hasta resolver.
6. **Retención**: cohortes semanales por fecha de registro (S1, S4, S12) sobre la definición de "al día".

### Métricas de control (que no se dañe nada al crecer)
- Costo por usuario activo (Gemini + correo + servidor prorrateado).
- Bajas de correo / push desactivados / avisos descartados (molestia).
- Correos enviados vs. cuota de Resend.
- (Fase 4) preguntas IA por día, % de usuarios que llegan al límite diario (señal de valor de Plus),
  👍/👎 de avisos.

## Datos nuevos (mínimos)
- `user_activity_days (user_id, day, PRIMARY KEY(user_id, day))`: se inserta desde el middleware de auth
  (`ON CONFLICT DO NOTHING`, con caché en memoria para escribir una vez por usuario y día). Fuente de
  DAU/WAU/MAU, "último conectado" y retención. Hoy `auth_events` solo registra logins, y con refresh tokens un
  usuario puede usar la app semanas sin login.
- `product_events (id, user_id, name, props jsonb, created_at)` con **lista cerrada** de nombres (p. ej.
  `tx_category_corrected`, `tx_amount_corrected`, `review_resolved`, `budget_created`, `insight_dismissed`,
  `insight_feedback`, `ask_topi_asked`). `props` sin montos, comercios ni texto libre. Retención 13 meses.
- `llm_usage (user_id, feature email_parse|ask, model, tokens_in, tokens_out, created_at)`: lo escribe el
  worker (lectura) y la API (preguntas). Precio por token en variables de entorno.
- `users.founder_eligible`, `users.founder_confirmed_at` (ver `22-modelo-negocio.md`). La migración marca
  elegibles a todos los usuarios con `created_at < FOUNDER_CUTOFF`.
- Lo demás sale de tablas existentes: `transactions` (`source_message_id` = automática), `processed_emails`,
  `emails` (estado de conexión), `email_jobs`, `worker_heartbeat`, `categories`, `accounts`, `email_outbox`,
  `auth_events`, `notification_prefs`.
- Consultas pesadas: vistas materializadas o una tabla `metrics_daily` que el worker recalcula de noche; el
  panel no debe hacer barridos completos en cada carga.

## Panel admin (front, ruta `/admin`, solo rol admin)
1. **Resumen**: North Star (número + tendencia 12 semanas), DAU/WAU/MAU, registros nuevos, árbol de métricas.
2. **Usuarios**: tabla con nombre, correo, registro, último día activo, conexiones (sanas/error), último correo
   leído, transacciones automáticas 30 d, fundador (elegible / confirmado). Filtros: activos 7/30/90 d,
   inactivos > 90 d, sin conexión, conexión caída. **Sin montos ni transacciones de nadie.**
3. **Fundadores**: elegibles agrupados en "activos en 90 d" y "sin actividad"; acción "Confirmar
   fundadores activos" (masiva, con resumen previo) y confirmar/quitar uno a uno. Queda en `auth_events`
   (o tabla de auditoría) quién y cuándo.
4. **Lectura**: correos procesados por día, transacciones automáticas vs. manuales, `should_verify`, tasa de
   corrección, top bancos con más errores/correcciones, conexiones por proveedor y estado, latido del worker.
5. **Catálogo**: categorías más usadas entre usuarios (por # usuarios y # transacciones), nombres de
   categorías personalizadas más repetidos (candidatas a categorías por defecto), cuentas por clase / banco /
   moneda, % usuarios con presupuestos y % que se pasa.
6. **Costos**: tokens y costo de Gemini por día y por usuario activo; correos enviados vs. cuota.
7. (Etapa 2+) **Dinero**: aportes de Apoyar a Topi.

### Privacidad
- Solo agregados, salvo la tabla de usuarios (necesaria para fundadores y soporte), que no muestra datos
  financieros.
- Nombres de categorías personalizadas y comercios solo si los usan **≥ 5 usuarios** (pueden contener datos
  personales).
- Todo acceso al panel queda auditado. Actualizar la Política de privacidad: métricas de uso agregadas para
  mejorar el servicio.

## Criterios de aceptación
- [x] Migraciones (desde **000040**) con `down`: actividad, eventos, llm_usage, campos de fundador.
      (000040 actividad, 000041 fundadores + admin_audit, 000042 eventos + llm_usage, 000043 precálculo; down→up probado.)
- [x] Middleware registra actividad diaria sin escribir en cada request (test).
      (`TestActivityService_WritesOncePerUserAndDay`: 100 requests = 1 escritura; `TestAuthMiddleware_TracksActivity`.)
- [x] El worker registra tokens de Gemini sin contenido; la API lo hará para preguntas en la Fase 4.
      (`usage_metadata` → `llm_usage`; `feature='ask'` ya admitido por la tabla para la Fase 4.)
- [x] Eventos de corrección y resolución de Por revisar emitidos desde la API (no desde el front).
- [x] `GET /admin/metrics/*` protegidos por rol (test 403 para usuario normal). (13 rutas `/admin/*`, cada acceso en `admin_audit`.)
- [x] Panel con las 6 secciones; North Star y cohortes cuadran con una consulta manual en la base restaurada.
      (`infra/scripts/sql/admin-check.sql`: 479 días, 0 diferencias; cohortes de todas las semanas, 0 filas distintas.)
- [x] Umbral k ≥ 5 aplicado (test). (SQL `HAVING` + servicio; integración con 4 vs. 5 usuarios.)
- [x] Fundadores: elegibles marcados; confirmar masivo e individual auditado.
- [x] `go test ./...`, tests del worker, jest y `npm run build` verdes; cero secretos.
      (jest: `App.test.js` falla igual que en `main` — react-router-dom 7 en el jest de CRA.)
