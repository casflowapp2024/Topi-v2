# 26 — Presupuestos con historial (versiones por mes)

Rama `feat/presupuestos-historicos` · worktree `topiv2/topi-presupuestos` · base main `7f49490` (12-nov-2026)

## Problema

Cada categoría guarda un solo presupuesto (`categories.budget`) y todos los reportes lo aplican a **todos los
meses**, también a los pasados. Si en noviembre "Comida" sube de 800k a 1M, enero aparece con presupuesto de 1M:
el gasto de enero se ve mejor de lo que fue y el ahorro presupuestado del histórico se infla (o se desinfla
cuando el presupuesto baja). Los presupuestos cambian con la inflación y con las etapas de la vida; el
histórico tiene que mostrar el presupuesto que tenía cada mes.

## Decisiones (tomadas con el usuario, 12-nov-2026)

- **D1** Un cambio de presupuesto aplica **por defecto desde el mes en curso** (mes del usuario, con su
  `utc_offset`).
- **D2** Se permite **editar meses pasados**: el usuario elige "desde qué mes" aplica el valor.
- **D3** Granularidad mensual: una versión rige desde el día 1 de su mes hasta el mes anterior a la siguiente
  versión. Dos cambios en el mismo mes = el último reemplaza al anterior (no se crean dos versiones).
- **D4** Editar un mes pasado **no borra** las versiones posteriores. Ej.: versiones ene=800k y nov=1M; fijar
  jun=900k deja ene–may 800k, jun–oct 900k, nov en adelante 1M. La interfaz lo explica antes de guardar.
- **D5** No hay versiones en meses futuros (el selector llega hasta el mes en curso). Así el presupuesto vigente
  es siempre la última versión.
- **D6** `categories.budget` se queda como **presupuesto vigente** (la última versión) y se actualiza en la misma
  transacción. Lo que solo mira el presente (lista de categorías, admin, `budget_created`, onboarding) no cambia.
- **D7** Datos existentes: cada categoría recibe una versión con su presupuesto actual "desde siempre"
  (`effective_from = 2000-01-01`, se muestra como "Desde el inicio"). El pasado queda igual que hoy. No hay forma
  de reconstruirlo: la corrección vale desde el próximo cambio, o la hace el usuario a mano con D2.
- **D8** Una categoría nueva crea su primera versión **en el mes de creación**: los meses anteriores tienen
  presupuesto 0 en esa categoría (no existía). El usuario puede adelantarla con D2.
- **D9** La versión más antigua de una categoría no se borra, solo se edita (así ningún mes posterior a ella queda
  sin presupuesto). Las demás versiones sí se pueden borrar; al borrar una, rige la anterior.
- **D10** Con versiones, presupuesto 0 es un valor válido ("sin presupuesto desde jul"). El endpoint nuevo exige
  `budget` (puntero: 0 se distingue de "no enviado"). El `PUT /categories/:id` mantiene su contrato: el `budget`
  que manda (el front lo manda siempre) pasa a ser la versión del mes en curso.
- Fuera de alcance: cambiar la moneda base no convierte presupuestos (hoy tampoco lo hace); presupuestos por
  semana o por año; presupuestos futuros programados.

## Modelo

Migración `000044_category_budgets.{up,down}.sql`:

```sql
CREATE TABLE category_budgets (
    id             BIGSERIAL PRIMARY KEY,
    category_id    BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    user_id        VARCHAR(255) NOT NULL,
    budget         FLOAT NOT NULL,
    effective_from DATE NOT NULL CHECK (extract(day from effective_from) = 1),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (category_id, effective_from)
);
CREATE INDEX category_budgets_lookup ON category_budgets (category_id, effective_from DESC);
CREATE INDEX category_budgets_user ON category_budgets (user_id);

INSERT INTO category_budgets (category_id, user_id, budget, effective_from)
SELECT id, user_id, budget, DATE '2000-01-01' FROM categories;
```

`ON DELETE CASCADE`: borrar una categoría borra su historial. El `down` borra trigger, funciones y tabla.
`budget` en FLOAT como `categories.budget` (mismo tipo para comparar y sumar sin conversiones).

**Trigger `categories_budget_version`** (AFTER INSERT OR UPDATE OF budget ON categories): si el valor nuevo no es
el que rige en el mes en curso del usuario (`user_current_month`, su zona horaria), hace upsert de la versión de ese
mes. Así todo lo que escribe `categories` (el `PUT` de siempre, `CreateCategory`, las categorías por defecto, el
`INSERT` de "Cargos de Tarjeta", scripts) deja historial sin cambiar, y una categoría nueva nace con la versión de
su mes (D8). La API edita meses pasados en `category_budgets` y luego sincroniza `categories.budget` con la última
versión: el trigger ve el mismo valor y no hace nada.

Función SQL de apoyo (en la misma migración) para no repetir el lookup:

