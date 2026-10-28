-- Valoraciones de inversiones (plan/10-tipos-de-cuenta.md, etapa 2).
--
-- Una valoración dice cuánto valía una cuenta de inversión al cierre de un día. El saldo de la
-- cuenta en una fecha D es el valor de la última valoración <= D más los movimientos posteriores
-- (aportes, retiros, transacciones). Sin valoraciones, el saldo es el de siempre (saldo inicial +
-- movimientos): sin datos en account_valuations los reportes dan idéntico a la 000028.
--
-- Las valoraciones no son flujos: no cuentan como ingreso ni gasto. Se expresan como "ajustes"
-- (account_valuation_deltas): el día de cada valoración el saldo salta lo necesario para quedar
-- en su valor. Así los reportes de saldos (analysis_daily, analysis_monthly_accounts, net_worth y
-- los de analysis.go) solo suman los ajustes a lo que ya tenían.

CREATE TABLE account_valuations (
  id             BIGSERIAL PRIMARY KEY,
  user_id        VARCHAR(255) NOT NULL,
  account_id     BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  valuation_date DATE NOT NULL,                               -- día local del usuario
  value          NUMERIC(20,4) NOT NULL CHECK (value >= 0),   -- en la moneda de la cuenta
  source         VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import')),
  note           VARCHAR(255) NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT account_valuations_account_date UNIQUE (account_id, valuation_date)
);
CREATE INDEX account_valuations_user ON account_valuations (user_id, account_id, valuation_date);

-- Solo cuentas de inversión del mismo usuario, y desde el día en que se creó la cuenta (el saldo
-- inicial es su valor ese día).
CREATE FUNCTION account_valuations_check() RETURNS TRIGGER
  LANGUAGE plpgsql AS $$
DECLARE
  v_created DATE;
BEGIN
  SELECT (a.created_at AT TIME ZONE user_timezone(a.user_id))::DATE INTO v_created
  FROM accounts a
  JOIN account_types t ON t.id = a.type_id
  WHERE a.id = NEW.account_id AND a.user_id = NEW.user_id AND t.class = 'investment';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_valuations: la cuenta % no es una inversión del usuario', NEW.account_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'account_valuations_investment';
  END IF;
  IF NEW.valuation_date < v_created THEN
    RAISE EXCEPTION 'account_valuations: % es antes de la creación de la cuenta (%)', NEW.valuation_date, v_created
      USING ERRCODE = 'check_violation', CONSTRAINT = 'account_valuations_after_creation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

CREATE TRIGGER account_valuations_check
  BEFORE INSERT OR UPDATE ON account_valuations
  FOR EACH ROW EXECUTE FUNCTION account_valuations_check();

-- Ajuste de saldo de cada valoración de las inversiones del usuario: valor − saldo contable ese día
-- (saldo inicial + movimientos hasta ese día), menos el ajuste de la valoración anterior. La suma
-- de los ajustes hasta D, más el saldo contable en D, es el saldo anclado en D.
CREATE FUNCTION account_valuation_deltas(p_user_id VARCHAR)
RETURNS TABLE (account_id BIGINT, day DATE, delta NUMERIC)
  LANGUAGE sql STABLE AS $$
WITH adj AS (
  SELECT v.account_id, v.valuation_date AS day,
         v.value - a.initial_balance
           - COALESCE((SELECT sum(d.inflow - d.outflow) FROM daily_account_totals d
                       WHERE d.account_id = v.account_id AND d.day <= v.valuation_date), 0) AS adj
  FROM account_valuations v
  JOIN accounts a ON a.id = v.account_id
  JOIN account_types t ON t.id = a.type_id
  WHERE v.user_id = p_user_id AND t.class = 'investment'
)
SELECT adj.account_id, adj.day,
       adj.adj - COALESCE(lag(adj.adj) OVER (PARTITION BY adj.account_id ORDER BY adj.day), 0)
FROM adj
$$;

-- Rendimiento de las inversiones del usuario en [p_start, p_end] (días locales; p_end se corta en hoy):
--   value_start / value_end   saldo anclado al cierre del día anterior a p_start / de p_end
--   contributions             aportes netos del periodo (movimientos; el saldo inicial si la cuenta
--                             se creó en el periodo)
--   gain                      value_end − value_start − contributions
--   contributions_total       saldo inicial + todos los movimientos hasta p_end
--   market_gain_total         suma de los ajustes hasta p_end (= value_end − contributions_total)
--   rate_end                  tasa de p_end hacia la moneda base del usuario
CREATE FUNCTION investment_performance(p_user_id VARCHAR, p_start DATE, p_end DATE)
RETURNS TABLE (
  account_id BIGINT, account_name VARCHAR, currency VARCHAR,
  value_start NUMERIC, value_end NUMERIC, contributions NUMERIC, gain NUMERIC,
  contributions_total NUMERIC, market_gain_total NUMERIC,
  last_valuation_date DATE, last_valuation_value NUMERIC, rate_end NUMERIC
)
  LANGUAGE sql STABLE AS $$
