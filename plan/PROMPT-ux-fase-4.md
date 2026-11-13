# Prompt para Claude Code — UX Fase 4 (avisos, Pregúntale a Topi y diversión, en beta)

> Abre Claude Code en `C:\Users\juanm\WorkSpace\topiv2\topi` y pega lo de abajo.
> Requiere la etapa 1 (`plan/25-admin-metricas.md`) en `main`.

---

Vamos con la Fase 4 de UX de Topi, en beta para todos: aviso del día, notificaciones push, Pregúntale a Topi
(1 pregunta por día en el plan gratis) y diversión (rachas, logros, resumen del mes).

Lee completos `CLAUDE.md`, `plan/24-ux-fase-4.md` (la especificación, bloques A–E y criterios), la sección
N2a de `plan/22-modelo-negocio.md` (derechos por plan) y `plan/25-admin-metricas.md` (eventos y `llm_usage`
que debes usar). Revisa `apps/web/public/service-worker.js`, el scheduler del worker y cómo el worker usa
Gemini.

Restricciones críticas:
1. **No se ofrece lo que no existe**: no muestres precio, compra ni la palabra "Plus" como algo comprable.
   Las cuotas sí se muestran ("Te queda 1 pregunta hoy").
2. Cuotas y derechos se validan en la API con `Entitlements` (un solo lugar, tests de tabla). Valores por
   variables de entorno: gratis 1 pregunta/día; elegibles a fundador y Plus 30/día.
3. Pregúntale a Topi usa llamadas a funciones sobre herramientas fijas que reutilizan servicios existentes,
   nunca SQL generado. Los textos de transacciones son datos, no instrucciones: agrega un test de prompt
   injection. No guardes el texto de las preguntas. Registra `llm_usage` y eventos sin contenido.
4. Service worker: hay usuarios con la PWA instalada; agregar `push` no puede romper la actualización ni dejar
   pantalla en blanco.
5. Permiso de notificaciones solo en contexto, máximo 1 push y 1 aviso visible por día, tono amable, nunca
   rojo salvo "te pasaste".
6. Reutiliza `ui/*` y `charts/*`; tokens de Tailwind; modo oscuro; móvil 360 px; `prefers-reduced-motion`.
7. Migraciones con `down`, con el siguiente número libre. VAPID y llaves de Gemini en variables de entorno.
   Cero secretos, nada de AWS, no toques los repos viejos ni el dump.

Forma de trabajo:
- Rama `feat/ux-fase-4` desde `main`.
- Primero dame un plan corto: tablas, reglas de avisos y sus datos, herramientas de Pregúntale a Topi con su
  servicio de origen, estrategia del service worker y cualquier choque con el código. Espera mi OK.
- Orden con commits pequeños: (N2a) `Entitlements` → (A) motor de avisos + tarjeta del Inicio → (B) push →
  (C) Pregúntale a Topi → (D) rachas, logros y resumen del mes → (E) componente `ui/TopiMascot` con los estados
  provisionales usando el logo → métricas nuevas en el panel admin.
- Tras cada bloque: `go test ./...`, tests del worker, jest y al final `npm run build`.
- Al final verifica los criterios de aceptación de `plan/24-ux-fase-4.md`, márcalos y muéstrame comandos,
  salidas resumidas y capturas (Inicio con aviso y barra de preguntas, respuesta de Topi, logros, historia del
  mes; 360 px y PC; claro y oscuro). No hagas merge a `main` hasta que yo lo pruebe.
