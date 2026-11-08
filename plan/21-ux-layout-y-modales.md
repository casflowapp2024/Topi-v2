# UX — Layout de PC y modales (antes de la Fase 4)

Dos frentes: (A) la barra superior y las vistas comparten contenedor y aprovechan el ancho;
(B) los modales que aún tienen el diseño de la app original se alinean con el sistema actual.

---

## A. Layout de PC

### Problema
`hocs/Layout.js`: la barra usa `lg:max-w-[1200px]` (línea ~208) y el contenido `lg:w-[806px] xl:w-[930px]`
(línea ~272). Son dos anchos distintos: la barra se ve más ancha que los dashboards y el periodo queda
"suelto" a la derecha. Además en 1440px sobra mucho espacio y el Inicio se aprieta.

### Decisiones (estándar de dashboards)
1. **Un solo contenedor** para barra y vistas: componente `ui/PageContainer.jsx`
   (`w-full max-w-[1440px] mx-auto px-4 lg:px-6`). La barra y el `<main>` lo usan. Se borran los
   `w-[806px]` / `w-[930px]` y los `md:max-w-[560px] ... lg:max-w-none` de las vistas pasan a depender del
   contenedor (en tablet se puede mantener la columna centrada de 560px).
   Criterio: el borde izquierdo del logo = borde izquierdo de la primera tarjeta; el borde derecho del último
   control de la barra = borde derecho de la última tarjeta, en las 4 vistas.
2. **Ancho fluido con tope 1440px.** Grilla de 12 columnas en PC:
   - Inicio: fila 1 = Ritmo · Flujo · Patrimonio (4/4/4). Fila 2 = gráficas (8) + lateral con
     Por revisar y Presupuestos (4). Cuentas abajo a lo ancho. Que Patrimonio vuelva a la fila de arriba
     (hoy Por revisar ocupa su lugar).
   - Presupuestos, Cuentas y Transacciones: revisar que sus columnas escalen al nuevo ancho
     (nada de anchos fijos `w-[NNNpx]`; usar `grid-cols-12`/`col-span-*` o `flex-1` + `basis`).
   - Probar en 1280, 1440 y 1920: en 1920 el contenido queda centrado a 1440.
3. **Barra superior**:
   ```
   [Topi]  General · Presupuestos · Cuentas · Transacciones          [‹ Nov 2026 ›]  (JM)
   ```
   - Navegación a la izquierda junto al logo (no centrada). Pestañas más livianas: activa con píldora suave
     `bg-topi-50 text-topi-600` (oscuro `bg-topi-500/15 text-topi-200`) o subrayado; inactivas texto `ink-2`
     sin borde ni sombra. Íconos se mantienen. Quitar los `bg-[#5266EB]` sueltos.
   - El **logo siempre lleva al Inicio** (no abre menús).
   - **Periodo** se queda en la barra (afecta todas las vistas), con menos peso visual: sin borde de botón,
     flechas discretas, mismo `PeriodSelector`.
   - **Menú de usuario** a la derecha: avatar con iniciales (`Menu` de headlessui) que reemplaza los botones
     de tema y configuración. Contenido:
     - Nombre y correo del usuario (encabezado del menú).
     - Configuración · Conexiones.
     - Tema: control segmentado **Claro · Oscuro · Sistema**. "Sistema" es el valor por defecto
       (`prefers-color-scheme` + listener); la elección se guarda como hoy.
     - Cerrar sesión.
   - Accesible: navegable con teclado, `aria-current="page"` en la pestaña activa, foco visible.
4. **Móvil**: no cambia la barra inferior. El ícono de configuración de la barra superior pasa a ser el
   mismo menú de usuario (mismo contenido, en `Sheet` si es más cómodo).

---

## B. Modales

