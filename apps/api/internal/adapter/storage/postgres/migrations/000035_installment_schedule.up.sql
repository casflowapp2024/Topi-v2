-- Cuotas: calendario de las compras con tarjeta a varias cuotas (plan/21-cuotas.md). No se guarda:
-- sale de transactions.installments, así cambiar las cuotas o borrar la compra lo corrige solo.

-- Cuándo se preguntó o se decidió cuántas cuotas tiene una compra. NULL = aún no.
ALTER TABLE transactions ADD COLUMN installments_reviewed_at TIMESTAMPTZ;

-- Una fila por cuota. Solo compras: ni entradas ni patas de una transferencia.
--   budget_date     compra + (k − 1) meses: el mes donde pesa en gastos y presupuestos
--   statement_date  corte k contando el primero en o después de la compra: donde el banco la cobra.
--                   Sin día de corte, NULL. Una compra el día del corte entra a ese corte.
--   amount          monto / n; la última cuota absorbe el redondeo para que la suma sea exacta
--   amount_base     igual, con la tasa de la compra; NULL si la compra aún no tiene tasa
CREATE FUNCTION installment_schedule(p_user_id VARCHAR)
RETURNS TABLE (
  transaction_id BIGINT, account_id BIGINT, category_id BIGINT, purchased_on DATE,
  installment INT, installments INT, budget_date DATE, statement_date DATE,
  amount NUMERIC, amount_base NUMERIC
)
  LANGUAGE sql STABLE AS $$
WITH purchases AS (
  SELECT t.id, t.account_id, t.category_id, t.amount, t.amount_base, t.installments::INT AS n,
         (t.date AT TIME ZONE user_timezone(p_user_id))::DATE AS day,
         d.statement_day
  FROM transactions t
  JOIN accounts a ON a.id = t.account_id
  JOIN account_types at ON at.id = a.type_id AND at.class = 'credit'
  LEFT JOIN credit_card_details d ON d.account_id = a.id
  WHERE t.user_id = p_user_id AND t.expense AND t.installments IS NOT NULL
    AND t.transfer_group_id IS NULL
),
dated AS (
  SELECT p.*,
         CASE WHEN p.statement_day IS NOT NULL THEN
           CASE WHEN day_in_month(p.day, p.statement_day) >= p.day THEN day_in_month(p.day, p.statement_day)
                ELSE day_in_month((date_trunc('month', p.day) + INTERVAL '1 month')::DATE, p.statement_day) END
         END AS first_cut
  FROM purchases p
)
SELECT d.id, d.account_id, d.category_id, d.day, k, d.n,
       (d.day + make_interval(months => k - 1))::DATE,
       CASE WHEN d.first_cut IS NOT NULL THEN
         day_in_month((date_trunc('month', d.first_cut) + make_interval(months => k - 1))::DATE, d.statement_day)
       END,
       CASE WHEN k = d.n THEN d.amount - round(d.amount / d.n, 4) * (d.n - 1) ELSE round(d.amount / d.n, 4) END,
       CASE WHEN k = d.n THEN d.amount_base - round(d.amount_base / d.n, 4) * (d.n - 1) ELSE round(d.amount_base / d.n, 4) END
FROM dated d
CROSS JOIN LATERAL generate_series(1, d.n) k
ORDER BY d.id, k
$$;
