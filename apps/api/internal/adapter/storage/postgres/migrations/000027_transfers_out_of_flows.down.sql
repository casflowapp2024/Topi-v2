-- Vuelve a la 000026: las transferencias ligadas cuentan otra vez como flujos.

DROP TRIGGER transactions_release_transfer ON transactions;
DROP FUNCTION transactions_release_transfer();
DROP FUNCTION unlink_transfer(VARCHAR, UUID);

DROP VIEW transfer_link_candidates;
DROP TABLE transfer_candidate_dismissals;
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


-- analysis_daily de la 000025
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

CREATE OR REPLACE FUNCTION transactions_daily_totals() RETURNS TRIGGER
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

DROP FUNCTION daily_account_totals_apply(VARCHAR, BIGINT, BIGINT, TIMESTAMPTZ, BOOLEAN, NUMERIC, NUMERIC, BOOLEAN, INT);

DROP TRIGGER transactions_daily_totals_update ON transactions;
CREATE TRIGGER transactions_daily_totals_update
  AFTER UPDATE ON transactions
  FOR EACH ROW
  WHEN ((OLD.user_id, OLD.account_id, OLD.category_id, OLD.date, OLD.expense, OLD.amount, OLD.amount_base)
        IS DISTINCT FROM
        (NEW.user_id, NEW.account_id, NEW.category_id, NEW.date, NEW.expense, NEW.amount, NEW.amount_base))
  EXECUTE FUNCTION transactions_daily_totals();

DROP FUNCTION daily_account_totals_expected(VARCHAR);
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

CREATE OR REPLACE FUNCTION rebuild_daily_account_totals(p_user_id VARCHAR DEFAULT NULL) RETURNS INT
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

CREATE OR REPLACE FUNCTION daily_account_totals_drift() RETURNS TABLE (user_id VARCHAR)
  LANGUAGE sql STABLE AS $$
  SELECT DISTINCT COALESCE(e.user_id, d.user_id)
  FROM daily_account_totals_expected() e
  FULL JOIN daily_account_totals d
    ON d.account_id = e.account_id AND d.category_id = e.category_id AND d.day = e.day
  WHERE (e.user_id, e.inflow, e.outflow, e.inflow_base, e.outflow_base, e.tx_count, e.missing_base_count)
        IS DISTINCT FROM
        (d.user_id, d.inflow, d.outflow, d.inflow_base, d.outflow_base, d.tx_count, d.missing_base_count)
$$;

ALTER TABLE daily_account_totals
  DROP COLUMN transfer_inflow,
  DROP COLUMN transfer_outflow,
  DROP COLUMN transfer_inflow_base,
  DROP COLUMN transfer_outflow_base;

SELECT rebuild_daily_account_totals();
