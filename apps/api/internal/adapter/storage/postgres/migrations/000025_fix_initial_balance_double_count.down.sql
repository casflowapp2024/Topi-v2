-- Vuelve al cálculo de la 000024 (con el doble conteo del saldo inicial, marcado LEGADO).

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

-- Saldo nativo de cada cuenta al cierre de cada mes con movimientos (o el de su creación).
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
