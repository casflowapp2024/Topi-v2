-- Cargos de tarjeta: lo que se pagó por encima de lo registrado (intereses, cuota de manejo, seguros
-- o compras que no llegaron por correo). No se guarda como transacción: se calcula desde los cortes,
-- así una compra que llega tarde corrige el cargo sola y no se cuenta dos veces.

-- Por corte: lo que se debe es lo que venía de antes + las compras del corte, y se paga entre ese corte
-- y el siguiente, a nombre del último pago de esa ventana. Reglas:
--   - Pago mayor a lo debido: el excedente es un cargo.
--   - Pago menor en un corte ya cerrado: lo que falta primero descuenta los cargos anteriores (eran un
--     pago adelantado, no un cargo) y lo demás se arrastra al corte siguiente.
--   - El corte en curso solo puede sumar cargos: todavía puede faltar su pago.
-- Solo desde los cortes de octubre de 2026: la historia anterior no se recalcula, y una tarjeta debe
-- tener su periodo completo (la cuenta ya existía).
CREATE FUNCTION card_charges(p_user_id VARCHAR, p_today DATE DEFAULT NULL)
RETURNS TABLE (
  account_id BIGINT, account_name VARCHAR, currency VARCHAR, statement_date DATE, charged_on DATE,
  amount NUMERIC, amount_base NUMERIC
)
  LANGUAGE plpgsql STABLE AS $$
#variable_conflict use_column
DECLARE
  v_today DATE := COALESCE(p_today, (now() AT TIME ZONE user_timezone(p_user_id))::DATE);
  v_base VARCHAR := user_base_currency(p_user_id);
  v_card RECORD;
  v_cycle RECORD;
  v_carry NUMERIC;
  v_bought NUMERIC;
  v_paid NUMERIC;
  v_last_payment DATE;
  v_due NUMERIC;
  v_short NUMERIC;
  v_take NUMERIC;
  v_cuts DATE[];
  v_days DATE[];
  v_amounts NUMERIC[];
BEGIN
  FOR v_card IN
    SELECT a.id, a.name, a.currency, d.statement_day,
           (a.created_at AT TIME ZONE user_timezone(p_user_id))::DATE AS created_day,
           CASE WHEN day_in_month(v_today, d.statement_day) <= v_today THEN day_in_month(v_today, d.statement_day)
                ELSE day_in_month((v_today - INTERVAL '1 month')::DATE, d.statement_day) END AS last_stmt
    FROM accounts a
    JOIN account_types at ON at.id = a.type_id AND at.class = 'credit'
    JOIN credit_card_details d ON d.account_id = a.id AND d.statement_day IS NOT NULL
    WHERE a.user_id = p_user_id
  LOOP
    v_carry := 0;
    v_cuts := '{}';
    v_days := '{}';
    v_amounts := '{}';
    FOR v_cycle IN
      SELECT i,
             day_in_month((v_card.last_stmt - make_interval(months => i + 1))::DATE, v_card.statement_day) AS prev_cut,
             day_in_month((v_card.last_stmt - make_interval(months => i))::DATE, v_card.statement_day) AS cut,
             CASE WHEN i = 0 THEN v_today
                  ELSE day_in_month((v_card.last_stmt - make_interval(months => i - 1))::DATE, v_card.statement_day) END AS next_cut
      FROM generate_series(120, 0, -1) i
    LOOP
      CONTINUE WHEN v_cycle.cut < DATE '2026-10-01' OR v_cycle.prev_cut < v_card.created_day;

      SELECT COALESCE(sum(x.outflow), 0) INTO v_bought FROM daily_account_totals x
      WHERE x.account_id = v_card.id AND x.day > v_cycle.prev_cut AND x.day <= v_cycle.cut;
      SELECT COALESCE(sum(x.inflow), 0), max(x.day) FILTER (WHERE x.inflow > 0) INTO v_paid, v_last_payment
      FROM daily_account_totals x
      WHERE x.account_id = v_card.id AND x.day > v_cycle.cut AND x.day <= v_cycle.next_cut;

      v_due := v_carry + v_bought;
      IF v_paid > v_due THEN
        v_cuts := v_cuts || v_cycle.cut;
        v_days := v_days || v_last_payment;
        v_amounts := v_amounts || (v_paid - v_due);
        v_carry := 0;
      ELSIF v_cycle.i > 0 THEN
        v_short := v_due - v_paid;
        FOR k IN REVERSE COALESCE(array_length(v_amounts, 1), 0) .. 1 LOOP
          EXIT WHEN v_short <= 0;
          v_take := least(v_amounts[k], v_short);
          v_amounts[k] := v_amounts[k] - v_take;
          v_short := v_short - v_take;
        END LOOP;
        v_carry := v_short;
      END IF;
    END LOOP;

    FOR k IN 1 .. COALESCE(array_length(v_amounts, 1), 0) LOOP
      CONTINUE WHEN v_amounts[k] <= 0;
      account_id := v_card.id;
      account_name := v_card.name;
      currency := v_card.currency;
      statement_date := v_cuts[k];
      charged_on := v_days[k];
      amount := v_amounts[k];
      amount_base := round(v_amounts[k] * fx_rate_at(v_card.currency, v_base, v_days[k]), 4);
      RETURN NEXT;
    END LOOP;
  END LOOP;
END
$$;

-- La categoría existe para quien ya tiene tarjetas, para poder darle presupuesto desde ya
INSERT INTO categories (user_id, name, budget, emoji, income)
SELECT DISTINCT a.user_id, 'Cargos de Tarjeta', 0::NUMERIC, '1f4b3', false
FROM accounts a
JOIN account_types at ON at.id = a.type_id AND at.class = 'credit'
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.user_id = a.user_id AND lower(c.name) = 'cargos de tarjeta');
