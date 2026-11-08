# UX Fase 3 — Vistas: Inicio nuevo y bandeja "Por revisar"

Continúa la propuesta de UX/UI (Fases 0–2 ya en `main`). Esta fase cambia **qué ve el usuario primero**.

## Principio rector

El valor de Topi es que **las transacciones llegan solas** (worker de correos). La app no debe invitar a
digitar; debe invitar a **revisar y entender**. Por eso:

- La acción principal del Inicio es **"Por revisar"** (confirmar lo que llegó), no "Agregar transacción".
- "Agregar" sigue existiendo, pero como acción secundaria (botón fantasma/ícono), nunca relleno `topi-500`
  ni flotante. Se descarta el "+" central que proponía la versión 1 de la propuesta.
- El Inicio responde tres preguntas, en este orden: **¿cómo voy este mes?**, **¿entra más de lo que sale?**,
  **¿cuánto tengo en total?**

## Alcance

### A. Inicio — fila de 3 tarjetas (reemplaza `DashStats` + `DashStatsCard`)

PC (`lg+`): una fila de 3 tarjetas de igual alto encima de todo. Móvil: apiladas en este orden (1, 2, 3).

**1 · Ritmo del mes** (`HomePaceCard`)
- Titular: **"Hoy puedes gastar $X"** = `max(presupuesto_total − gastado_mes, 0) / días_restantes`
  (días restantes incluye hoy). Subtítulo: "Quedan $Y para N días · vas bien / atento / te pasaste"
  usando `getMonthPace` y `getBudgetStatus` de `ui/BudgetProgress.jsx` (mismos umbrales del resto de la app).
- Debajo, versión compacta de `charts/ProjectionChart.jsx` (gastado acumulado + proyección punteada +
  línea de presupuesto). Añadir prop `compact` (sin leyenda larga, alto ~140px) en vez de duplicar el componente.
- Mes pasado (no en curso): el titular cambia a "Gastaste $X de $Y" con el estado final; sin "hoy puedes".
- Sin presupuestos: titular "Gastado este mes $X", proyección vs. mes anterior, y enlace "Crear presupuesto".
- **Verificar antes**: el total de presupuesto/gastado **no debe incluir transferencias** (se vio 445 %
  por esto). Si el dato viene mal de la API, reportarlo con evidencia antes de corregir.

**2 · Flujo del mes** (`HomeFlowCard`)
- Tres cifras: Ingresos (`data-ingreso`), Gastos (`data-gasto`), Ahorro neto (`data-ahorro`) con su
  variación vs. mes anterior (flecha + %, color según si es bueno o malo, nunca solo color).
- Barra proporcional de una sola línea: ingresos = 100 %, gasto y ahorro como tramos (si gasto > ingreso,
  el exceso en `status-crit` con la palabra "Déficit").
- Fuente: `state.Reports.income / expenses / savings_balance` (`get_financial_report`). Sin transferencias.

**3 · Patrimonio** (`HomeNetWorthCard`)
- Titular: patrimonio total en moneda base (`state.Fx.net_worth.total`), con `ui/Money`.
- **La barra adicional**: barra apilada de composición — Efectivo (`balance`/topi), Inversiones
  (teal `#0E9AA7`) y, como tramo restado/rayado, Deudas de tarjeta (`status-crit`), con leyenda
  `ui/ChartLegend` y montos compactos (`formatMoneyCompact`).
- Deuda de tarjetas = la deuda **estimada por cortes** (commit b2586e3), la misma que muestra Cuentas.
- Toque → `/dashboard/accounts` con el grupo "Todo".
- Variación contra el cierre del mes anterior y aportes vs. valor de inversiones: hechos en la Fase 3.B
  (ver "Historia de patrimonio" al final).

### B. Bandeja "Por revisar" (`ReviewInbox`)

Tarjeta en el Inicio (PC: columna derecha, arriba de Presupuestos; móvil: justo después de la fila de 3).
Reúne en una sola lista, con contador en el título ("Por revisar · 5"):
1. Transacciones `should_verify` del worker → muestra la categoría sugerida preseleccionada; **un toque
   la confirma** (misma acción que hoy marca verificada en `TransactionDetail2`); "Otra…" abre `DropDownCat`.
2. Pagos de tarjeta con `needs_counterpart` → "¿De qué cuenta salió?" reutilizando `TransferLinkSection`
   (sugerencia de `fetch_counterpart_suggestion` preseleccionada).
3. Posibles transferencias (`fetch_transfer_candidates`) → "Unir como transferencia" (reusar
   `TransferCandidatesModal` o su acción `link_transfer`).
4. Tarjetas con "Pagado de más" → enlace a `CardReconcile`.

Reglas: máximo 5 ítems visibles + "Ver todo" (lleva a Transacciones con el chip "Por revisar"); al
confirmar, el ítem sale con una transición corta y el contador baja sin recargar la página. Estado vacío
amable: "Todo al día" (EmptyState, sin mascota todavía; eso es Fase 4).
Preferir datos ya cargados; si hace falta un fetch, que sea uno solo y en paralelo con los del Inicio.

### C. Layout del Inicio (`AAGenDashboard`)

