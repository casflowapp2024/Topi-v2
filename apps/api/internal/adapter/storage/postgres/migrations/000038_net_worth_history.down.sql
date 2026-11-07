-- Vuelve al patrimonio y estado de tarjetas solo de hoy
CREATE OR REPLACE FUNCTION net_worth(p_user_id VARCHAR)
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
cards AS (
  SELECT s.account_id, s.debt FROM credit_card_status(p_user_id) s WHERE s.last_statement IS NOT NULL
),
valued AS (
  SELECT a.id, a.name, b.name AS bank, a.last_four_digits, a.type_id, a.currency, at.class,
         COALESCE(-c.debt, a.initial_balance + COALESCE(m.net, 0) + COALESCE(v.adj, 0)) AS bal,
         COALESCE(v.adj, 0) AS adj,
         fx_rate_at(a.currency, t.base, t.day) AS today_rate,
         CASE WHEN c.account_id IS NOT NULL THEN -c.debt * fx_rate_at(a.currency, t.base, t.day)
              WHEN COALESCE(m.missing, 0) = 0 THEN
           a.initial_balance * fx_rate_at(a.currency, t.base, (a.created_at AT TIME ZONE t.tz)::DATE)
           + COALESCE(m.net_base, 0)
         END AS cost_base
  FROM accounts a
  CROSS JOIN today t
  LEFT JOIN account_types at ON at.id = a.type_id
  LEFT JOIN banks b ON b.id = a.bank_id AND b.user_id = a.user_id
  LEFT JOIN moves m ON m.account_id = a.id
  LEFT JOIN vals v ON v.account_id = a.id
  LEFT JOIN cards c ON c.account_id = a.id
  WHERE a.user_id = p_user_id
)
SELECT v.id, v.name, v.bank, v.last_four_digits, v.type_id, v.currency,
       v.bal, v.today_rate, round(v.bal * v.today_rate, 4), round(v.cost_base, 4),
       round(v.bal * v.today_rate - v.cost_base, 4),
       CASE WHEN v.class = 'investment' THEN v.adj END
FROM valued v
ORDER BY v.type_id, v.id
$$;

DROP FUNCTION net_worth_at(VARCHAR, DATE);

DROP FUNCTION credit_card_status(VARCHAR, DATE);
CREATE FUNCTION credit_card_status(p_user_id VARCHAR)
RETURNS TABLE (
  account_id BIGINT, account_name VARCHAR, currency VARCHAR,
  credit_limit NUMERIC, statement_day SMALLINT, due_day SMALLINT, interest_rate_ea NUMERIC,
  debt NUMERIC, available NUMERIC,
  last_statement DATE, next_statement DATE, due_date DATE,
  statement_debt NUMERIC, paid_since_statement NUMERIC, pending_statement NUMERIC,
  purchases_since NUMERIC, installment_purchases INT
)
  LANGUAGE sql STABLE AS $$
