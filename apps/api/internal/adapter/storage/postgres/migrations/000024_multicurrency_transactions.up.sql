-- Multimoneda (Fase 2): moneda por cuenta, moneda base por usuario, tasa y monto en moneda base
-- por transacción, y reportes en vivo sobre una tabla de totales diarios (reemplaza las vistas
-- materializadas que se refrescaban cada 5 minutos).
--
-- Reglas:
--   - transactions.currency = accounts.currency siempre (lo fuerza el trigger).
--   - amount está en la moneda de la cuenta; amount_base = amount × fx_rate en la moneda base del
--     usuario (user_extra.base_currency). fx_rate no se recalcula al editar la fecha o el monto
--     (es inmutable); solo cuando cambia la moneda (otra cuenta) o viene NULL.
--   - Sin tasa disponible el insert no falla: fx_rate y amount_base quedan NULL y fill_pending_fx()
--     los completa cuando llegue la tasa.
--   - Flujos (ingresos, gastos, ahorro, categorías) suman amount_base. Saldos agregados entre
--     cuentas = saldo nativo de cada cuenta × tasa de esa fecha. Saldos por cuenta: nativos.

-- ---------------------------------------------------------------- 1. vistas que dependen de los montos
DROP MATERIALIZED VIEW monthly_accounts_analysis;
DROP MATERIALIZED VIEW monthly_analysis;
DROP MATERIALIZED VIEW daily_analysis;
DROP MATERIALIZED VIEW balance_by_date;
DROP MATERIALIZED VIEW last_month_balance;
DROP VIEW monthly_accounts_summary;
DROP VIEW daily_accounts_report_summary;
DROP VIEW initial_balance_by_accounts;
DROP VIEW curated_transactions_by_accounts;
DROP VIEW monthly_rolling_balance;
DROP VIEW monthly_rolling_balance_base;
DROP VIEW monthly_financial_summary;
DROP VIEW daily_full_financial_summary;
DROP VIEW daily_rolling_balance;
DROP VIEW daily_financial_summary;
DROP VIEW date_series;
DROP VIEW financial_summary_by_day;
DROP VIEW curated_initial_balance;
DROP VIEW curated_transactions;

-- ---------------------------------------------------------------- 2. montos más anchos
-- numeric(10,2) topa en 99.999.999,99 (un movimiento de 30.000 USD en COP no cabe).
ALTER TABLE transactions ALTER COLUMN amount TYPE NUMERIC(20, 4);
ALTER TABLE accounts ALTER COLUMN initial_balance TYPE NUMERIC(20, 4);

-- ---------------------------------------------------------------- 3. columnas nuevas + backfill
ALTER TABLE user_extra ADD COLUMN base_currency VARCHAR(3) NOT NULL DEFAULT 'COP' REFERENCES currencies (code);
ALTER TABLE accounts ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'COP' REFERENCES currencies (code);

ALTER TABLE transactions
  ADD COLUMN currency VARCHAR(3) REFERENCES currencies (code),
  ADD COLUMN fx_rate NUMERIC(28, 12) CHECK (fx_rate > 0),
  ADD COLUMN fx_rate_source VARCHAR(32),
  ADD COLUMN amount_base NUMERIC(20, 4),
  ADD COLUMN transfer_group_id UUID;

UPDATE transactions t
SET currency = a.currency, fx_rate = 1, fx_rate_source = 'migration', amount_base = t.amount
FROM accounts a
WHERE a.id = t.account_id;

ALTER TABLE transactions ALTER COLUMN currency SET NOT NULL;

-- filas que esperan una tasa (las completa fill_pending_fx)
CREATE INDEX transactions_fx_pending ON transactions (id) WHERE amount_base IS NULL;
CREATE INDEX transactions_transfer_group ON transactions (transfer_group_id) WHERE transfer_group_id IS NOT NULL;

-- ---------------------------------------------------------------- 4. helpers por usuario
CREATE FUNCTION user_timezone(p_user_id VARCHAR) RETURNS VARCHAR
  LANGUAGE sql STABLE AS $$
  SELECT COALESCE(max(ue.utc_offset), 'UTC') FROM user_extra ue WHERE ue.user_id = p_user_id
$$;

