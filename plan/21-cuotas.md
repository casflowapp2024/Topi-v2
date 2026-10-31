# Cuotas: repartir las compras a plazos

Continúa `20-ux-fase-3-vistas.md` (bloques "Presupuestos y transferencias" y "Cargos de Tarjeta"). Revierte una
decisión de `10-tipos-de-cuenta.md`: "Compra = gasto en la fecha de compra, aunque sea a cuotas".

Estado: decisiones D1 a D7 aprobadas el 31-oct. Fases 1, 2 y 3 hechas; sigue la fase 4. La fase 3 no está en `main`: solo en la rama, porque sin la fase 4 las cuotas no se explican en pantalla.

## Qué se quiere

Una compra de $ 1.200.000 a 6 cuotas pesa $ 200.000 en cada uno de los 6 meses, en su categoría, no
$ 1.200.000 en el mes de compra. Lo que el banco cobra por corte sale de esas cuotas, así que la diferencia con
el pago real ya son los intereses y va a "Cargos de Tarjeta".

## Qué problema resuelve

- Un mes con una compra grande a cuotas no se ve como un mes desastroso, y los siguientes no se ven irreales.
- `pending_statement` deja de ser un tope: hoy la UI advierte que el extracto "puede pedir menos que esto".
- Con compras a cuotas registradas completas, `card_charges` cree que debes más y oculta los intereses.
- La deuda estimada hoy ignora las cuotas futuras: una vez pagado el corte, esas compras dejan de contar.

## Diseño

**Sin transacciones nuevas.** El calendario se calcula con una función, como `card_charges`: si el usuario cambia
las cuotas o borra la compra, todo se recalcula solo. `installments` y el `amount_base` de la compra son la fuente.

```
installment_schedule(user) → transaction_id, account_id, category_id, cuota (k de n),
                             budget_date, statement_date, amount, amount_base
```

- `budget_date`: fecha de la compra + (k − 1) meses. Es donde pesa en gastos y presupuestos.
- `statement_date`: corte k contado desde la compra. Es donde el banco la cobra. Sin día de corte, nulo.
- Montos: `amount / n`; la última cuota absorbe el redondeo. Tasa fija de la compra: entre monedas, la de ese día.

**Saldos sin cambios.** La tarjeta sigue debiendo la compra completa desde el primer día. Se reparte el gasto, no
la deuda. `daily_account_totals` y `net_worth` no se tocan salvo la deuda estimada (abajo).

**Reportes con ajuste, no con otra suma.** `card_charges` ya entra por ajustes por día en `analysis.go`. Se
generaliza a un solo `expenseAdjustments(día)`:

```
ajuste del día = cargos de tarjeta + cuotas que caen ese día − compras a cuotas de ese día
```

Y se usa en los cinco sitios que ya existen: `GetFinancialSummary`, `GetDailyAnalysis`, `GetMonthlyAnalysis`,
`GetCategoriesReport` y `GetCategoryAnalysis` (estos dos, por categoría).

**Tarjeta.** Una función común da lo cobrado en un periodo: compras de contado + cuotas de ese corte. La usan
`credit_card_status`, `credit_card_cycles` y `card_charges`. La deuda estimada suma las cuotas que faltan por
cobrar. Se quita de la UI la advertencia de "tu extracto puede pedir menos".

## Decisiones

