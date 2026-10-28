-- Vuelve a la 000028: sin valoraciones (el saldo de las inversiones = saldo inicial + movimientos).

-- analysis_daily de la 000027
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

-- analysis_monthly_accounts de la 000025
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

DROP FUNCTION net_worth(VARCHAR);
-- Multimoneda (Fase 3): patrimonio actual por cuenta.
--   balance        saldo nativo hoy (saldo inicial + transacciones hasta hoy, en la moneda de la cuenta)
--   rate           tasa de hoy de la moneda de la cuenta a la moneda base del usuario
--   base_value     balance × rate
--   cost           costo histórico en moneda base: saldo inicial a la tasa del día de creación de la
--                  cuenta + amount_base de cada transacción hasta hoy (NULL si a alguna le falta)
--   unrealized_gain base_value − cost: ganancia (o pérdida) cambiaria no realizada
-- Las tarjetas tienen saldo negativo: una deuda en USD que sube en COP da una pérdida.
CREATE FUNCTION net_worth(p_user_id VARCHAR)
RETURNS TABLE (
  account_id BIGINT, account_name VARCHAR, bank_name VARCHAR, last_four_digits VARCHAR, type_id BIGINT,
  currency VARCHAR, balance NUMERIC, rate NUMERIC, base_value NUMERIC, cost NUMERIC, unrealized_gain NUMERIC
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
valued AS (
  SELECT a.id, a.name, b.name AS bank, a.last_four_digits, a.type_id, a.currency,
         a.initial_balance + COALESCE(m.net, 0) AS bal,
         fx_rate_at(a.currency, t.base, t.day) AS today_rate,
         CASE WHEN COALESCE(m.missing, 0) = 0 THEN
           a.initial_balance * fx_rate_at(a.currency, t.base, (a.created_at AT TIME ZONE t.tz)::DATE)
           + COALESCE(m.net_base, 0)
         END AS cost_base
  FROM accounts a
  CROSS JOIN today t
  LEFT JOIN banks b ON b.id = a.bank_id AND b.user_id = a.user_id
  LEFT JOIN moves m ON m.account_id = a.id
  WHERE a.user_id = p_user_id
)
SELECT v.id, v.name, v.bank, v.last_four_digits, v.type_id, v.currency,
       v.bal, v.today_rate, round(v.bal * v.today_rate, 4), round(v.cost_base, 4),
       round(v.bal * v.today_rate - v.cost_base, 4)
FROM valued v
ORDER BY v.type_id, v.id
$$;

DROP FUNCTION investment_performance(VARCHAR, DATE, DATE);
DROP FUNCTION account_valuation_deltas(VARCHAR);
DROP TABLE account_valuations;
DROP FUNCTION account_valuations_check();