CREATE FUNCTION user_base_currency(p_user_id VARCHAR) RETURNS VARCHAR
  LANGUAGE sql STABLE AS $$
  SELECT COALESCE(max(ue.base_currency), 'COP') FROM user_extra ue WHERE ue.user_id = p_user_id
$$;

-- fuente de la tasa ganadora de 1 USD = ? p_quote (mismo orden que fx_usd_rate_at)
CREATE FUNCTION fx_usd_source_at(p_quote TEXT, p_date DATE) RETURNS TEXT
  LANGUAGE sql STABLE AS $$
  SELECT r.source
  FROM fx_rates r
  WHERE r.base = 'USD' AND r.quote = upper(p_quote) AND r.rate_date <= p_date
  ORDER BY r.rate_date DESC, fx_source_priority(r.source), r.source
  LIMIT 1
$$;

-- de dónde salió fx_rate_at(p_from, p_to, p_date): 'identity', una fuente ('SFC_TRM') o las dos
-- patas de un cruce ('ECB+SFC_TRM'). NULL si falta una pata.
CREATE FUNCTION fx_rate_source_at(p_from TEXT, p_to TEXT, p_date DATE) RETURNS TEXT
  LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN upper(p_from) = upper(p_to) THEN 'identity'
    WHEN fx_usd_rate_at(p_from, p_date) IS NULL OR fx_usd_rate_at(p_to, p_date) IS NULL THEN NULL
    ELSE (SELECT string_agg(DISTINCT s, '+' ORDER BY s)
          FROM unnest(ARRAY[
            CASE WHEN upper(p_from) <> 'USD' THEN fx_usd_source_at(p_from, p_date) END,
            CASE WHEN upper(p_to) <> 'USD' THEN fx_usd_source_at(p_to, p_date) END]) AS s)
  END
$$;

-- ---------------------------------------------------------------- 5. trigger de moneda y tasa
CREATE FUNCTION transactions_set_fx() RETURNS TRIGGER
  LANGUAGE plpgsql AS $$
DECLARE
  v_base VARCHAR(3);
  v_day DATE;
BEGIN
  NEW.currency := (SELECT a.currency FROM accounts a WHERE a.id = NEW.account_id);

  IF TG_OP = 'INSERT' AND NEW.fx_rate IS NOT NULL AND NEW.fx_rate_source IS NULL THEN
    NEW.fx_rate_source := 'user';
  END IF;

  -- pasó a una cuenta de otra moneda y no trae tasa nueva: la vieja no sirve
  IF TG_OP = 'UPDATE' AND NEW.currency IS DISTINCT FROM OLD.currency
     AND NEW.fx_rate IS NOT DISTINCT FROM OLD.fx_rate THEN
    NEW.fx_rate := NULL;
  END IF;

  IF NEW.fx_rate IS NULL THEN
    v_base := user_base_currency(NEW.user_id);
    v_day := (NEW.date AT TIME ZONE user_timezone(NEW.user_id))::DATE;
    NEW.fx_rate := fx_rate_at(NEW.currency, v_base, v_day);
    NEW.fx_rate_source := CASE WHEN NEW.fx_rate IS NOT NULL THEN fx_rate_source_at(NEW.currency, v_base, v_day) END;
  END IF;

  -- amount_base sigue a amount × fx_rate, salvo que la misma sentencia lo fije explícitamente
  IF NEW.fx_rate IS NULL THEN
    NEW.amount_base := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.amount_base := COALESCE(NEW.amount_base, round(NEW.amount * NEW.fx_rate, 4));
  ELSIF NEW.amount_base IS NOT DISTINCT FROM OLD.amount_base
        AND (NEW.amount_base IS NULL OR NEW.amount IS DISTINCT FROM OLD.amount
             OR NEW.fx_rate IS DISTINCT FROM OLD.fx_rate) THEN
    NEW.amount_base := round(NEW.amount * NEW.fx_rate, 4);
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER transactions_set_fx
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION transactions_set_fx();

-- Completa las transacciones sin tasa (job diario del worker, después de traer las tasas).
-- Devuelve cuántas quedaron completas.
CREATE FUNCTION fill_pending_fx() RETURNS INT
  LANGUAGE sql AS $$
  WITH done AS (
    UPDATE transactions SET fx_rate = NULL
    WHERE amount_base IS NULL
    RETURNING amount_base
  )
  SELECT count(*)::INT FROM done WHERE amount_base IS NOT NULL
