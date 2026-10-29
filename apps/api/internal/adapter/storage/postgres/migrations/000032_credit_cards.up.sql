-- Tarjetas de crédito como pasivos (plan/10-tipos-de-cuenta.md, etapa 4).
--
-- Datos de la tarjeta (cupo, corte, pago), cuotas de una compra (informativo: la compra es gasto
-- completo el día en que se hace) y el estado del último corte. No cambia ningún reporte.

CREATE TABLE credit_card_details (
  account_id       BIGINT PRIMARY KEY REFERENCES accounts (id) ON DELETE CASCADE,
  user_id          VARCHAR(255) NOT NULL,
  credit_limit     NUMERIC(20,4) CHECK (credit_limit IS NULL OR credit_limit >= 0), -- moneda de la cuenta
  statement_day    SMALLINT CHECK (statement_day BETWEEN 1 AND 31),                 -- día de corte
  due_day          SMALLINT CHECK (due_day BETWEEN 1 AND 31),                       -- día límite de pago
  interest_rate_ea NUMERIC(9,6) CHECK (interest_rate_ea IS NULL OR interest_rate_ea >= 0), -- % efectivo anual
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Solo tarjetas (clase credit) del mismo usuario
CREATE FUNCTION credit_card_details_check() RETURNS TRIGGER
  LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM accounts a JOIN account_types t ON t.id = a.type_id
                 WHERE a.id = NEW.account_id AND a.user_id = NEW.user_id AND t.class = 'credit') THEN
    RAISE EXCEPTION 'credit_card_details: la cuenta % no es una tarjeta del usuario', NEW.account_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'credit_card_details_credit';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

CREATE TRIGGER credit_card_details_check
  BEFORE INSERT OR UPDATE ON credit_card_details
  FOR EACH ROW EXECUTE FUNCTION credit_card_details_check();

-- Compra diferida a N cuotas. Informativo: el gasto es la compra completa en su fecha.
ALTER TABLE transactions
  ADD COLUMN installments SMALLINT CONSTRAINT transactions_installments_check CHECK (installments BETWEEN 2 AND 120);

-- Día p_day de un mes, ajustado al último día si el mes es más corto (corte el 31 en febrero = 28/29).
CREATE FUNCTION day_in_month(p_month DATE, p_day INT) RETURNS DATE
  LANGUAGE sql IMMUTABLE AS $$
  SELECT date_trunc('month', p_month)::DATE
         + (least(p_day, extract(DAY FROM date_trunc('month', p_month) + INTERVAL '1 month - 1 day')::INT) - 1)
$$;

-- Estado de las tarjetas del usuario hoy (en la moneda de cada una; deuda = saldo negativo en positivo):
--   debt                  deuda de hoy (0 si hay saldo a favor)
--   available             cupo − deuda (NULL sin cupo)
--   last_statement        último corte (<= hoy); next_statement el siguiente
--   statement_debt        deuda al cierre del último corte
--   paid_since_statement  pagos y abonos (entradas) después del corte
--   pending_statement     lo que falta pagar del corte: max(statement_debt − paid_since_statement, 0)
--   due_date              fecha límite del último corte (el primer día de pago después del corte)
--   purchases_since       compras y cargos (salidas) después del corte
--   installment_purchases compras a cuotas con saldo: el extracto cobra solo la cuota, así que
--                         pending_statement es un tope y no lo que cobra el banco
-- Sin día de corte: solo debt y available.
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
