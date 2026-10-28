# Transferencias, inversiones, tarjetas y cambio de moneda de cuentas

Continúa el plan multimoneda (rama `feat/multicurrency`, migraciones 22–26). Trabajo por etapas:
al final de cada una se detiene para revisión, como en las fases anteriores.

## Contexto

- `account_types` es un catálogo global con 4 filas: 1 Cuenta Ahorros, 2 Cuenta Corriente,
  3 Inversión, 4 Tarjeta de Crédito. No tiene ninguna lógica asociada: el front compara
  `type_id === 4` en ~15 archivos (signo del saldo inicial de las tarjetas, filtros, gráficas) y
  los reportes SQL separan "savings" de "credits" por `income_cat` y el tipo 4.
- Las transferencias entre cuentas propias cuentan hoy como ingreso en una cuenta y gasto en la
  otra. Antes se compensaban con una categoría que entra y sale; muchos bancos no notifican la
  entrada y el usuario la mete a mano.
- Las inversiones se revalorizaban con transacciones de ingreso o gasto ("subió" / "bajó"), que
  inflan los reportes de flujos.
- Hay cuentas creadas en COP que en realidad son en USD (sobre todo de inversión), porque la
  plataforma no tenía multimoneda.
- Ya existe desde la Fase 2/3: `transactions.transfer_group_id`, la vista
  `transfer_link_candidates`, `link_transfer()`, `POST /transactions/transfer` (transferencia entre
  monedas con el mismo `amount_base` en las dos patas) y `net_worth()` con `cost` y
  `unrealized_gain` cambiaria.

## Modelo (cómo lo hacen las apps y la contabilidad)

Tres clases de movimiento, que no se mezclan:

| Movimiento | Qué es | Flujos (ingresos/gastos, presupuestos) | Saldos y patrimonio |
|---|---|---|---|
| Flujo | Entra o sale plata del patrimonio: sueldo, mercado, intereses cobrados o pagados | Sí | Sí |
| Transferencia | Plata entre cuentas propias: pagar la tarjeta, aportar a un fondo, cambiar dólares | **No** | Sí (una cuenta baja, la otra sube) |
| Valoración | Cambia el valor de un activo sin que se mueva plata: el fondo pasa de 10 a 11 M | **No** | Sí |

Y cuentas por **clase**:

| Clase | Ejemplos | Saldo | Reglas |
|---|---|---|---|
| `deposit` (activo) | Ahorros, corriente, billetera, efectivo | Saldo inicial + movimientos | Lo actual |
| `investment` (activo) | CDT, fondos, acciones, bróker, cripto | Última valoración + movimientos posteriores | Aportes y retiros = transferencias; ganancia = valor − aportes netos |
| `credit` (pasivo) | Tarjetas, préstamos | Negativo = deuda | Compra = gasto (el día de la compra); pago = transferencia; intereses y comisiones = gasto |

Reportes resultantes:
- **Flujo de caja** (ingresos, gastos, presupuestos, categorías): solo flujos, en `amount_base`.
- **Patrimonio**: activos − pasivos, saldo nativo × tasa (actual o de la fecha).
- **Rendimiento de inversiones**: aparte, nunca mezclado con ingresos.

## Etapas y orden

| # | Etapa | Depende de | Por qué en este orden |
|---|---|---|---|
| 1 | Transferencias fuera de los flujos | — | Pagos de tarjeta y aportes a inversiones son transferencias: todo lo demás se apoya en esto |
| 2 | Clases de cuenta e inversiones con valoraciones | 1 | Saca las revaluaciones falsas de los flujos; resuelve también el cambio a USD de las cuentas de inversión |
| 3 | Asistente para cambiar la moneda de una cuenta (= Fase 4 del plan multimoneda) + cambio de moneda base | 1, 2 | Para el resto de cuentas; las de inversión ya quedaron resueltas en la 2 |
| 4 | Tarjetas de crédito como pasivos | 1, 2 | Cupo, corte, pago, cuotas |
| 5 | Patrimonio (después) | 2, 4 | Propiedades, préstamos grandes y posiciones con precio de mercado |

Reglas de siempre en todas: migraciones aditivas con `down`, dinero en NUMERIC/Decimal, `go test ./...`
verde, verificación antes/después con `TestReportSnapshot` sobre la copia del dump (solo cambian
los campos esperados), y nada de borrar datos del usuario: lo que se reemplaza se archiva y la
migración inversa lo restaura.

---

## Etapa 1 — Transferencias fuera de los flujos

