-- Presupuestos con historial (plan/26-presupuestos-historicos.md).
--   - category_budgets: una versión por categoría y mes (effective_from = día 1). Rige desde ese mes hasta el mes
--     anterior a la siguiente versión. Los reportes leen el presupuesto de cada mes con budget_at(categoría, mes).
--   - categories.budget queda como presupuesto vigente (= la última versión; no hay versiones futuras).
--   - Un trigger sobre categories mantiene la versión del mes en curso del usuario cuando cambia budget, así todo lo
--     que escribe categories (API, migraciones, scripts) deja historial sin saberlo. Si el valor nuevo ya es el
--     vigente no hace nada: así la API puede sincronizar categories.budget tras editar un mes pasado.
--   - Lo existente queda "desde siempre" (2000-01-01): no hay registro de los presupuestos anteriores.

CREATE TABLE category_budgets (
    id             BIGSERIAL PRIMARY KEY,
    category_id    BIGINT NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    user_id        VARCHAR(255) NOT NULL,
    budget         FLOAT NOT NULL,
    effective_from DATE NOT NULL CHECK (extract(day FROM effective_from) = 1),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT category_budgets_month UNIQUE (category_id, effective_from)
);

CREATE INDEX category_budgets_lookup ON category_budgets (category_id, effective_from DESC);
CREATE INDEX category_budgets_user ON category_budgets (user_id);

INSERT INTO category_budgets (category_id, user_id, budget, effective_from)
SELECT id, user_id, budget, DATE '2000-01-01' FROM categories;

-- Presupuesto de la categoría en el mes de p_month (NULL si la categoría no tenía versión todavía).
CREATE FUNCTION budget_at(p_category BIGINT, p_month DATE) RETURNS FLOAT
  LANGUAGE sql STABLE AS $$
  SELECT cb.budget FROM category_budgets cb
  WHERE cb.category_id = p_category AND cb.effective_from <= date_trunc('month', p_month)::DATE
  ORDER BY cb.effective_from DESC
  LIMIT 1
$$;

-- Día 1 del mes en curso para el usuario (su zona horaria).
CREATE FUNCTION user_current_month(p_user_id VARCHAR) RETURNS DATE
  LANGUAGE sql STABLE AS $$
  SELECT date_trunc('month', now() AT TIME ZONE user_timezone(p_user_id))::DATE
$$;

CREATE FUNCTION category_budget_version() RETURNS TRIGGER
  LANGUAGE plpgsql AS $$
DECLARE
  v_month DATE := user_current_month(NEW.user_id);
BEGIN
  IF budget_at(NEW.id, v_month) IS DISTINCT FROM NEW.budget THEN
    INSERT INTO category_budgets (category_id, user_id, budget, effective_from)
    VALUES (NEW.id, NEW.user_id, NEW.budget, v_month)
    ON CONFLICT (category_id, effective_from) DO UPDATE SET budget = EXCLUDED.budget, updated_at = now();
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER categories_budget_version
  AFTER INSERT OR UPDATE OF budget ON categories
  FOR EACH ROW EXECUTE FUNCTION category_budget_version();
