-- Pagos de tarjeta por correo y reglas generales de tarjetas (plan/10-tipos-de-cuenta.md, etapa 4b).
--
-- 1. transactions.needs_counterpart: un pago de tarjeta leído de un correo que todavía no tiene la
--    salida de la cuenta con que se pagó. Mientras tanto ya cuenta como transferencia (fuera de
--    ingresos y gastos) y la app le pregunta al usuario de qué cuenta salió.
-- 2. credit_card_status y net_worth dejan de usar el saldo acumulado de la tarjeta: ese saldo arrastra
--    desde la creación de la cuenta todo lo que nunca llegó por correo (cuotas, intereses, seguros).
--    La deuda se estima con lo que sí se sabe en cualquier banco: compras y pagos de cada corte.
-- 3. credit_card_cycles: compras y pagos por corte, para ver lo pagado por encima de lo comprado.

-- ---------------------------------------------------------------- 1. pago pendiente de contraparte
ALTER TABLE transactions ADD COLUMN needs_counterpart BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX transactions_needs_counterpart ON transactions (user_id) WHERE needs_counterpart;

CREATE OR REPLACE FUNCTION transactions_daily_totals() RETURNS TRIGGER
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM pg_advisory_xact_lock(hashtext('daily_account_totals:' || OLD.user_id));
    PERFORM daily_account_totals_apply(OLD.user_id, OLD.account_id, OLD.category_id, OLD.date,
                                       OLD.expense, OLD.amount, OLD.amount_base,
                                       OLD.transfer_group_id IS NOT NULL OR OLD.needs_counterpart, -1);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM pg_advisory_xact_lock(hashtext('daily_account_totals:' || NEW.user_id));
    PERFORM daily_account_totals_apply(NEW.user_id, NEW.account_id, NEW.category_id, NEW.date,
                                       NEW.expense, NEW.amount, NEW.amount_base,
                                       NEW.transfer_group_id IS NOT NULL OR NEW.needs_counterpart, 1);
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER transactions_daily_totals_update ON transactions;
CREATE TRIGGER transactions_daily_totals_update
  AFTER UPDATE ON transactions
  FOR EACH ROW
  WHEN ((OLD.user_id, OLD.account_id, OLD.category_id, OLD.date, OLD.expense, OLD.amount, OLD.amount_base,
         OLD.transfer_group_id IS NULL AND NOT OLD.needs_counterpart)
        IS DISTINCT FROM
        (NEW.user_id, NEW.account_id, NEW.category_id, NEW.date, NEW.expense, NEW.amount, NEW.amount_base,
         NEW.transfer_group_id IS NULL AND NOT NEW.needs_counterpart))
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
                  FILTER (WHERE t.transfer_group_id IS NOT NULL OR t.needs_counterpart), 0),
         COALESCE(sum(CASE WHEN t.expense THEN t.amount ELSE 0 END)
                  FILTER (WHERE t.transfer_group_id IS NOT NULL OR t.needs_counterpart), 0),
         COALESCE(sum(CASE WHEN t.expense THEN 0 ELSE COALESCE(t.amount_base, 0) END)
                  FILTER (WHERE t.transfer_group_id IS NOT NULL OR t.needs_counterpart), 0),
         COALESCE(sum(CASE WHEN t.expense THEN COALESCE(t.amount_base, 0) ELSE 0 END)
                  FILTER (WHERE t.transfer_group_id IS NOT NULL OR t.needs_counterpart), 0)
  FROM transactions t
  LEFT JOIN user_extra ue ON ue.user_id = t.user_id
  WHERE p_user_id IS NULL OR t.user_id = p_user_id
  GROUP BY 1, 2, 3, 4
$$;

-- Liga cada pago pendiente con la salida que le corresponde cuando no hay duda: exactamente un gasto
-- de una cuenta de depósito con el mismo monto y moneda, a ±1 día, y ese gasto no le sirve a otro
-- pago pendiente. Corre después de cada lote del worker, así que no importa qué correo llega primero.
-- Es la única excepción a "las transferencias no se ligan solas". Devuelve cuántos pagos ligó.
CREATE FUNCTION link_pending_card_payments(p_user_id VARCHAR) RETURNS INT
  LANGUAGE plpgsql AS $$
DECLARE
  v_pair RECORD;
  v_group UUID;
  v_linked INT := 0;
BEGIN
  FOR v_pair IN
    WITH pairs AS (
      SELECT p.id AS in_id, o.id AS out_id,
             count(*) OVER (PARTITION BY p.id) AS for_payment,
             count(*) OVER (PARTITION BY o.id) AS for_expense
      FROM transactions p
      JOIN transactions o
        ON o.user_id = p.user_id AND o.account_id <> p.account_id AND o.expense IS TRUE
       AND o.transfer_group_id IS NULL AND o.amount = p.amount AND o.currency = p.currency
       AND o.date BETWEEN p.date - INTERVAL '1 day' AND p.date + INTERVAL '1 day'
      JOIN accounts a ON a.id = o.account_id
      JOIN account_types at ON at.id = a.type_id AND at.class = 'deposit'
      WHERE p.user_id = p_user_id AND p.needs_counterpart AND p.transfer_group_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM transfer_candidate_dismissals x
                        WHERE x.out_transaction_id = o.id AND x.in_transaction_id = p.id)
    )
    SELECT in_id, out_id FROM pairs WHERE for_payment = 1 AND for_expense = 1
  LOOP
    v_group := gen_random_uuid();
    UPDATE transactions SET transfer_group_id = v_group, needs_counterpart = false, updated_at = now()
    WHERE user_id = p_user_id AND id IN (v_pair.in_id, v_pair.out_id);
    v_linked := v_linked + 1;
  END LOOP;
  RETURN v_linked;