WITH bounds AS (
  SELECT p_start - 1 AS d0,
         least(p_end, (now() AT TIME ZONE user_timezone(p_user_id))::DATE) AS d1,
         user_base_currency(p_user_id) AS base
),
inv AS (
  SELECT a.id, a.name, a.currency, a.initial_balance,
         (a.created_at AT TIME ZONE user_timezone(p_user_id))::DATE AS created_day
  FROM accounts a
  JOIN account_types t ON t.id = a.type_id
  WHERE a.user_id = p_user_id AND t.class = 'investment'
),
deltas AS (
  SELECT * FROM account_valuation_deltas(p_user_id)
),
per AS (
  SELECT i.id, i.name, i.currency, b.d1, b.base,
         CASE WHEN i.created_day <= b.d0 THEN i.initial_balance ELSE 0 END
           + COALESCE((SELECT sum(d.inflow - d.outflow) FROM daily_account_totals d
                       WHERE d.account_id = i.id AND d.day <= b.d0), 0) AS book_start,
         CASE WHEN i.created_day <= b.d1 THEN i.initial_balance ELSE 0 END
           + COALESCE((SELECT sum(d.inflow - d.outflow) FROM daily_account_totals d
                       WHERE d.account_id = i.id AND d.day <= b.d1), 0) AS book_end,
         COALESCE((SELECT sum(x.delta) FROM deltas x WHERE x.account_id = i.id AND x.day <= b.d0), 0) AS adj_start,
         COALESCE((SELECT sum(x.delta) FROM deltas x WHERE x.account_id = i.id AND x.day <= b.d1), 0) AS adj_end
  FROM inv i CROSS JOIN bounds b
)
SELECT p.id, p.name, p.currency,
       p.book_start + p.adj_start,
       p.book_end + p.adj_end,
       p.book_end - p.book_start,
       p.adj_end - p.adj_start,
       p.book_end,
       p.adj_end,
       lv.valuation_date, lv.value,
       fx_rate_at(p.currency, p.base, p.d1)
FROM per p
LEFT JOIN LATERAL (
  SELECT v.valuation_date, v.value FROM account_valuations v
  WHERE v.account_id = p.id AND v.valuation_date <= p.d1
  ORDER BY v.valuation_date DESC LIMIT 1
) lv ON TRUE
ORDER BY p.id
$$;

-- Patrimonio: el saldo de las inversiones queda anclado a sus valoraciones. market_gain = suma de
-- los ajustes (ganancia de mercado en la moneda de la cuenta; NULL si no es inversión).
-- unrealized_gain sigue siendo base_value − cost: ahora incluye la ganancia de mercado y la cambiaria.
DROP FUNCTION net_worth(VARCHAR);
CREATE FUNCTION net_worth(p_user_id VARCHAR)
RETURNS TABLE (
  account_id BIGINT, account_name VARCHAR, bank_name VARCHAR, last_four_digits VARCHAR, type_id BIGINT,
  currency VARCHAR, balance NUMERIC, rate NUMERIC, base_value NUMERIC, cost NUMERIC, unrealized_gain NUMERIC,
  market_gain NUMERIC
)
  LANGUAGE sql STABLE AS $$