### Inventario (estado actual)
| Modal | Archivo | Hallazgos |
|---|---|---|
| Crear transacción | `transactions/CreateTransaction.js` | Dialog propio; botón `bg-[#5266EB] rounded-lg hover:bg-blue-600 w-28` (estilo viejo); solo 3 clases `dark:`; inputs sin estilo común |
| Detalle/editar transacción | `transactions/TransactionDetail2.js` | Ya rediseñado en parte (estados borrar/editar); `w-[140px]` fijo; panel `#151C2C` |
| Crear cuenta | `accounts/AccountCreate.js` | Dialog propio, `#5266EB` suelto, 5 `dark:`; `DropDownBanks` con estilo propio |
| Detalle cuenta / Editar cuenta | `accounts/AccountDetail.js`, `accounts/EditAccounts.js` | `#5266EB` suelto; EditAccounts casi sin modo oscuro |
| Cambio de moneda | `accounts/CurrencyChangeWizard.js` | Más reciente; usa `ui/Button`; tomar como referencia |
| Crear presupuesto | `expensePlan/CreateCategory.js` | Dialog propio, 3 `dark:` |
| Configurar presupuesto | `expensePlan/EditCategory.js` | 419 líneas; inputs `bg-gray-50 border-gray-300 rounded-lg dark:bg-gray-600` (Flowbite viejo); `w-[65px]`; 4 `#5266EB` |
| Panorama de presupuestos (ampliar) | `dashboard/budgetCategories/FullBudgetsModal.js` | `div fixed` sin Dialog (sin Esc/foco atrapado); colores `indigo-*` fuera de la paleta; solo muestra el monto presupuestado, sin gastado ni estado; **solo gastos**: el botón se oculta con `!isIncome` y recibe `expenses_report` |
| Transferencias | `transactions/TransferModal.js`, `TransferCandidatesModal.js` | Recientes; revisar solo consistencia |
| Configuración de usuario | `settings/UpdateSetts.js` | El más viejo: `rounded-lg`, `w-[552px]`, sin modo oscuro, `class=` en vez de `className` |

Común a todos: cada uno copia su propio `Dialog` + `Transition` + header + botón cerrar; el panel oscuro es
`#151C2C` (hex suelto) mientras las tarjetas usan `gray-800`; botones e inputs sin componente común.

### Decisiones
1. **Componente `ui/Modal.jsx`** (hermano de `ui/Sheet.jsx`, misma API: `open, onClose, title,
   description, children, footer, size`):
   - PC (`sm+`): diálogo centrado, `rounded-3xl`, tamaños `sm|md|lg|xl|full`.
   - Móvil: hoja inferior (como `Sheet`) con agarradera; acciones fijas abajo.
   - Header con título + botón cerrar (`aria-label="Cerrar"`), cuerpo con scroll, footer con acciones:
     primaria a la derecha (`ui/Button`), secundaria `ghost` a la izquierda de la primaria; en móvil
     botones a lo ancho.
   - Esc, clic fuera y foco atrapado (headlessui). `motion-reduce` respetado.
   Regla de uso: **formularios cortos → `Modal`**; **detalle con mucho contenido o que acompaña una lista
   (detalle de transacción, detalle de cuenta) → `Sheet` lateral**.
2. **Token de superficie**: agregar en `tailwind.config.js` `surface: { DEFAULT: '#FFFFFF', raised:
   '#151C2C' }` (o el nombre que encaje con lo existente) y reemplazar todos los `#151C2C` sueltos
   (Sheet incluido).
3. **Campos comunes** `ui/Field.jsx` (label, ayuda, error) + estilos de `Input`/`Select`/`Textarea`:
   `rounded-xl`, borde `gray-200` / `dark:gray-700`, fondo `white` / `dark:gray-900`, foco
   `ring-topi-500`, error `status-crit-text` con ícono. Reutilizar `InputMoneyInt2Decs` para montos (ya
   tiene estilos oscuros) y `DropDownCat` para categorías.
4. **Migrar cada modal** a `Modal`/`Sheet` + `Button` + `Field`, sin cambiar lógica ni acciones redux:
   CreateTransaction, AccountCreate (+ DropDownBanks), AccountDetail/EditAccounts, CreateCategory,
   EditCategory, UpdateSetts. TransactionDetail2, TransferModal, TransferCandidatesModal y
   CurrencyChangeWizard: solo cambiar al contenedor común y tokens.
   - Crear transacción: monto grande primero, luego categoría (chips de las 6 más usadas + "Otra…"),
     cuenta y fecha con valores por defecto. Es acción secundaria: no hacerla más visible.
   - Configurar presupuesto: mostrar el gastado del mes y el estado (`BudgetProgress`) junto al monto
     que se edita, para decidir con contexto.