**Estado: hecha** (migración 000027; verificada antes/después sobre el dump: idéntico).

**Regla:** una transacción con `transfer_group_id` no cuenta en los totales de ingresos, gastos y
ahorro (global y por cuenta). Sí cuenta en saldos y patrimonio. La regla la da `transfer_group_id`,
no la categoría. **Las patas conservan la categoría que eligió el usuario** y los reportes por
categoría y los presupuestos las siguen contando como hoy (decisión 28-oct): si presupuestas
"Inversión" y pasas el capital a la cuenta de inversión, la salida descuenta de ese presupuesto
(las cuentas de inversión no entran en la suma de gastos, así que la entrada no lo compensa); entre
dos cuentas de ahorro o hacia la tarjeta, salida y entrada con la misma categoría se compensan.

### Base de datos
- `daily_account_totals`: columnas `transfer_inflow`, `transfer_outflow`, `transfer_inflow_base`,
  `transfer_outflow_base`. `inflow/outflow` siguen sumando todo (saldos); los flujos son
  `inflow − transfer_inflow`. El trigger de `transactions` añade `transfer_group_id` a su `WHEN`.
  `rebuild_daily_account_totals` y el `drift` las incluyen; reconstrucción en la migración.
- `analysis_daily`, `analysis_monthly`, `analysis_monthly_accounts` y los flujos de
  `analysis.go` usan las columnas sin transferencias.
- `transfer_link_candidates` amplía la búsqueda a parejas entre monedas (`amount_base` a ±3 % y
  hasta 3 días) e incluye pagos de tarjeta (salida de un depósito, entrada a una cuenta `credit`).
  Ordenada por confianza (mismo monto exacto > mismo día > tolerancia).
- `unlink_transfer(user, group)`: deshace el vínculo (las dos patas vuelven a ser flujos).
- Borrar una pata suelta la otra (trigger `transactions_release_transfer`).
- `transfer_candidate_dismissals`: parejas que el usuario descartó ("No es").

### API
- `POST /transactions/:id/transfer` "es una transferencia": con `counterpart_transaction_id` liga
  dos transacciones existentes (una salida y una entrada en cuentas distintas); con
  `counterpart_account_id` crea la otra pata (misma fecha, descripción y categoría, mismo
  `amount_base`; entre monedas `counterpart_amount` o la tasa del día).
- `GET /transactions/transfer/candidates`, `POST /transactions/transfer/dismiss`,
  `DELETE /transactions/transfer/:group`.

### Web
- En el detalle de una transacción: acción "Es una transferencia a/desde mi cuenta…" con selector
  de cuenta; si hay candidata la sugiere ("¿Es esta entrada de $X en Nequi del 12-oct?").
- Bandeja "Posibles transferencias" (candidatas sin ligar) con Ligar / Ignorar.
- Las patas ligadas se ven con un ícono de transferencia en la lista y "Tipo: Transferencia" en el
  detalle, con la opción de desligar.

### Datos existentes
- No se liga nada automáticamente (D5). La bandeja muestra las candidatas históricas.
- Acción masiva: "ligar las muy probables" que no se cruzan con otra pareja.
- En la copia del dump hay 155 candidatas (144 muy probables, 11 probables) en 7 usuarios.

### Verificación
- Antes/después sin ligar nada: idéntico (10.337 resultados de servicios sobre el dump).
- Test de integración `TestTransfersOutOfFlows`: ligadas salen de ingresos y gastos; saldos,
  reporte por categoría y totales diarios cuadran; desligar, borrar una pata y descartar.

---

## Etapa 2 — Clases de cuenta e inversiones con valoraciones

**Estado: hecha** (migraciones 000028 y 000029; antes/después sobre el dump: idéntico, 10.337
resultados).

### Clases de cuenta
- `account_types.class` (`deposit` | `investment` | `credit`), NOT NULL con backfill:
  1, 2 → `deposit`; 3 → `investment`; 4 → `credit`. Tipos nuevos en el catálogo (opcionales):
  Efectivo/Billetera (`deposit`), Préstamo (`credit`).
- El tipo de cuenta en la API trae `class` (cuentas, transacciones y `/account-types`); el front
  usa `accountClass`, `isCreditAccount`, `isInvestmentAccount` y `accountReportGroup` de
  `helpers.js` en lugar de comparar `type_id`. En Go los reportes siguen usando los ID de
  `enums` (`domain.AccountClassOf` repite el backfill); el SQL nuevo usa `account_types.class`.
- Los tipos nuevos (Efectivo, Préstamo) no se agregaron todavía.