WITH settings AS (
  SELECT user_timezone(p_user_id) AS tz, user_base_currency(p_user_id) AS base
),
today AS (
  SELECT (now() AT TIME ZONE s.tz)::DATE AS day, s.tz, s.base FROM settings s
),
moves AS (
  SELECT d.account_id,
         sum(d.inflow - d.outflow) AS net,
         sum(d.inflow_base - d.outflow_base) AS net_base,
         sum(d.missing_base_count) AS missing
  FROM daily_account_totals d, today
  WHERE d.user_id = p_user_id AND d.day <= today.day
  GROUP BY d.account_id
),
vals AS (
  SELECT vd.account_id, sum(vd.delta) AS adj
  FROM account_valuation_deltas(p_user_id) vd, today
  WHERE vd.day <= today.day
  GROUP BY vd.account_id
),
valued AS (
  SELECT a.id, a.name, b.name AS bank, a.last_four_digits, a.type_id, a.currency, at.class,
         a.initial_balance + COALESCE(m.net, 0) + COALESCE(v.adj, 0) AS bal,
         COALESCE(v.adj, 0) AS adj,
         fx_rate_at(a.currency, t.base, t.day) AS today_rate,
         CASE WHEN COALESCE(m.missing, 0) = 0 THEN
           a.initial_balance * fx_rate_at(a.currency, t.base, (a.created_at AT TIME ZONE t.tz)::DATE)
           + COALESCE(m.net_base, 0)
         END AS cost_base
  FROM accounts a
  CROSS JOIN today t
  LEFT JOIN account_types at ON at.id = a.type_id
  LEFT JOIN banks b ON b.id = a.bank_id AND b.user_id = a.user_id
  LEFT JOIN moves m ON m.account_id = a.id
  LEFT JOIN vals v ON v.account_id = a.id
  WHERE a.user_id = p_user_id
)
SELECT v.id, v.name, v.bank, v.last_four_digits, v.type_id, v.currency,
       v.bal, v.today_rate, round(v.bal * v.today_rate, 4), round(v.cost_base, 4),
       round(v.bal * v.today_rate - v.cost_base, 4),
       CASE WHEN v.class = 'investment' THEN v.adj END
FROM valued v
ORDER BY v.type_id, v.id
$$;

-- ---------------------------------------------------------------- reportes de saldos con los ajustes
CREATE OR REPLACE FUNCTION analysis_daily(p_user_id VARCHAR)
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
         d.inflow - d.outflow AS net, d.inflow_base - d.outflow_base AS net_base,
         d.transfer_inflow_base - d.transfer_outflow_base AS transfer_net_base
  FROM daily_account_totals d
  JOIN acc ON acc.id = d.account_id
  LEFT JOIN categories c ON c.id = d.category_id
  WHERE d.user_id = p_user_id
),
-- flujos del día en moneda base (como CURATED_TRANSACTIONS), sin las transferencias ligadas
flows AS (
  SELECT t.day,
         sum(CASE WHEN t.income_cat IS TRUE AND t.type_id IN (1, 2, 3) THEN t.net_base - t.transfer_net_base ELSE 0 END) AS inc,
         sum(CASE WHEN t.income_cat IS FALSE AND t.type_id IN (1, 2, 4) THEN t.net_base - t.transfer_net_base ELSE 0 END) AS exp,
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
-- movimiento nativo de cada cuenta por día, incluido el saldo inicial el día de creación y los
-- ajustes de las valoraciones
acc_days AS (
  SELECT x.account_id, x.day, sum(x.net_savings) AS net_savings, sum(x.net_credits) AS net_credits
  FROM (
    SELECT t.account_id, t.day,
           CASE WHEN t.income_cat IS NOT NULL THEN t.net ELSE 0 END AS net_savings,
           CASE WHEN t.income_cat IS FALSE THEN t.net ELSE 0 END AS net_credits
    FROM tot t
    UNION ALL
    SELECT a.id, a.created_day, 0, 0 FROM acc a
    UNION ALL
    -- inversiones: el saldo salta a cada valoración (no es flujo)
    SELECT vd.account_id, vd.day, vd.delta, 0 FROM account_valuation_deltas(p_user_id) vd
  ) x
  GROUP BY x.account_id, x.day
),
acc_moves AS (
  SELECT m.account_id, m.day,
         CASE
           WHEN a.type_id IN (1, 2, 3) THEN
             m.net_savings + CASE WHEN m.day = a.created_day THEN a.initial_balance ELSE 0 END
           WHEN a.type_id = 4 THEN
             m.net_credits + CASE WHEN m.day = a.created_day THEN a.initial_balance ELSE 0 END
           ELSE 0
         END AS delta
  FROM acc_days m
  JOIN acc a ON a.id = m.account_id
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

-- Saldo nativo de cada cuenta al cierre de cada mes con movimientos (o el de su creación); las
-- inversiones, ancladas a sus valoraciones.
CREATE OR REPLACE FUNCTION analysis_monthly_accounts(p_user_id VARCHAR)
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
    UNION ALL
    SELECT vd.account_id, vd.day, vd.delta, 0 FROM account_valuation_deltas(p_user_id) vd
  ) x
  GROUP BY x.account_id, x.day
),
months AS (
  SELECT a.id, a.name, a.type_id, extract(YEAR FROM x.day) AS y, extract(MONTH FROM x.day) AS mo,
         sum(x.net + CASE WHEN x.day = a.created_day THEN a.initial_balance ELSE 0 END) AS total
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