PC:
```
[ Ritmo del mes ][ Flujo del mes ][ Patrimonio ]
[ MultiChartDash (Balance·Flujo·Gastos·Proyección) ][ Por revisar ]
[                                                  ][ Presupuestos (DashPlan) ]
[ DashAccounts                                                                ]
```
- Quitar `DashTrans` ("Últimas transacciones") del Inicio en PC: lo reemplaza "Por revisar". En móvil
  también se quita; Movimientos está a un toque en la barra inferior.
- El selector de periodo en PC pasa a la cabecera del Inicio (una vez), no dentro de una tarjeta.
- Mantener el patrón de un solo árbol (`contents lg:flex` + `order-*`).
- Evaluar si `MultiChartDash` conserva la pestaña "Proyección" ahora que la tarjeta 1 la muestra; si
  queda redundante, quitarla y dejar Balance · Flujo · Gastos.

### D. Acción "Agregar" de baja prominencia

- Transacciones: el botón "Nuevo" pasa de relleno `topi-500` a `variant="ghost"`/borde con ícono `+`
  y texto "Agregar" solo en `md+`. Mismo menú.
- `BudDashTransCategorie` y `AccTransPeriod`: ya son `sm`; dejarlos como ícono `ghost`.
- Inicio: no hay botón de agregar transacción. Si no hay conexiones de correo, el estado vacío invita a
  **conectar el correo** (Conexiones), no a digitar.

### E. Movimientos agrupados por día (Transacciones)

- Lista agrupada por fecha con cabecera "Hoy, 30 oct" / "Ayer, 29 oct" / "lun 27 oct" y neto del día
  (sin transferencias).
- Transferencias en `transfer` slate con ícono ↔, sin signo de color (neutrales).
- Fila: emoji de categoría, comercio, "Categoría · Cuenta" en `ink-2`, monto con `ui/Money`.
- Conserva búsqueda, chips rápidos, filtros, paginación/scroll y los íconos de estado actuales.

### Fuera de alcance (pedir OK si se necesita)

- **3.B (API)**: historia de patrimonio por mes y aportes vs. valor de inversiones: hechos (7-nov). Falta
  compras vs. pagos de tarjeta por mes.
- Fase 4: mascota con estados, rachas, logros, "Pregúntale a Topi".

## Componentes a reutilizar (no duplicar)

`ui/` Card, Button, Chip, Money, Skeleton, EmptyState, Sheet, ChartLegend, BudgetProgress
(`getMonthPace`, `getBudgetStatus`), AccountBalance · `charts/` chartTheme, ChartTooltip, ProjectionChart,
FlowChart · `navigation/PeriodSelector` · `helpers` (formatMoney, formatMoneyCompact, accountClass,
isCreditAccount, isInvestmentAccount) · transfers actions · `TransferLinkSection`, `CardReconcile`.

## Reglas de diseño

- Solo tokens de `tailwind.config.js` (topi, data, money, status, ink); nada de hex sueltos nuevos.
- Estados siempre con ícono + palabra, no solo color. Contraste de texto ≥ 4,5:1.
- Modo oscuro en todo (`dark:`), gráficas con `useChartColors`.
- Sin anchos fijos `w-[NNNpx]` nuevos; móvil a 360px sin scroll horizontal.
- Skeletons mientras carga; sin parpadeo al cambiar de mes (mantener datos previos con opacidad).
- Formatos con helpers; montos de la API como string decimal, no sumar en float cuando la API ya da el total.

## Criterios de aceptación

- [x] Inicio PC: fila de 3 tarjetas (Ritmo, Flujo, Patrimonio con barra de composición) de igual alto.
      *(Cambió tras la prueba del usuario: ver "Ajustes tras la prueba".)*
- [x] "Hoy puedes gastar" coincide con la cuenta manual (presupuesto − gastado) / días restantes en un
      usuario de prueba; el total no incluye transferencias. *(Lo gastado no las incluye; el presupuesto
      total suma todas las categorías de gasto: ver "Pendientes" abajo.)*
- [x] Mes pasado y usuario sin presupuestos muestran los textos alternativos.
- [x] Patrimonio = `net_worth.total`; la suma de los tramos de la barra cuadra con el total.
- [x] "Por revisar" lista los 4 tipos; confirmar una categoría con un toque funciona y baja el contador.
      *(Ahora muestra uno a la vez.)*
      *("Pagado de más" solo cubre tarjetas sin día de corte, decisión del 30-oct.)*
- [x] No hay botón de agregar transacción protagonista en ninguna vista.
- [x] Transacciones agrupadas por día con neto diario; transferencias neutrales.
- [x] Móvil 360px y PC 1440px, claro y oscuro: sin desbordes (capturas en el reporte final).
- [ ] `CI=true npx react-scripts test --watchAll=false` verde (incluye tests nuevos de las 3 tarjetas,
      la fórmula de "hoy puedes gastar" y la bandeja) y `npm run build` sin errores. *(33 tests pasan y el
      build compila; `src/App.test.js`, el stub de CRA, falla igual en `main`: por eso sin marcar.)*