5. **Panorama de presupuestos** (rediseño de `FullBudgetsModal` con `Modal size="full"`):
   - Interruptor **Gastos | Ingresos** dentro del modal, iniciado en la pestaña activa de la vista
     (`active_report_tab`); el botón de ampliar se muestra en **ambas** pestañas y se le pasan
     `expenses_report` e `income_report`.
   - Resumen arriba: presupuestado total, gastado/recibido, % y estado (para ingresos, llegar al 100 % es
     bueno: usar `BudgetProgress` con `isIncome`).
   - Grilla de tarjetas por categoría: emoji, nombre, `gastado de presupuesto`, `BudgetProgress` con marca
     de ritmo y estado con ícono + palabra. Orden: por % de uso (desc) con opción por monto.
   - Clic en una tarjeta = cierra y selecciona esa categoría en la vista (`set_dash_category_activated`).
   - Sin `indigo-*`: solo tokens (topi, data, status, ink). Sin transferencias en los totales.

---

## Reglas de diseño (iguales a la Fase 3)
Solo tokens de Tailwind; estados con ícono + palabra; contraste ≥ 4,5:1; modo oscuro completo; sin anchos
fijos nuevos; móvil a 360px sin scroll horizontal; formatos con helpers.

## Criterios de aceptación
- [x] Barra y vistas comparten `PageContainer`; bordes alineados en las 4 vistas a 1280, 1440 y 1920px.
      (Contenido hasta 1168px; medido en las 4 vistas: 51–1219, 131–1299 y 371–1539px; `scrollbar-gutter:
      stable` evita el salto de 5px entre vistas con y sin scroll.)
- [x] Inicio con grilla de 12 columnas: Ritmo · Flujo · Patrimonio arriba; gráficas + lateral abajo.
      **Cambiado por decisión del usuario (6-nov):** se mantiene el layout anterior con proporciones:
      fila 1 Ritmo (1,5× Flujo) · Flujo · Por revisar; Patrimonio horizontal debajo de Ritmo+Flujo y encima
      de las gráficas; Presupuestos al lado llenando esa altura; Cuentas debajo. Columnas en `fr`
      (`homeGrid.test.js`).
- [x] Barra: nav a la izquierda, logo → Inicio, periodo discreto, menú de usuario con Configuración,
      Conexiones, Tema (Claro/Oscuro/Sistema, por defecto Sistema) y Cerrar sesión. Sin botones sueltos de
      tema/config.
- [x] Existe `ui/Modal.jsx`; ningún modal define su propio `Dialog`+`Transition` salvo `Modal` y `Sheet`.
      (`grep -rln "<Dialog" apps/web/src` → solo `ui/Modal.jsx` y `ui/Sheet.jsx`.)
- [x] `grep -rn "#151C2C\|#5266EB\|indigo-" apps/web/src/components` no encuentra usos en los modales
      migrados (ni en Layout). Quedan `#5266EB` fuera de modales: landing, `conexions/ConnectEmail`,
      `LinkTransEmailForm`, `DropDownAccounts`, `navigation/Footer`, la variable CSS de `DatePicker` y la
      paleta JS de `charts/chartTheme.js` (Recharts necesita el valor). `indigo-*`: ninguno.
- [x] Panorama de presupuestos muestra Gastos e Ingresos con gastado/recibido, % y estado; Esc lo cierra.
- [x] Todos los modales funcionan en claro/oscuro, 360px y PC; Esc y clic fuera cierran; foco atrapado.
      (12 modales/hojas capturados a 1440 y 360, claro y oscuro, sin scroll horizontal; Esc cierra solo el
      de arriba en los anidados. Onboarding, Siguientes pasos, Instalar y Error de conexión: por tests.)
- [x] Tests nuevos (Modal, menú de usuario/tema, Panorama con ingresos) + suite de jest verde y
      `npm run build` sin errores. (78/78; solo falla `App.test.js`, que ya fallaba en main.)
