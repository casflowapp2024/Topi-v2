# Prompt para Claude Code — UX Fase 3 (Vistas)

> Abre Claude Code en `C:\Users\juanm\WorkSpace\topiv2\topi` y pega lo de abajo.

---

Seguimos con la mejora de UX/UI de Topi. Las Fases 0, 1 y 2 (cimientos, paleta, gráficas) ya están en
`main`. Ahora vamos con la **Fase 3: Inicio nuevo y bandeja "Por revisar"**.

Lee completos `CLAUDE.md`, `apps/web/brand_guidelines.md` y `plan/20-ux-fase-3-vistas.md`. Esa última es la
especificación: principio rector, tareas A–E, componentes a reutilizar, reglas de diseño y criterios de
aceptación. Mira también `apps/web/tailwind.config.js` (tokens) y `apps/web/src/components/ui/` y
`components/charts/` antes de crear nada nuevo.

Restricciones críticas:
1. El espíritu de la app es que las transacciones llegan solas. **No** agregues botones de "agregar
   transacción" protagonistas ni flotantes; la acción principal es revisar.
2. Solo front (`apps/web`). Si para algo de la spec hace falta la API (p. ej. el total de presupuesto
   trae transferencias, o falta un campo), **detente, muéstrame la evidencia y propón el cambio**; no lo
   hagas sin mi OK. La historia de patrimonio (Fase 3.B) está fuera de alcance.
3. Reutiliza `ui/*`, `charts/*`, helpers y acciones existentes; extiende con props (p. ej. `compact` en
   `ProjectionChart`) en vez de duplicar componentes. Solo tokens de Tailwind, nada de hex sueltos nuevos.
4. Un solo árbol responsive (`contents lg:flex` + `order-*`), modo oscuro completo, móvil 360px sin
   scroll horizontal, estados con ícono + palabra.
5. Cero secretos; no toques los repos viejos ni el dump; nada de correos reales en datos de prueba.
6. Tests de jest: se necesitan los mocks que ya usan `components/ux.test.js` y
   `components/charts/charts.test.js` (axios, react-router-dom, selectores de fecha, ResponsiveContainer
   con width 500). Síguelos.

Forma de trabajo:
- Trabaja en la rama `feat/ux-fase-3-vistas` desde `main`.
- Primero dame un plan corto: componentes nuevos, archivos que cambian o se borran (DashStats,
  DashStatsCard, DashTrans en el Inicio), de dónde sale cada dato de las 3 tarjetas y de la bandeja, y si
  encontraste algo en el código que choque con la spec. Espera mi OK.
- Orden, con commits pequeños: (A) tarjetas Ritmo/Flujo/Patrimonio + layout del Inicio (C),
  (B) bandeja "Por revisar", (D) baja prominencia de "Agregar", (E) Transacciones agrupadas por día.
- Tras cada bloque: tests nuevos + `CI=true npx react-scripts test --watchAll=false` y, al final,
  `npm run build` en `apps/web`.
- Al final levanta la app, toma capturas del Inicio y Transacciones en 360px y 1440px, claro y oscuro,
  verifica los criterios de aceptación de `plan/20-ux-fase-3-vistas.md` marcando los checkboxes y
  muéstrame comandos y salidas resumidas. No hagas merge a `main` hasta que yo lo pruebe.
- Si algo de la especificación choca con el código real, detente y pregúntame.