END
$$;

-- ---------------------------------------------------------------- 2. estado de las tarjetas
-- Estado de las tarjetas del usuario hoy (en la moneda de cada una). Con día de corte, por cortes:
--   statement_debt        compras y cargos del último corte (lo que el corte cobraría, aproximado)
--   paid_since_statement  pagos y abonos (entradas) después del corte
--   purchases_since       compras y cargos después del corte (los consumos de este corte)
--   pending_statement     lo que falta del corte: 0 si ya hubo un pago, si no statement_debt − entradas.
--                         Un pago cuenta si llega al 10 % del corte: una devolución pequeña no paga
--                         el corte, y no se compara contra el monto porque el banco cobra distinto
--                         (cuotas, intereses, seguros).
--   debt                  deuda estimada: lo que falta del corte + consumos − lo pagado de más
-- Una deuda inicial cuenta como compra del día en que se creó la cuenta.
-- Sin día de corte no hay cortes: debt es el saldo de la cuenta (0 si hay saldo a favor).
--   available             cupo − deuda (NULL sin cupo)
--   due_date              fecha límite del último corte (el primer día de pago después del corte)
--   installment_purchases compras a cuotas con saldo (el extracto cobra solo la cuota)
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
         day_in_month((c.last_stmt - INTERVAL '1 month')::DATE, c.statement_day) AS prev_stmt
  FROM cards c
),
calc AS (
  SELECT c.*,
         c.initial_balance + COALESCE((SELECT sum(x.inflow - x.outflow) FROM daily_account_totals x
                                       WHERE x.account_id = c.id AND x.day <= c.today), 0) AS bal_today,
         COALESCE((SELECT sum(x.outflow) FROM daily_account_totals x
                   WHERE x.account_id = c.id AND x.day > c.prev_stmt AND x.day <= c.last_stmt), 0)
           + CASE WHEN c.created_day > c.prev_stmt AND c.created_day <= c.last_stmt THEN c.opening_debt ELSE 0 END AS stmt_bought,
         COALESCE((SELECT sum(x.inflow) FROM daily_account_totals x
                   WHERE x.account_id = c.id AND x.day > c.last_stmt AND x.day <= c.today), 0) AS paid,
         COALESCE((SELECT sum(x.outflow) FROM daily_account_totals x
                   WHERE x.account_id = c.id AND x.day > c.last_stmt AND x.day <= c.today), 0)
           + CASE WHEN c.created_day > c.last_stmt THEN c.opening_debt ELSE 0 END AS bought
  FROM periods c
),
owed AS (
  SELECT c.*,
         CASE WHEN c.paid >= c.stmt_bought * 0.1 THEN 0 ELSE c.stmt_bought - c.paid END AS pending,
         CASE WHEN c.paid >= c.stmt_bought * 0.1 THEN greatest(c.paid - c.stmt_bought, 0) ELSE 0 END AS overpaid
  FROM calc c
),
final AS (
  SELECT o.*,
         CASE WHEN o.last_stmt IS NOT NULL THEN greatest(o.pending + o.bought - o.overpaid, 0)
              ELSE greatest(-o.bal_today, 0) END AS est_debt
  FROM owed o
)
SELECT c.id, c.name, c.currency, c.credit_limit, c.statement_day, c.due_day, c.interest_rate_ea,
       c.est_debt,
       c.credit_limit - c.est_debt,
       c.last_stmt,
       CASE WHEN c.last_stmt IS NOT NULL THEN day_in_month((c.last_stmt + INTERVAL '1 month')::DATE, c.statement_day) END,
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

-- Patrimonio: una tarjeta con día de corte vale su deuda estimada (credit_card_status), no el saldo
-- acumulado. Sin día de corte, o cerrada, sigue siendo su saldo. La deuda estimada no tiene costo
-- propio: cost = el mismo valor y unrealized_gain = 0.
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

-- ---------------------------------------------------------------- 3. compras y pagos por corte
-- Últimos cortes de una tarjeta, del más viejo al más nuevo. purchases: compras y cargos del corte;
-- payments: lo que entró entre ese corte y el siguiente, que es cuando se paga. counted indica si la
-- fila entra en la comparación: su periodo está completo (la cuenta ya existía) y, si es el último
-- corte, ya tiene un pago (mismo 10 % de credit_card_status).
CREATE FUNCTION credit_card_cycles(p_user_id VARCHAR, p_account_id BIGINT, p_limit INT DEFAULT 12)
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
         COALESCE((SELECT sum(x.outflow) FROM daily_account_totals x
                   WHERE x.account_id = c.id AND x.day > c.prev_cut AND x.day <= c.cut), 0) AS bought,
         COALESCE((SELECT sum(x.inflow) FROM daily_account_totals x
                   WHERE x.account_id = c.id AND x.day > c.cut AND x.day <= c.next_cut), 0) AS paid
  FROM cuts c
)
SELECT t.cut, t.bought, t.paid,
       t.prev_cut >= t.created_day AND (t.i > 0 OR t.paid >= t.bought * 0.1)
FROM totals t
WHERE t.cut >= t.created_day
ORDER BY t.cut
$$;