```sql
CREATE FUNCTION budget_at(p_category BIGINT, p_month DATE) RETURNS FLOAT
LANGUAGE sql STABLE AS $$
  SELECT budget FROM category_budgets
  WHERE category_id = p_category AND effective_from <= date_trunc('month', p_month)::date
  ORDER BY effective_from DESC LIMIT 1
$$;
```

Sin versión vigente (meses previos a D8) → `NULL`, que los reportes leen como 0 (`coalesce`).

## Backend

### Dominio y servicio (`core/domain/category.go`, `core/service/category.go`)

- `domain.CategoryBudget{CategoryID, Budget, EffectiveFrom (time.Time, día 1), CreatedAt}`.
- `domain.MonthStart(t, loc)` y validación: `EffectiveFrom` ≤ mes en curso del usuario (D5); errores de dominio
  nuevos en `core/domain/error.go` (`ErrBudgetFutureMonth`, `ErrBudgetBaseVersion`).
- `CategoryService.SetBudget(ctx, userID, categoryID, budget, from)`: valida el mes (`CurrentBudgetMonth` del
  repositorio + `domain.ValidateBudgetMonth`), upsert de la versión y sincronización de `categories.budget` en una
  transacción (`CategoryRepository.UpsertCategoryBudget`). Emite `budget_created` igual que hoy.
- `UpdateCategory` y `CreateCategory` no cambian: el trigger hace la versión del mes en curso (D1, D8).
- `ListBudgets`, `DeleteBudget` (D9; borra y sincroniza en una transacción).
- Puerto `CategoryRepository` con los métodos nuevos → regenerar el mock en el mismo commit.

### Endpoints (`adapter/handler/http/category.go`)

- `GET /categories/:id/budgets` → `[{ "budget": 1000000, "from": "2026-11", "base": false }]`, más reciente
  primero; `base: true` en la más antigua.
- `PUT /categories/:id/budgets` body `{ "budget": 900000, "from": "2026-06" }` (`budget` puntero, obligatorio;
  `from` opcional = mes en curso). Devuelve la lista actualizada.
- `DELETE /categories/:id/budgets/:from` (`YYYY-MM`). 409 si es la versión base.
- `PUT /categories/:id` sigue igual; un cambio de `budget` ahí = versión del mes en curso.
- Swagger: los handlers de categorías no tienen anotaciones (`docs/` no lista `/categories`); no se regenera.
  `apps/web/doc/*_endpoints.md` se actualiza en la fase B, con las llamadas del front.

### Reportes (`adapter/storage/postgres/repository/analysis.go`)

1. **Reporte por categoría de un mes** (~L567): `c.budget` → `coalesce(budget_at(c.id, ?::date), 0)` con el mes
   pedido. Los totales `Income.Budget` / `Expenses.Budget` salen de esas filas, así que también quedan por mes.
2. **Análisis mensual** (~L778): el `CROSS JOIN` de un solo total pasa a una subconsulta por mes:
   ```sql
   SELECT m.y, m.m,
          coalesce(sum(b.budget) filter (where c.income), 0)     AS income_budget,
          coalesce(sum(b.budget) filter (where not c.income), 0) AS expense_budget
   FROM generate_series($start::date, $end::date, interval '1 month') g(d)
   CROSS JOIN LATERAL (SELECT extract(year from g.d) y, extract(month from g.d) m) m
   CROSS JOIN categories c
   LEFT JOIN LATERAL (SELECT budget_at(c.id, g.d::date) AS budget) b ON true
   WHERE c.user_id = $1
   GROUP BY 1, 2
   ```
   y se une con `analysis_monthly` por año/mes (implementado como `CROSS JOIN LATERAL` por fila de
   `analysis_monthly` con `budget_at(c.id, make_date(ma.year, ma.month, 1))`). `domain.IncomeMetrics/ExpenseMetrics/SavingsMetrics` ya reciben el
   presupuesto por fila: cada mes usa el suyo.
   - Respuesta: se agregan `monthly.income_budget[]`, `monthly.expense_budget[]`, `monthly.savings_budget[]`
     (paralelos a `year[]`/`month[]`). Los campos de arriba `income_budget` / `expense_budget` /
     `savings_budget` quedan con el valor **del último mes del rango** (el que hoy usan la proyección y el ritmo
     del mes), para no romper al front mientras se migra.
3. **Histórico de una categoría** (~L892 y ~L946): `max(c.budget)` → `budget_at(c.id, mes)` por fila, y los meses
   sin movimientos que hoy se rellenan con el presupuesto actual se rellenan con `budget_at` de ese mes. Se agrega
   `monthly.budget[]`; `budget` arriba = el del último mes del rango (antes era el de la primera fila, y 0 si la
   categoría no tenía movimientos en el rango; ahora es el presupuesto aunque no haya movimientos).
4. `admin_metrics.go` y `000043` siguen con `categories.budget` (presupuesto vigente, D6). Sin cambios.

## Web (`apps/web`)

