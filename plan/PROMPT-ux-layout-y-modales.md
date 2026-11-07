# Prompt para Claude Code — Layout de PC y modales

> Abre Claude Code en `C:\Users\juanm\WorkSpace\topiv2\topi` y pega lo de abajo.

---

Antes de la Fase 4 vamos a pulir dos cosas del front de Topi: el **layout de PC** (la barra superior y las
vistas no comparten ancho y se desperdicia pantalla) y los **modales** que aún tienen el diseño de la app
original.

Lee completos `CLAUDE.md`, `apps/web/brand_guidelines.md` y `plan/21-ux-layout-y-modales.md`. Esa última es
la especificación: problema, decisiones, inventario de modales con hallazgos y criterios de aceptación.
Revisa también `apps/web/tailwind.config.js`, `src/hocs/Layout.js`, `src/components/ui/` (sobre todo
`Sheet.jsx` y `Button.jsx`) y `accounts/CurrencyChangeWizard.js`, que es el modal más cercano al diseño
actual.

Restricciones críticas:
1. Solo front (`apps/web`). No cambies lógica de negocio, acciones redux ni contratos con la API: los modales
   se re-visten, no se reescriben por dentro. Si encuentras un bug real, repórtalo con evidencia y espera
   mi OK antes de corregirlo.
2. El logo siempre lleva al Inicio. Configuración y tema van en un menú de usuario a la derecha; el tema
   ofrece Claro · Oscuro · Sistema y "Sistema" es el valor por defecto.
3. Agregar transacción sigue siendo una acción secundaria: no la hagas más visible al rediseñar su modal.
4. Un solo componente de contenedor (`ui/PageContainer`) y un solo componente de diálogo (`ui/Modal`,
   hermano de `ui/Sheet`). Reutiliza `ui/*`, `charts/*`, `BudgetProgress`, `InputMoneyInt2Decs`,
   `DropDownCat` y helpers; extiende con props en vez de duplicar.
5. Solo tokens de Tailwind (agrega el token de superficie para reemplazar `#151C2C`); nada de hex sueltos
   ni `indigo-*`. Modo oscuro completo, móvil 360px sin scroll horizontal, estados con ícono + palabra,
   Esc/clic fuera/foco atrapado en todos los modales.
6. El Panorama de presupuestos debe incluir **Ingresos** además de Gastos, con lo gastado/recibido y el
   estado, no solo el monto presupuestado.
7. Cero secretos; no toques los repos viejos ni el dump; nada de correos reales en datos de prueba.
8. Tests de jest: sigue los mocks de `components/ux.test.js` y `components/charts/charts.test.js` (axios,
   react-router-dom, selectores de fecha, ResponsiveContainer con width 500).

Forma de trabajo:
- Rama `feat/ux-layout-modales` desde `main`.
- Primero dame un plan corto: componentes nuevos, archivos que cambian, cómo queda la grilla de cada vista
  y cualquier choque entre la spec y el código. Espera mi OK.
- Orden, con commits pequeños:
  (A1) `PageContainer` + barra superior (nav a la izquierda, periodo discreto, menú de usuario con tema);
  (A2) grilla de 12 columnas en Inicio y ajuste de Presupuestos, Cuentas y Transacciones al nuevo ancho;
  (B1) `ui/Modal`, token de superficie y `ui/Field`;
  (B2) migrar modales de transacciones; (B3) cuentas; (B4) presupuestos + Panorama con Ingresos;
  (B5) configuración de usuario y el resto (solo contenedor y tokens).
- Tras cada bloque: tests nuevos + `CI=true npx react-scripts test --watchAll=false`; al final
  `npm run build` en `apps/web`.
- Al final levanta la app y toma capturas de las 4 vistas en 1280, 1440 y 1920px y de cada modal en 360px y
  PC, claro y oscuro. Verifica los criterios de aceptación de `plan/21-ux-layout-y-modales.md` marcando los
  checkboxes, y muéstrame comandos y salidas resumidas. No hagas merge a `main` hasta que yo lo pruebe.
- Si algo de la especificación choca con el código real, detente y pregúntame.