WITH today AS (
  SELECT (now() AT TIME ZONE user_timezone(p_user_id))::DATE AS day
),
cards AS (
  SELECT a.id, a.name, a.currency, a.initial_balance, d.credit_limit, d.statement_day, d.due_day,
         d.interest_rate_ea, t.day AS today,
         (a.created_at AT TIME ZONE user_timezone(p_user_id))::DATE AS created_day,
         greatest(-a.initial_balance, 0) AS opening_debt,
         CASE WHEN d.statement_day IS NOT NULL THEN
           CASE WHEN day_in_month(t.day, d.statement_day) <= t.day THEN day_in_month(t.day, d.statement_day)
                ELSE day_in_month((t.day - INTERVAL '1 month')::DATE, d.statement_day) END
         END AS last_stmt
  FROM accounts a
  JOIN account_types at ON at.id = a.type_id AND at.class = 'credit'
  LEFT JOIN credit_card_details d ON d.account_id = a.id
  CROSS JOIN today t
  WHERE a.user_id = p_user_id AND a.closed_at IS NULL
),
periods AS (
  SELECT c.*,
         day_in_month((c.last_stmt - INTERVAL '1 month')::DATE, c.statement_day) AS prev_stmt,
         day_in_month((c.last_stmt + INTERVAL '1 month')::DATE, c.statement_day) AS next_stmt
  FROM cards c
),
calc AS (
  SELECT c.*,
         CASE WHEN c.last_stmt IS NOT NULL THEN card_carry(p_user_id, c.id, c.last_stmt) ELSE 0 END AS carried,
         c.initial_balance + COALESCE((SELECT sum(x.inflow - x.outflow) FROM daily_account_totals x
                                       WHERE x.account_id = c.id AND x.day <= c.today), 0) AS bal_today,
         card_billed(p_user_id, c.id, c.prev_stmt, c.last_stmt)
           + CASE WHEN c.created_day > c.prev_stmt AND c.created_day <= c.last_stmt THEN c.opening_debt ELSE 0 END AS stmt_bought,
         COALESCE((SELECT sum(x.inflow) FROM daily_account_totals x
                   WHERE x.account_id = c.id AND x.day > c.last_stmt AND x.day <= c.today), 0) AS paid,
         card_billed(p_user_id, c.id, c.last_stmt, c.next_stmt)
           + CASE WHEN c.created_day > c.last_stmt THEN c.opening_debt ELSE 0 END AS bought,
         COALESCE((SELECT sum(s.amount) FROM installment_schedule(p_user_id) s
                   WHERE s.account_id = c.id AND s.statement_date > c.next_stmt), 0) AS future_installments
  FROM periods c
),
owed AS (
  SELECT c.*,
         greatest(c.carried + c.stmt_bought - c.paid, 0) AS pending,
         greatest(c.paid - c.carried - c.stmt_bought, 0) AS overpaid
  FROM calc c
),
final AS (
  SELECT o.*,
         CASE WHEN o.last_stmt IS NOT NULL THEN greatest(o.pending + o.bought + o.future_installments - o.overpaid, 0)
              ELSE greatest(-o.bal_today, 0) END AS est_debt
  FROM owed o
)
SELECT c.id, c.name, c.currency, c.credit_limit, c.statement_day, c.due_day, c.interest_rate_ea,
       c.est_debt,
       c.credit_limit - c.est_debt,
       c.last_stmt,
       c.next_stmt,
       CASE WHEN c.last_stmt IS NOT NULL AND c.due_day IS NOT NULL THEN
         CASE WHEN day_in_month(c.last_stmt, c.due_day) > c.last_stmt THEN day_in_month(c.last_stmt, c.due_day)
              ELSE day_in_month((c.last_stmt + INTERVAL '1 month')::DATE, c.due_day) END
       END,
       CASE WHEN c.last_stmt IS NOT NULL THEN c.stmt_bought END,
       CASE WHEN c.last_stmt IS NOT NULL THEN c.paid END,
       CASE WHEN c.last_stmt IS NOT NULL THEN c.pending END,
       CASE WHEN c.last_stmt IS NOT NULL THEN c.bought END,
       (SELECT count(*)::INT FROM transactions tx
        WHERE tx.account_id = c.id AND tx.expense AND tx.installments IS NOT NULL
          AND (tx.date AT TIME ZONE user_timezone(p_user_id))::DATE
              > (c.today - make_interval(months => tx.installments::INT))::DATE)
FROM final c
ORDER BY c.id
$$;

DROP FUNCTION card_billed(VARCHAR, BIGINT, DATE, DATE, DATE);
CREATE FUNCTION card_billed(p_user_id VARCHAR, p_account_id BIGINT, p_from DATE, p_to DATE) RETURNS NUMERIC
  LANGUAGE sql STABLE AS $$
SELECT COALESCE((SELECT sum(x.outflow) FROM daily_account_totals x
                 WHERE x.account_id = p_account_id AND x.day > p_from AND x.day <= p_to), 0)
       - COALESCE((SELECT sum(s.amount) FROM installment_schedule(p_user_id) s
                   WHERE s.account_id = p_account_id AND s.purchased_on > p_from AND s.purchased_on <= p_to
                     AND s.statement_date IS NOT NULL), 0)
       + COALESCE((SELECT sum(s.amount) FROM installment_schedule(p_user_id) s
                   WHERE s.account_id = p_account_id AND s.statement_date > p_from AND s.statement_date <= p_to), 0)
$$;