- **Editar presupuesto** (`expensePlan/EditCategory.js`): debajo del monto, selector "Aplica desde" con
  "Este mes (nov 2026)" por defecto y meses anteriores (hasta el mes de la primera transacción del usuario o
  "Desde el inicio"). Si el mes elegido es pasado y hay versiones después, aviso: "Rige de jun a oct; desde nov
  sigue 1.000.000". Guarda con `PUT /categories/:id/budgets`. La barra de "Gastado este mes" sigue usando el mes
  en curso.
- **Historial** en el detalle de la categoría: lista corta "1.000.000 desde nov 2026 · 800.000 desde el inicio",
  con borrar en cada versión salvo la base. La confirmación va en la misma fila ("¿Borrar? Desde jun 2026 vuelve a
  800.000"), no en otro `Dialog` encima del modal. Solo se muestra si hay más de una versión. Versión PC y móvil.
- **Gráficos**: `SpendVsBudgetChart` (línea de presupuesto y ▲ de excedido por mes con
  `monthly.expense_budget[i]` o `monthly.budget[i]`), `BudgetBreakdownChart`, y donde se mire un mes elegido que no
  sea el actual (`HomePaceCard`, `ProjectionChart`, `BudgetOverview`) usar el presupuesto de ese mes. La línea de
  referencia de presupuesto pasa a ser escalonada (`Line type="step"`: el salto cae en el borde entre meses) cuando
  el presupuesto cambió en el rango; si fue el mismo todos los meses queda la `ReferenceLine` fija de siempre.
  `HomePaceCard`, `ProjectionChart` y `BudgetOverview` no cambiaron: miran un solo mes y el API ya les manda el
  presupuesto de ese mes (`analysis_daily` llega hasta hoy, así que el último mes del rango siempre es el elegido).
- **Meses sin movimientos de la categoría**: `history_category.monthly` solo trae los meses con movimientos; el API
  agrega `budget_by_month` ("YYYY-MM" → presupuesto, todos los meses del rango) para que `BudgetBreakdownChart`
  dibuje la línea de la categoría también en esos meses.
- **Guardar desde un mes pasado**: solo `PUT /categories/:id/budgets`; el `PUT /categories/:id` va únicamente si
  cambió nombre, ícono o tipo (sin cambios responde 400 "no data to update"), y lleva el presupuesto vigente.
- Redux: acciones `getCategoryBudgets`, `setCategoryBudget`, `deleteCategoryBudget` en `redux/actions`;
  refrescar `history_dash` / `history_category` y el reporte del mes al guardar.
- Montos con `formatMoney`, moneda base del usuario.

## Plan de trabajo

- **Fase A — backend** (hecha el 12-nov-2026): migración 000044, dominio, repositorio, servicio, endpoints, las tres consultas, swagger.
  Tests: dominio (meses, validaciones), servicio con mocks, handlers, integración (`category_budgets` + reportes
  con dos versiones en meses distintos).
- **Fase B — web** (hecha el 12-nov-2026): selector "Aplica desde", historial, gráficos por mes, tests de componentes (`modals.test.js`,
  `charts.test.js`).
- **Fase C — verificación**: snapshot antes/después sobre la copia del dump (`scratchpad/snapshot.sh`): sin
  cambios de presupuesto los reportes deben salir **idénticos** a main (D7). Luego cambiar un presupuesto en la
  copia desde un mes pasado y revisar Inicio, Presupuestos y el histórico de la categoría con capturas en PC y
  móvil.

## Criterios de aceptación

- [x] Con los datos migrados y sin cambios, todos los reportes coinciden con main (snapshot 12-nov sobre la copia
      del dump, 11.140 filas: solo cambian los arreglos nuevos y el `budget` de 524 históricos de categoría que antes
      salían en 0 por no tener movimientos en el rango).
- [x] Cambiar un presupuesto hoy no altera ningún mes anterior al en curso, ni en totales ni por categoría.
- [x] Fijar un valor desde un mes pasado cambia solo de ese mes hasta la siguiente versión (D4). (Probado en el
      front de prueba: 650.000 desde mar con versiones en jun y nov → solo mar–may.)
- [x] El ahorro presupuestado de cada mes del histórico = ingresos presupuestados − gastos presupuestados **de ese
      mes**.
- [x] Dos cambios en el mismo mes dejan una sola versión (D3); no se puede fijar un mes futuro (D5) ni borrar la
      versión base (D9).
- [x] Presupuesto 0 desde un mes se guarda y se ve como "sin presupuesto" desde ese mes (D10).
- [x] `categories.budget` siempre = última versión; admin y `budget_created` funcionan igual.
- [x] Categoría nueva: meses previos a su creación con presupuesto 0 (D8).
- [x] `go test ./...`, integración, `npm test` y build del front en verde; migración con `down` probado.
      (`App.test.js` no carga por `react-router-dom` en jest; pasa igual en main.)
