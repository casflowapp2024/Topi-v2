-- Un corte queda pagado solo si se cubre lo cobrado (antes bastaba el 10 %), y lo que falte se arrastra
-- al corte siguiente. El arrastre es por cortes, con las reglas de card_charges y desde el mismo punto
-- (cortes de octubre de 2026): no usa el saldo acumulado de la cuenta, que arrastra lo que nunca llegó.

-- Lo que quedó sin pagar de los cortes anteriores a p_cut. Lo pagado de más antes cubre lo que falte después.
CREATE FUNCTION card_carry(p_user_id VARCHAR, p_account_id BIGINT, p_cut DATE) RETURNS NUMERIC
  LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_card RECORD;
  v_cycle RECORD;
  v_carry NUMERIC := 0;
  v_credit NUMERIC := 0;
  v_due NUMERIC;
  v_paid NUMERIC;
  v_short NUMERIC;
  v_take NUMERIC;
BEGIN
  SELECT d.statement_day, (a.created_at AT TIME ZONE user_timezone(p_user_id))::DATE AS created_day INTO v_card
  FROM accounts a
  JOIN credit_card_details d ON d.account_id = a.id AND d.statement_day IS NOT NULL
  WHERE a.id = p_account_id AND a.user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  FOR v_cycle IN
    SELECT day_in_month((p_cut - make_interval(months => i + 1))::DATE, v_card.statement_day) AS prev_cut,
           day_in_month((p_cut - make_interval(months => i))::DATE, v_card.statement_day) AS cut,
           day_in_month((p_cut - make_interval(months => i - 1))::DATE, v_card.statement_day) AS next_cut
    FROM generate_series(120, 1, -1) i
  LOOP
    CONTINUE WHEN v_cycle.cut < DATE '2026-10-01' OR v_cycle.prev_cut < v_card.created_day;

    v_due := v_carry + card_billed(p_user_id, p_account_id, v_cycle.prev_cut, v_cycle.cut);
    SELECT COALESCE(sum(x.inflow), 0) INTO v_paid FROM daily_account_totals x
    WHERE x.account_id = p_account_id AND x.day > v_cycle.cut AND x.day <= v_cycle.next_cut;

    IF v_paid > v_due THEN
      v_credit := v_credit + v_paid - v_due;
      v_carry := 0;
    ELSE
      v_short := v_due - v_paid;
      v_take := least(v_credit, v_short);
      v_credit := v_credit - v_take;
      v_carry := v_short - v_take;
    END IF;
  END LOOP;
  RETURN v_carry;
END
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

CREATE OR REPLACE FUNCTION credit_card_cycles(p_user_id VARCHAR, p_account_id BIGINT, p_limit INT DEFAULT 12)
RETURNS TABLE (statement_date DATE, purchases NUMERIC, payments NUMERIC, counted BOOLEAN)
  LANGUAGE sql STABLE AS $$
WITH card AS (
  SELECT a.id, d.statement_day, t.day AS today,
         (a.created_at AT TIME ZONE user_timezone(p_user_id))::DATE AS created_day,
         CASE WHEN day_in_month(t.day, d.statement_day) <= t.day THEN day_in_month(t.day, d.statement_day)
              ELSE day_in_month((t.day - INTERVAL '1 month')::DATE, d.statement_day) END AS last_stmt
  FROM accounts a
  JOIN account_types at ON at.id = a.type_id AND at.class = 'credit'
  JOIN credit_card_details d ON d.account_id = a.id AND d.statement_day IS NOT NULL
  CROSS JOIN LATERAL (SELECT (now() AT TIME ZONE user_timezone(p_user_id))::DATE AS day) t
  WHERE a.user_id = p_user_id AND a.id = p_account_id
),
cuts AS (
  SELECT c.id, c.created_day, i,
         day_in_month((c.last_stmt - make_interval(months => i + 1))::DATE, c.statement_day) AS prev_cut,
         day_in_month((c.last_stmt - make_interval(months => i))::DATE, c.statement_day) AS cut,
         CASE WHEN i = 0 THEN c.today
              ELSE day_in_month((c.last_stmt - make_interval(months => i - 1))::DATE, c.statement_day) END AS next_cut
  FROM card c, generate_series(0, p_limit - 1) i
),
totals AS (
  SELECT c.*,
         card_billed(p_user_id, c.id, c.prev_cut, c.cut) AS bought,
         COALESCE((SELECT sum(x.inflow) FROM daily_account_totals x
                   WHERE x.account_id = c.id AND x.day > c.cut AND x.day <= c.next_cut), 0) AS paid
  FROM cuts c
)
SELECT t.cut, t.bought, t.paid,
       t.prev_cut >= t.created_day AND (t.i > 0 OR t.paid > 0)
FROM totals t
WHERE t.cut >= t.created_day
ORDER BY t.cut
$$;