$$;

-- ---------------------------------------------------------------- 6. totales diarios en vivo
-- Una fila por (cuenta, categoría, día local del usuario). La mantiene un trigger sobre
-- transactions (suma o resta la diferencia); los reportes leen de aquí filtrando por usuario.
CREATE TABLE daily_account_totals (
  user_id            VARCHAR(255) NOT NULL,
  account_id         BIGINT NOT NULL,
  category_id        BIGINT NOT NULL,
  day                DATE NOT NULL,
  inflow             NUMERIC NOT NULL DEFAULT 0,  -- transacciones con expense = false, moneda de la cuenta
  outflow            NUMERIC NOT NULL DEFAULT 0,  -- expense = true, positivo
  inflow_base        NUMERIC NOT NULL DEFAULT 0,  -- lo mismo en moneda base (sin las filas sin tasa)
  outflow_base       NUMERIC NOT NULL DEFAULT 0,
  tx_count           INT NOT NULL DEFAULT 0,
  missing_base_count INT NOT NULL DEFAULT 0,      -- transacciones sin amount_base
  PRIMARY KEY (account_id, category_id, day)
);
CREATE INDEX daily_account_totals_user_day ON daily_account_totals (user_id, day);

CREATE FUNCTION daily_account_totals_apply(
  p_user_id VARCHAR, p_account_id BIGINT, p_category_id BIGINT, p_date TIMESTAMPTZ,
  p_expense BOOLEAN, p_amount NUMERIC, p_amount_base NUMERIC, p_sign INT
) RETURNS VOID
  LANGUAGE plpgsql AS $$
DECLARE
  v_day DATE := (p_date AT TIME ZONE user_timezone(p_user_id))::DATE;
BEGIN
  INSERT INTO daily_account_totals AS d
    (user_id, account_id, category_id, day, inflow, outflow, inflow_base, outflow_base, tx_count, missing_base_count)
  VALUES (
    p_user_id, p_account_id, p_category_id, v_day,
    p_sign * CASE WHEN p_expense THEN 0 ELSE p_amount END,
    p_sign * CASE WHEN p_expense THEN p_amount ELSE 0 END,
    p_sign * CASE WHEN p_expense THEN 0 ELSE COALESCE(p_amount_base, 0) END,
    p_sign * CASE WHEN p_expense THEN COALESCE(p_amount_base, 0) ELSE 0 END,
    p_sign,
    p_sign * CASE WHEN p_amount_base IS NULL THEN 1 ELSE 0 END)
  ON CONFLICT (account_id, category_id, day) DO UPDATE SET
    inflow = d.inflow + EXCLUDED.inflow,
    outflow = d.outflow + EXCLUDED.outflow,
    inflow_base = d.inflow_base + EXCLUDED.inflow_base,
    outflow_base = d.outflow_base + EXCLUDED.outflow_base,
    tx_count = d.tx_count + EXCLUDED.tx_count,
    missing_base_count = d.missing_base_count + EXCLUDED.missing_base_count;

  DELETE FROM daily_account_totals
  WHERE account_id = p_account_id AND category_id = p_category_id AND day = v_day AND tx_count = 0;
END
$$;

-- El lock por usuario serializa el trigger con rebuild_daily_account_totals del mismo usuario.
CREATE FUNCTION transactions_daily_totals() RETURNS TRIGGER
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM pg_advisory_xact_lock(hashtext('daily_account_totals:' || OLD.user_id));
    PERFORM daily_account_totals_apply(OLD.user_id, OLD.account_id, OLD.category_id, OLD.date,
                                       OLD.expense, OLD.amount, OLD.amount_base, -1);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM pg_advisory_xact_lock(hashtext('daily_account_totals:' || NEW.user_id));
    PERFORM daily_account_totals_apply(NEW.user_id, NEW.account_id, NEW.category_id, NEW.date,
                                       NEW.expense, NEW.amount, NEW.amount_base, 1);
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER transactions_daily_totals_insert_delete
  AFTER INSERT OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION transactions_daily_totals();

