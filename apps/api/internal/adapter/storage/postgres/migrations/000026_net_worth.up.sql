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
