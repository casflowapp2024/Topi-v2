-- Vuelve a transferencias, tarjetas y patrimonio como en la 000032. Los pagos pendientes
-- (needs_counterpart) vuelven a contar como flujo: por eso se reconstruyen los totales.
DROP FUNCTION credit_card_cycles(VARCHAR, BIGINT, INT);
DROP FUNCTION link_pending_card_payments(VARCHAR);

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


CREATE OR REPLACE FUNCTION credit_card_status(p_user_id VARCHAR)
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
calc AS (
  SELECT c.*,
         c.initial_balance + COALESCE((SELECT sum(x.inflow - x.outflow) FROM daily_account_totals x
                                       WHERE x.account_id = c.id AND x.day <= c.today), 0) AS bal_today,
         c.initial_balance + COALESCE((SELECT sum(x.inflow - x.outflow) FROM daily_account_totals x
                                       WHERE x.account_id = c.id AND x.day <= c.last_stmt), 0) AS bal_stmt,
         COALESCE((SELECT sum(x.inflow) FROM daily_account_totals x
                   WHERE x.account_id = c.id AND x.day > c.last_stmt AND x.day <= c.today), 0) AS paid,
         COALESCE((SELECT sum(x.outflow) FROM daily_account_totals x
                   WHERE x.account_id = c.id AND x.day > c.last_stmt AND x.day <= c.today), 0) AS bought
  FROM cards c
)
SELECT c.id, c.name, c.currency, c.credit_limit, c.statement_day, c.due_day, c.interest_rate_ea,
       greatest(-c.bal_today, 0),
       c.credit_limit - greatest(-c.bal_today, 0),
       c.last_stmt,
       CASE WHEN c.last_stmt IS NOT NULL THEN day_in_month((c.last_stmt + INTERVAL '1 month')::DATE, c.statement_day) END,
       CASE WHEN c.last_stmt IS NOT NULL AND c.due_day IS NOT NULL THEN
         CASE WHEN day_in_month(c.last_stmt, c.due_day) > c.last_stmt THEN day_in_month(c.last_stmt, c.due_day)
              ELSE day_in_month((c.last_stmt + INTERVAL '1 month')::DATE, c.due_day) END
       END,
       CASE WHEN c.last_stmt IS NOT NULL THEN greatest(-c.bal_stmt, 0) END,
       CASE WHEN c.last_stmt IS NOT NULL THEN c.paid END,
       CASE WHEN c.last_stmt IS NOT NULL THEN greatest(greatest(-c.bal_stmt, 0) - c.paid, 0) END,
       CASE WHEN c.last_stmt IS NOT NULL THEN c.bought END,
       (SELECT count(*)::INT FROM transactions tx
        WHERE tx.account_id = c.id AND tx.expense AND tx.installments IS NOT NULL
          AND (tx.date AT TIME ZONE user_timezone(p_user_id))::DATE
              > (c.today - make_interval(months => tx.installments::INT))::DATE)
FROM calc c
ORDER BY c.id
$$;

CREATE OR REPLACE FUNCTION transactions_daily_totals() RETURNS TRIGGER
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM pg_advisory_xact_lock(hashtext('daily_account_totals:' || OLD.user_id));
    PERFORM daily_account_totals_apply(OLD.user_id, OLD.account_id, OLD.category_id, OLD.date,
                                       OLD.expense, OLD.amount, OLD.amount_base,
                                       OLD.transfer_group_id IS NOT NULL, -1);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM pg_advisory_xact_lock(hashtext('daily_account_totals:' || NEW.user_id));
    PERFORM daily_account_totals_apply(NEW.user_id, NEW.account_id, NEW.category_id, NEW.date,
                                       NEW.expense, NEW.amount, NEW.amount_base,
                                       NEW.transfer_group_id IS NOT NULL, 1);
  END IF;
  RETURN NULL;
END
$$;


DROP TRIGGER transactions_daily_totals_update ON transactions;
CREATE TRIGGER transactions_daily_totals_update
  AFTER UPDATE ON transactions
  FOR EACH ROW
  WHEN ((OLD.user_id, OLD.account_id, OLD.category_id, OLD.date, OLD.expense, OLD.amount, OLD.amount_base,
         OLD.transfer_group_id IS NULL)
        IS DISTINCT FROM
        (NEW.user_id, NEW.account_id, NEW.category_id, NEW.date, NEW.expense, NEW.amount, NEW.amount_base,
         NEW.transfer_group_id IS NULL))
  EXECUTE FUNCTION transactions_daily_totals();


CREATE OR REPLACE FUNCTION daily_account_totals_expected(p_user_id VARCHAR DEFAULT NULL)
RETURNS TABLE (
  user_id VARCHAR, account_id BIGINT, category_id BIGINT, day DATE, inflow NUMERIC, outflow NUMERIC,
  inflow_base NUMERIC, outflow_base NUMERIC, tx_count INT, missing_base_count INT,
  transfer_inflow NUMERIC, transfer_outflow NUMERIC, transfer_inflow_base NUMERIC, transfer_outflow_base NUMERIC
)
  LANGUAGE sql STABLE AS $$
  SELECT t.user_id, t.account_id, t.category_id,
         (t.date AT TIME ZONE COALESCE(ue.utc_offset, 'UTC'))::DATE,
         sum(CASE WHEN t.expense THEN 0 ELSE t.amount END),
         sum(CASE WHEN t.expense THEN t.amount ELSE 0 END),
         sum(CASE WHEN t.expense THEN 0 ELSE COALESCE(t.amount_base, 0) END),
         sum(CASE WHEN t.expense THEN COALESCE(t.amount_base, 0) ELSE 0 END),
         count(*)::INT,
         (count(*) FILTER (WHERE t.amount_base IS NULL))::INT,
         COALESCE(sum(CASE WHEN t.expense THEN 0 ELSE t.amount END)
                  FILTER (WHERE t.transfer_group_id IS NOT NULL), 0),
         COALESCE(sum(CASE WHEN t.expense THEN t.amount ELSE 0 END)
                  FILTER (WHERE t.transfer_group_id IS NOT NULL), 0),
         COALESCE(sum(CASE WHEN t.expense THEN 0 ELSE COALESCE(t.amount_base, 0) END)
                  FILTER (WHERE t.transfer_group_id IS NOT NULL), 0),
         COALESCE(sum(CASE WHEN t.expense THEN COALESCE(t.amount_base, 0) ELSE 0 END)
                  FILTER (WHERE t.transfer_group_id IS NOT NULL), 0)
  FROM transactions t
  LEFT JOIN user_extra ue ON ue.user_id = t.user_id
  WHERE p_user_id IS NULL OR t.user_id = p_user_id
  GROUP BY 1, 2, 3, 4
$$;


DROP INDEX transactions_needs_counterpart;
ALTER TABLE transactions DROP COLUMN needs_counterpart;

SELECT rebuild_daily_account_totals();