-- marcar como revisada, cambiar la descripción, etc. no toca los totales
CREATE TRIGGER transactions_daily_totals_update
  AFTER UPDATE ON transactions
  FOR EACH ROW
  WHEN ((OLD.user_id, OLD.account_id, OLD.category_id, OLD.date, OLD.expense, OLD.amount, OLD.amount_base)
        IS DISTINCT FROM
        (NEW.user_id, NEW.account_id, NEW.category_id, NEW.date, NEW.expense, NEW.amount, NEW.amount_base))
  EXECUTE FUNCTION transactions_daily_totals();

-- Lo que deberían tener los totales según transactions (NULL = todos los usuarios).
CREATE FUNCTION daily_account_totals_expected(p_user_id VARCHAR DEFAULT NULL)
RETURNS TABLE (
  user_id VARCHAR, account_id BIGINT, category_id BIGINT, day DATE, inflow NUMERIC, outflow NUMERIC,
  inflow_base NUMERIC, outflow_base NUMERIC, tx_count INT, missing_base_count INT
)
  LANGUAGE sql STABLE AS $$
  SELECT t.user_id, t.account_id, t.category_id,
         (t.date AT TIME ZONE COALESCE(ue.utc_offset, 'UTC'))::DATE,
         sum(CASE WHEN t.expense THEN 0 ELSE t.amount END),
         sum(CASE WHEN t.expense THEN t.amount ELSE 0 END),
         sum(CASE WHEN t.expense THEN 0 ELSE COALESCE(t.amount_base, 0) END),
         sum(CASE WHEN t.expense THEN COALESCE(t.amount_base, 0) ELSE 0 END),
         count(*)::INT,
         (count(*) FILTER (WHERE t.amount_base IS NULL))::INT
  FROM transactions t
  LEFT JOIN user_extra ue ON ue.user_id = t.user_id
  WHERE p_user_id IS NULL OR t.user_id = p_user_id
  GROUP BY 1, 2, 3, 4
$$;

-- Recalcula desde cero los totales de un usuario (o de todos con NULL). Devuelve las filas escritas.
CREATE FUNCTION rebuild_daily_account_totals(p_user_id VARCHAR DEFAULT NULL) RETURNS INT
  LANGUAGE plpgsql AS $$
DECLARE
  v_rows INT;