### Valoraciones
```
account_valuations (
  id BIGSERIAL PK, user_id, account_id FK,
  valuation_date DATE, value NUMERIC(20,4)  -- en la moneda de la cuenta
  source VARCHAR  -- 'manual' | 'import'
  note, created_at, updated_at,
  UNIQUE (account_id, valuation_date)
)
```
- Solo para cuentas `investment` del mismo usuario y desde el día en que se creó la cuenta (el
  saldo inicial es su valor ese día); lo valida un trigger. Una por día: guardar otra el mismo día
  la reemplaza.
- Implementación: `account_valuation_deltas(user)` devuelve, por valoración, el ajuste que hace
  saltar el saldo contable a su valor. `analysis_daily`, `analysis_monthly_accounts`,
  `net_worth` y los saldos de `analysis.go` solo suman esos ajustes.
- **Saldo de una inversión en la fecha D** = valor de la última valoración ≤ D + movimientos
  (transferencias y transacciones) posteriores a esa valoración y ≤ D. Sin valoraciones = como
  hoy (saldo inicial + movimientos). Es el modelo "ancla + flujos": un aporte sube el saldo de
  inmediato y la siguiente valoración lo corrige al valor real.
- **Aportes netos** = saldo inicial + transferencias de entrada − de salida + transacciones.
  **Ganancia de mercado** = saldo − aportes netos. En moneda base se separa ganancia de mercado y
  ganancia cambiaria (la que ya calcula `net_worth`).
- `net_worth()` y el patrimonio histórico usan el saldo anclado. Los flujos no ven las
  valoraciones nunca. `net_worth` devuelve `market_gain` por inversión y el resumen separa
  `market_gain` (inversiones, a la tasa de hoy) de `fx_gain` (cambiaria).
- Rendimiento de un periodo = (valor final − valor inicial − aportes netos del periodo); % simple
  sobre el valor inicial + aportes. TIR/XIRR queda para después.
- Los rendimientos que sí se cobran (dividendos, intereses que llegan a una cuenta de ahorros)
  siguen siendo ingresos con su categoría.

### API y web
- `GET/POST /accounts/:id/valuations` (POST crea o reemplaza la del día),
  `DELETE /accounts/:id/valuations/:valuation_id`; `GET /analysis/investments?start&end` (por
  defecto el mes en curso): valor al inicio y al cierre, aportes netos, ganancia y %, aportado y
  ganancia total, última valoración.
- En Cuentas, para una inversión: panel "Valor de la inversión" con "Actualizar valor", las cuatro
  cifras del periodo elegido y el historial de valoraciones (editar, borrar). La gráfica de saldo
  histórico ya sale anclada. En el inicio: "Ganancia de tus inversiones" aparte de la cambiaria y
  la ganancia bajo cada inversión.
- Pendiente para después: gráfica valor vs aportes.

### Revaluaciones registradas antes
Decisión 28-oct: no se migran. Las valoraciones son para lo que venga; las revaluaciones viejas
quedan como están (el usuario puede desligarlas o borrarlas a mano). El cambio de moneda de una
cuenta de inversión existente va por el asistente de la etapa 3.

### Verificación
- Antes/después sin valoraciones: idéntico. Con valoraciones en una cuenta de prueba: el saldo
  sigue la última valoración y los flujos no cambian.

---

## Etapa 3 — Cambiar la moneda de una cuenta (Fase 4 multimoneda)

Para cuentas con movimientos (también las de inversión creadas en pesos que en realidad son en
dólares). Asistente con tres modos y vista previa:

| Modo | Cuándo | Qué hace |
|---|---|---|
| Re-etiquetar | Los montos ya estaban en la moneda nueva; solo la etiqueta era COP | `amount` igual, moneda nueva, `fx_rate` y `amount_base` recalculados con la tasa de cada fecha. **Cambia los reportes históricos**: se muestra cuánto |
| Convertir | Se registraron en pesos pero la cuenta es en USD | `amount` = monto en COP ÷ tasa de su fecha, moneda nueva, `amount_base` igual (histórico intacto) |
| Cerrar y abrir | La cuenta cambió de verdad (p. ej. se abrió una cuenta nueva en USD) | Cierra la vieja (`accounts.closed_at`) y crea la nueva con una transferencia del saldo |

**Estado: hecha** (migración 000030; antes/después sobre el dump: idéntico, 10.337 resultados).