| # | Tema | Recomendación | Por qué |
|---|---|---|---|
| D1 | ¿Dónde aplica el reparto? | En todo: Gastos, Flujo, Ritmo, Presupuestos | Si no, vuelve a haber dos cifras de "gastado" |
| D2 | ¿Primera cuota? | En el mes de la compra | El gasto se decidió ese mes, aunque el banco lo cobre en el corte siguiente |
| D3 | ¿Desde cuándo? | Compras desde el 1-nov-2026. Las anteriores con cuotas solo corrigen la deuda y el corte, no los reportes | Los meses cerrados no cambian |
| D4 | ¿Cuándo preguntar? | Solo compras con tarjeta desde $ 200.000 (en moneda base), leídas de correo. Resto: 1 cuota | Preguntar todas llenaría la bandeja |
| D5 | ¿Cómo preguntar? | Tipo nuevo en "Por revisar": `1 · 3 · 6 · 12 · Otra` | Un toque; "1" es la respuesta por defecto |
| D6 | ¿Abono anticipado al banco? | Sale como cargo hasta que los cortes siguientes lo descuenten; sin acción manual por ahora | Es raro y se corrige solo, pero un mes se verá mal |
| D7 | ¿Devolución de una compra a cuotas? | El usuario quita las cuotas de la compra; no se automatiza | El worker no detecta devoluciones |

## Fases

Cada una termina con tests y parada para revisar.

1. **Calendario (hecho).** Migración con `installment_schedule` y `down`. Campo para saber si ya se preguntó
   (`installments_reviewed_at`). Tests: redondeo, meses cortos, entre monedas, cambiar y quitar cuotas. La función
   devuelve todas las compras con `purchased_on`: el límite de D3 se aplica en los reportes (fase 3).
2. **Tarjeta (hecho).** Lo cobrado por corte en `credit_card_status`, `credit_card_cycles` y `card_charges`; deuda con
   cuotas pendientes. Tests con compra a 6 cuotas más pago exacto (cargo 0) y pago con intereses (cargo = interés).
3. **Reportes (hecho).** `extraExpensesByDay` e `installmentShifts` en los cinco sitios. Las cuotas 2 en adelante
   cuentan desde el día 1 de su mes, no el día de la compra: así "Hoy puedes gastar" las conoce desde el inicio y la
   serie diaria cuadra con el reporte por categorías. Comparación sobre el dump: 10.524 reportes idénticos. Comprobar que el total por categorías cuadra con
   `mtd_budget` y `budget_spent`. Comprobar con `TestReportSnapshot` que sin cuotas nada cambia.
4. **Front.**
   - Bandeja: tipo nuevo con su filtro en la API (D4, D5).
   - Presupuestos: lista "cuota 2 de 6" como Cargos de Tarjeta; las cuotas de compras pasadas no están en ese mes.
   - Transacciones: rótulo "a 6 cuotas · $ 200.000 este mes"; el neto del día usa la cuota.
   - Detalle de compra: calendario de cuotas.
5. **Verificación final.** Prueba en la app con datos inventados, y luego `CLAUDE.md`, `plan/10` y este plan.

## Corte pagado (31-oct)

Se quitó la regla del 10 %: un corte queda pagado solo si se cubre lo cobrado, y lo que falte pasa al siguiente
(`card_carry`, migración 000037). No usa el saldo acumulado: va por cortes y desde octubre de 2026. Un pago que no
llegó por correo se ve como deuda hasta registrarlo.

## Riesgos

- **Es el cambio más grande a los reportes hasta ahora.** Toca cinco consultas y tres funciones de tarjeta. Mitigación:
  sin cuotas el ajuste es cero, y el snapshot antes/después debe salir idéntico.
- **Meses futuros con gasto.** Presupuestos mostrará compromisos en meses que no han llegado: es lo buscado, pero
  el selector de mes futuro hoy dice "Este mes aún no empieza" y habrá que mostrar lo comprometido.
- **Sin cuotas confirmadas el cargo se oculta.** Si una compra de $ 150.000 fue a cuotas y no se preguntó, sigue
  completa. El usuario puede corregirla en el detalle.
- **Cuota con cifra distinta a la del banco.** El banco puede cobrar intereses dentro de la cuota: esa diferencia
  cae en Cargos de Tarjeta, que es lo correcto.

## Fuera de alcance

- Detectar cuotas en el correo: pide cambiar el prompt del worker y evaluarlo aparte.
- Compras a cuotas fuera de tarjeta de crédito.
- Avances, refinanciaciones y tasas por cuota.