BEGIN
  IF p_user_id IS NULL THEN
    LOCK TABLE daily_account_totals IN SHARE ROW EXCLUSIVE MODE;
    DELETE FROM daily_account_totals;
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext('daily_account_totals:' || p_user_id));
    DELETE FROM daily_account_totals WHERE user_id = p_user_id;
  END IF;
  INSERT INTO daily_account_totals
    (user_id, account_id, category_id, day, inflow, outflow, inflow_base, outflow_base, tx_count, missing_base_count)
  SELECT * FROM daily_account_totals_expected(p_user_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END
$$;

-- Usuarios cuyos totales no cuadran con transactions (red de seguridad; no debería pasar).
CREATE FUNCTION daily_account_totals_drift() RETURNS TABLE (user_id VARCHAR)
  LANGUAGE sql STABLE AS $$
  SELECT DISTINCT COALESCE(e.user_id, d.user_id)
  FROM daily_account_totals_expected() e
  FULL JOIN daily_account_totals d
    ON d.account_id = e.account_id AND d.category_id = e.category_id AND d.day = e.day
  WHERE (e.user_id, e.inflow, e.outflow, e.inflow_base, e.outflow_base, e.tx_count, e.missing_base_count)
        IS DISTINCT FROM
        (d.user_id, d.inflow, d.outflow, d.inflow_base, d.outflow_base, d.tx_count, d.missing_base_count)
$$;

-- Job nocturno del worker: recalcula los usuarios con diferencias y los devuelve.
CREATE FUNCTION reconcile_daily_account_totals() RETURNS TABLE (user_id VARCHAR)
  LANGUAGE plpgsql AS $$
DECLARE
  v_user VARCHAR;
BEGIN
  FOR v_user IN SELECT dr.user_id FROM daily_account_totals_drift() dr LOOP
    PERFORM rebuild_daily_account_totals(v_user);
    user_id := v_user;
    RETURN NEXT;
  END LOOP;
END
$$;

-- El día local depende de la zona horaria: si cambia, se recalcula el usuario.
CREATE FUNCTION user_extra_rebuild_totals() RETURNS TRIGGER
  LANGUAGE plpgsql AS $$
BEGIN
  PERFORM rebuild_daily_account_totals(NEW.user_id);
  RETURN NULL;
END
$$;

CREATE TRIGGER user_extra_rebuild_totals_insert
  AFTER INSERT ON user_extra
  FOR EACH ROW EXECUTE FUNCTION user_extra_rebuild_totals();

CREATE TRIGGER user_extra_rebuild_totals_update
  AFTER UPDATE OF utc_offset ON user_extra
  FOR EACH ROW WHEN (OLD.utc_offset IS DISTINCT FROM NEW.utc_offset)
  EXECUTE FUNCTION user_extra_rebuild_totals();

SELECT rebuild_daily_account_totals();

-- ---------------------------------------------------------------- 7. reportes por usuario
-- Reemplazan DAILY_ANALYSIS, MONTHLY_ANALYSIS y MONTHLY_ACCOUNTS_ANALYSIS con las mismas columnas
-- y los mismos resultados (comprobado contra el dump de producción).
--
-- LEGADO (se conserva para no cambiar números en esta migración): las vistas viejas sumaban el
-- saldo inicial de una cuenta una vez por cada transacción del día de su creación:
--   - tarjetas (tipo 4) en el saldo de créditos: × transacciones del usuario ese día;
--   - análisis por cuenta: × transacciones de esa cuenta ese día.
-- Está marcado con "LEGADO"; lo corrige la 000025.

CREATE FUNCTION analysis_daily(p_user_id VARCHAR)
RETURNS TABLE (
  date DATE, income NUMERIC, expense NUMERIC, mtd_income NUMERIC, mtd_expense NUMERIC, mtd_savings NUMERIC,
  running_savings_balance NUMERIC, running_credits_balance NUMERIC, updated_at TIMESTAMPTZ
)
  LANGUAGE sql STABLE AS $$
WITH settings AS (
  SELECT user_timezone(p_user_id) AS tz, user_base_currency(p_user_id) AS base
),
acc AS (
  SELECT a.id, a.type_id, a.currency, a.initial_balance, (a.created_at AT TIME ZONE s.tz)::DATE AS created_day
  FROM accounts a CROSS JOIN settings s
  WHERE a.user_id = p_user_id
),
tot AS (
  SELECT d.day, d.account_id, acc.type_id, c.income AS income_cat, d.tx_count,
         d.inflow - d.outflow AS net, d.inflow_base - d.outflow_base AS net_base
  FROM daily_account_totals d
  JOIN acc ON acc.id = d.account_id
  LEFT JOIN categories c ON c.id = d.category_id
  WHERE d.user_id = p_user_id
),
-- flujos del día en moneda base (como CURATED_TRANSACTIONS)
flows AS (
  SELECT t.day,
         sum(CASE WHEN t.income_cat IS TRUE AND t.type_id IN (1, 2, 3) THEN t.net_base ELSE 0 END) AS inc,
         sum(CASE WHEN t.income_cat IS FALSE AND t.type_id IN (1, 2, 4) THEN t.net_base ELSE 0 END) AS exp,
         sum(t.tx_count) AS n
  FROM tot t
  GROUP BY t.day
),
-- días con datos de los dos últimos años calendario (el HAVING de FINANCIAL_SUMMARY_BY_DAY)
kept_days AS (
  SELECT x.day
  FROM (SELECT f.day FROM flows f UNION SELECT a.created_day FROM acc a) x
  WHERE extract(YEAR FROM x.day) >= extract(YEAR FROM current_date - INTERVAL '1 year')
),
series AS (
  SELECT g::DATE AS day
  FROM settings s,
       generate_series((SELECT min(k.day) FROM kept_days k)::TIMESTAMP, now() AT TIME ZONE s.tz, INTERVAL '1 day') g
),
-- movimiento nativo de cada cuenta por día, incluido el saldo inicial el día de creación
acc_days AS (
  SELECT x.account_id, x.day, sum(x.net_savings) AS net_savings, sum(x.net_credits) AS net_credits
  FROM (
    SELECT t.account_id, t.day,
           CASE WHEN t.income_cat IS NOT NULL THEN t.net ELSE 0 END AS net_savings,
           CASE WHEN t.income_cat IS FALSE THEN t.net ELSE 0 END AS net_credits
    FROM tot t
    UNION ALL
    SELECT a.id, a.created_day, 0, 0 FROM acc a
  ) x
  GROUP BY x.account_id, x.day
),
acc_moves AS (
  SELECT m.account_id, m.day,
         CASE
           WHEN a.type_id IN (1, 2, 3) THEN
             m.net_savings + CASE WHEN m.day = a.created_day THEN a.initial_balance ELSE 0 END
           WHEN a.type_id = 4 THEN
             m.net_credits + CASE WHEN m.day = a.created_day
                                  THEN a.initial_balance * greatest(COALESCE(f.n, 0), 1) -- LEGADO
                                  ELSE 0 END
           ELSE 0
         END AS delta
  FROM acc_days m
  JOIN acc a ON a.id = m.account_id
  LEFT JOIN flows f ON f.day = m.day
),
opening AS (
  SELECT m.account_id, sum(m.delta) AS amount
  FROM acc_moves m
  WHERE m.day < (SELECT min(s.day) FROM series s)
  GROUP BY m.account_id
),
-- saldo nativo de cada cuenta cada día × la tasa de ese día hacia la moneda base
running AS (
  SELECT g.day, g.type_id,
         (COALESCE(o.amount, 0) + sum(g.delta) OVER (PARTITION BY g.account_id ORDER BY g.day))
           * fx_rate_at(g.currency, st.base, g.day) AS value
  FROM (
    SELECT s.day, a.id AS account_id, a.type_id, a.currency, COALESCE(m.delta, 0) AS delta
    FROM series s
    CROSS JOIN acc a
    LEFT JOIN acc_moves m ON m.account_id = a.id AND m.day = s.day
  ) g
  CROSS JOIN settings st
  LEFT JOIN opening o ON o.account_id = g.account_id
),
running_day AS (
  SELECT r.day,
         COALESCE(sum(r.value) FILTER (WHERE r.type_id IN (1, 2, 3)), 0) AS sav,
         COALESCE(sum(r.value) FILTER (WHERE r.type_id = 4), 0) AS cred
  FROM running r
  GROUP BY r.day
)
SELECT s.day,
       COALESCE(f.inc, 0),
       COALESCE(f.exp, 0),
       sum(COALESCE(f.inc, 0)) OVER w,
       sum(COALESCE(f.exp, 0)) OVER w,
       sum(COALESCE(f.inc, 0) + COALESCE(f.exp, 0)) OVER w,
       COALESCE(rd.sav, 0),
       COALESCE(rd.cred, 0),
       now()
FROM series s
LEFT JOIN flows f ON f.day = s.day
LEFT JOIN running_day rd ON rd.day = s.day
WINDOW w AS (PARTITION BY extract(YEAR FROM s.day), extract(MONTH FROM s.day) ORDER BY s.day)
ORDER BY s.day
$$;

CREATE FUNCTION analysis_monthly(p_user_id VARCHAR)
RETURNS TABLE (
  year NUMERIC, month NUMERIC, income NUMERIC, income_past NUMERIC, expense NUMERIC, expense_past NUMERIC,
  savings NUMERIC, savings_past NUMERIC, running_savings_balance NUMERIC, running_savings_balance_past NUMERIC,
  running_credits_balance NUMERIC, running_credits_balance_past NUMERIC, updated_at TIMESTAMPTZ
)
  LANGUAGE sql STABLE AS $$
WITH m AS (
  SELECT extract(YEAR FROM d.date) AS y, extract(MONTH FROM d.date) AS mo,
         sum(d.income) AS inc, sum(d.expense) AS exp, sum(d.income + d.expense) AS sav,
         (array_agg(d.running_savings_balance ORDER BY d.date DESC))[1] AS rsav,
         (array_agg(d.running_credits_balance ORDER BY d.date DESC))[1] AS rcred
  FROM analysis_daily(p_user_id) d
  GROUP BY 1, 2
)
SELECT m.y, m.mo,
       m.inc, COALESCE(lag(m.inc) OVER w, 0),
       m.exp, COALESCE(lag(m.exp) OVER w, 0),
       m.sav, COALESCE(lag(m.sav) OVER w, 0),
       m.rsav, COALESCE(lag(m.rsav) OVER w, 0),
       m.rcred, COALESCE(lag(m.rcred) OVER w, 0),
       now()
FROM m
WINDOW w AS (ORDER BY m.y, m.mo)
ORDER BY m.y, m.mo
$$;

-- Saldo nativo de cada cuenta al cierre de cada mes con movimientos (o el de su creación).
CREATE FUNCTION analysis_monthly_accounts(p_user_id VARCHAR)
RETURNS TABLE (
  account_id BIGINT, account_name VARCHAR, type_id BIGINT, year NUMERIC, month NUMERIC,
  balance NUMERIC, balance_past NUMERIC
)
  LANGUAGE sql STABLE AS $$
WITH acc AS (
  SELECT a.id, a.name, a.type_id, a.initial_balance,
         (a.created_at AT TIME ZONE user_timezone(p_user_id))::DATE AS created_day
  FROM accounts a
  WHERE a.user_id = p_user_id
),
days AS (
  SELECT x.account_id, x.day, sum(x.net) AS net, sum(x.n) AS n
  FROM (
    SELECT d.account_id, d.day, d.inflow - d.outflow AS net, d.tx_count AS n
    FROM daily_account_totals d
    WHERE d.user_id = p_user_id
    UNION ALL
    SELECT a.id, a.created_day, 0, 0 FROM acc a
  ) x
  GROUP BY x.account_id, x.day
),
months AS (
  SELECT a.id, a.name, a.type_id, extract(YEAR FROM x.day) AS y, extract(MONTH FROM x.day) AS mo,
         sum(x.net + CASE WHEN x.day = a.created_day
                          THEN a.initial_balance * greatest(x.n, 1) -- LEGADO
                          ELSE 0 END) AS total
  FROM days x
  JOIN acc a ON a.id = x.account_id
  GROUP BY 1, 2, 3, 4, 5
)
SELECT m.id, m.name, m.type_id, m.y, m.mo,
       sum(m.total) OVER w,
       sum(m.total) OVER w - m.total
FROM months m
WINDOW w AS (PARTITION BY m.id ORDER BY m.y, m.mo)
ORDER BY m.id, m.y, m.mo
$$;

-- ---------------------------------------------------------------- 8. transferencias
-- Parejas que parecen transferencias entre cuentas del mismo usuario (salida y entrada del mismo
-- monto y moneda, con a lo sumo un día de diferencia) y todavía no están ligadas. Solo propone:
-- se ligan a mano con link_transfer().
CREATE VIEW transfer_link_candidates AS
SELECT o.user_id,
       o.id AS out_transaction_id,
       i.id AS in_transaction_id,
       o.account_id AS out_account_id,
       i.account_id AS in_account_id,
       o.amount,
       o.currency,
       o.date AS out_date,
       i.date AS in_date,
       abs((i.date AT TIME ZONE COALESCE(ue.utc_offset, 'UTC'))::DATE
           - (o.date AT TIME ZONE COALESCE(ue.utc_offset, 'UTC'))::DATE) AS day_gap
FROM transactions o
JOIN transactions i
  ON i.user_id = o.user_id AND i.account_id <> o.account_id
 AND i.expense IS FALSE AND i.amount = o.amount AND i.currency = o.currency
 AND i.date BETWEEN o.date - INTERVAL '1 day' AND o.date + INTERVAL '1 day'
LEFT JOIN user_extra ue ON ue.user_id = o.user_id
WHERE o.expense IS TRUE
  AND o.transfer_group_id IS NULL AND i.transfer_group_id IS NULL;

-- Liga dos transacciones del mismo usuario como una transferencia (mismo transfer_group_id).
CREATE FUNCTION link_transfer(p_user_id VARCHAR, p_out_id BIGINT, p_in_id BIGINT) RETURNS UUID
  LANGUAGE plpgsql AS $$
DECLARE
  v_group UUID := gen_random_uuid();
  v_rows INT;
BEGIN
  UPDATE transactions SET transfer_group_id = v_group, updated_at = now()
  WHERE user_id = p_user_id AND id IN (p_out_id, p_in_id) AND transfer_group_id IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 2 THEN
    RAISE EXCEPTION 'link_transfer: se esperaban 2 transacciones sin ligar del usuario, se encontraron %', v_rows;
  END IF;
  RETURN v_group;
END
$$;