- Re-etiquetar y convertir: `change_account_currency(user, cuenta, moneda, modo, aplicar)`. La
  vista previa corre el mismo código y lo revierte (excepción `TP001`), así muestra exactamente lo
  que va a pasar: movimientos, saldo antes/después, lo que la cuenta suma en los reportes antes y
  después, tasas faltantes y tasas a mano que se reemplazan. Convertir también pasa el saldo
  inicial (tasa del día de creación) y las valoraciones; no se aplica si falta alguna tasa.
- El estado anterior se guarda en `account_currency_changes` (snapshot). Deshacer
  (`undo_account_currency_change`): solo el último cambio de la cuenta y solo si después no se
  agregaron ni editaron movimientos o valoraciones de ella.
- Cerrar y abrir: lo orquesta el front con las APIs que ya existen (crear cuenta, transferir el
  saldo, cerrar); no es una sola transacción, y si un paso falla el mensaje dice qué falta hacer.
- `accounts.closed_at` (`POST /accounts/:id/close` y `/reopen`): las cerradas no se ofrecen al
  crear movimientos ni transferencias, se marcan "Cerrada" en Cuentas y en el inicio se ocultan
  si tienen saldo cero. La API no impide registrarles movimientos (el worker de correos podría).
- API: `POST /accounts/:id/currency` (`apply` false = vista previa),
  `GET /accounts/:id/currency-changes`, `POST /accounts/:id/currency-changes/:id/undo`.
- **Cambio de moneda base**: `change_base_currency` + `POST /user-extra/base-currency`, también
  con vista previa (patrimonio de hoy en las dos monedas). Se hace síncrono en la API y no con un
  job del worker: con el volumen actual (8.748 transacciones en total) tarda menos de un segundo.
  Las dos patas de cada transferencia quedan con el mismo `amount_base`. En el front reemplaza el
  selector "Moneda Local" del perfil (que solo guardaba una preferencia) y recarga la app.

---

## Etapa 4 — Tarjetas de crédito como pasivos

### Datos
```
credit_card_details (account_id PK, credit_limit NUMERIC(20,4), statement_day SMALLINT,
                     due_day SMALLINT, interest_rate_ea NUMERIC(9,6) NULL)
transactions.installments SMALLINT NULL   -- compra diferida a N cuotas (informativo)
```
- Saldo negativo = deuda (como hoy). La UI muestra "Deuda $X" y "Disponible = cupo − deuda".
- **Compra** = gasto en la fecha de compra, aunque sea a cuotas (criterio de causación).
- **Pago** = transferencia desde un depósito (etapa 1). Los pagos que llegan por correo se
  proponen como transferencia con la cuenta de origen más probable.
- **Intereses, cuota de manejo, seguros** = gastos con categorías del sistema "Intereses" y
  "Comisiones" (no editables, una por usuario). No se simulan intereses: se registran desde el
  extracto o el correo.
- **Periodo de facturación** derivado de `statement_day`: compras del periodo cerrado, pagos
  posteriores, "pago para no generar intereses" y fecha límite. Avisos solo dentro de la app
  (no hay envío de correos).
- **Una moneda por tarjeta** (decisión 28-oct): la oficial de la cuenta; el extracto llega ya
  convertido. Las compras en otra moneda se registran por lo que cobró el banco.

### Datos existentes
- Los pagos de tarjeta históricos aparecen en la bandeja de candidatas de la etapa 1
  (salida de ahorros + entrada a la tarjeta).

---

## Etapa 5 — Patrimonio (después)

Sección de patrimonio con lo que no es cuenta bancaria: propiedades (activo con valoraciones, el
mismo modelo de la etapa 2), préstamos grandes (hipoteca, vehículo: pasivo con tabla de
amortización; "Registrar cuota" = abono a capital como transferencia + intereses como gasto) y
posiciones (acciones, fondos: cantidad × precio). Se diseña cuando terminen las etapas 1–4.

## Decisiones (28-oct)

1. Las patas de una transferencia conservan la categoría del usuario y llevan la marca de
   transferencia; los presupuestos las siguen viendo (ver etapa 1).
2. No se migran revaluaciones registradas antes; las valoraciones son hacia adelante.
3. Posiciones (cantidad × precio) después, en la etapa 5.
4. Préstamos grandes y propiedades en la etapa 5 (patrimonio), no con las tarjetas.
5. Una moneda por tarjeta: la oficial de la cuenta.

## Fuera de alcance

- Importar extractos de brókers o bancos (PDF/CSV) para valoraciones o tarjetas.
- Precios de mercado automáticos (acciones, cripto, fondos).
- Contabilidad por partida doble completa.