- [x] Si se tocó la API: `go test ./...` verde. *(No se tocó.)*

## Ajustes tras la prueba (30 y 31-oct)

Reemplazan las secciones A, B y C en lo que se contradiga. Layout de PC:

```
[ Marca ]            [ General · Presupuestos · Cuentas · Transacciones ]            [ tema · ajustes · mes ]

[ Ritmo (más ancha, sin título) ][ Flujo (angosta) ][ Por revisar (dos)  ]
[ Patrimonio: franja alargada                      ][ Presupuestos       ]
[ MultiChartDash (300 px)                          ][                    ]
[ DashAccounts                                                           ]
```

- Móvil: Ritmo, Flujo contraído, Por revisar, Patrimonio, gráficas, Presupuestos, Mis cuentas. El mes está en la barra superior en todos los tamaños; ya no se repite en Inicio ni en Presupuestos.
- Patrimonio no se fusiona con Balance: esa gráfica es el efectivo del mes elegido y Patrimonio es el total de hoy.
- "Por revisar" muestra un ítem en móvil y dos en PC, con puntos y "Siguiente" para saltarlo; al resolverlo sale el siguiente.
- El contador solo cuenta lo que hay que resolver. Sin pendientes dice "Todo al día" y recuerda el pago de tarjeta
  más cercano, si lo hay. No es una bandeja de notificaciones.
- "Ahorro neto" pasa a "Ahorro". "Mis cuentas" ya no repite el patrimonio y sus tarjetas tienen un mismo alto.

## Presupuestos y transferencias (31-oct)

- Una transferencia ligada solo cuenta en un presupuesto si la otra pata está en una cuenta de inversión. Entre
  cuentas propias o pagando una tarjeta no cuenta, aunque las patas tengan categorías distintas.
- "Hoy puedes gastar" y la línea de presupuesto usan lo mismo que suma Presupuestos: `mtd_budget` y `budget_spent`.
- Sin tipo de categoría ni categoría oculta: la clase de la cuenta ya da esa información.
- Límites conocidos: lo presupuestado para invertir cuenta como disponible hasta que se hace la transferencia, y
  una categoría con presupuesto que solo recibe pagos de tarjeta sigue sumando al total hasta que el usuario
  lo mueva. Las parejas sin unir cuentan hasta que se unan.

## Cargos de Tarjeta (31-oct)

- `card_charges` compara por corte lo debido (lo arrastrado más las compras) con lo pagado hasta el siguiente corte.
  El excedente es un gasto de la categoría "Cargos de Tarjeta" en el mes del último pago de esa ventana.
- No es una transacción: se recalcula, así una compra que llega tarde lo corrige y no se cuenta doble.
- Pago parcial: sin excedente, y en un corte cerrado lo que falta descuenta cargos anteriores (eran un pago
  adelantado) y se arrastra. El corte en curso solo suma.
- Solo desde los cortes de octubre de 2026 y con periodo completo: la historia no se recalcula.
- Límites: las tarjetas sin día de corte no tienen cargos (siguen con "Pagado de más"); el cargo incluye compras
  que no llegaron por correo; una compra a cuotas registrada completa oculta los intereses hasta el bloque de cuotas.
- Siguiente bloque: cuotas, con su propio plan.

## Historia de patrimonio (3.B, 7-nov)

- `net_worth_at(usuario, día)` (migración 000038) es la cuenta de `net_worth` a esa fecha: tarjetas por su deuda
  estimada por cortes de entonces (`credit_card_status(usuario, día)`, `card_billed(..., p_until)` no ve compras
  posteriores), inversiones por su valoración vigente ese día y la tasa de ese día. `net_worth(usuario)` es
  `net_worth_at(usuario, hoy)`, así que hoy no cambia.
- Entran las cuentas creadas hasta ese día o con movimientos o valoraciones hasta entonces (las cuentas creadas
  después con movimientos viejos cuentan su saldo inicial desde el primer movimiento). Las cerradas ese día salen
  del estado de tarjetas y vuelven a su saldo, como hoy.
- `GET /analysis/net-worth/history?months=12` (1–36): un punto por cierre de mes, el actual hasta hoy, con
  efectivo, inversiones, tarjetas y `investments_cost` (lo aportado: saldo inicial y entradas menos retiros, en
  moneda base; `null` si a alguna inversión le falta el monto base). Los meses sin cuentas no salen.
- Tarjeta Patrimonio: flecha + "Subió/Bajó $X desde el 31 oct" contra el penúltimo punto (no se muestra si falta
  una tasa en cualquiera de los dos) y "Inversiones: aportaste $X · ganancia/pérdida $Y" con el último.
- Gráfica (`charts/NetWorthChart`): en Cuentas › Todo, debajo del patrimonio (decisión del usuario, 7-nov: no en las
  gráficas del Inicio). Un punto por cierre de mes y "hoy" al final; el tooltip trae efectivo, inversiones, tarjetas y
  el cambio vs. el mes anterior, sin lo aportado. No depende del mes elegido. Con un solo punto dice que la historia
  empieza este mes.
- Límite: la historia usa los datos de hoy; una compra que llega tarde por correo cambia los meses pasados.
