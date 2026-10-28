-- Vista previa de una conversión a la que le faltan tasas: antes simulaba con tasa 1 (saldo y
-- reportes "después" sin sentido). Ahora deja balance_after y flows_base_after en NULL y solo
-- informa missing_rates. Aplicar sigue bloqueado igual que en la 000030.

CREATE OR REPLACE FUNCTION change_account_currency(
  p_user_id VARCHAR, p_account_id BIGINT, p_currency VARCHAR, p_mode VARCHAR, p_apply BOOLEAN
)
RETURNS TABLE (
  change_id BIGINT, old_currency VARCHAR, tx_count INT, missing_rates INT, replaced_rates INT,
  balance_before NUMERIC, balance_after NUMERIC, flows_base_before NUMERIC, flows_base_after NUMERIC
)
  LANGUAGE plpgsql AS $$
DECLARE
  v_acc accounts%ROWTYPE;
  v_tz VARCHAR := user_timezone(p_user_id);
  v_base VARCHAR := user_base_currency(p_user_id);
  v_created DATE;
  v_minor INT;
  v_snapshot JSONB;
BEGIN
  SELECT * INTO v_acc FROM accounts a WHERE a.id = p_account_id AND a.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'change_account_currency: cuenta % no encontrada', p_account_id USING ERRCODE = 'no_data_found';
  END IF;
  SELECT c.minor_units INTO v_minor FROM currencies c WHERE c.code = p_currency AND c.is_active;
  IF NOT FOUND OR p_currency = v_acc.currency THEN
    RAISE EXCEPTION 'change_account_currency: moneda inválida %', p_currency
      USING ERRCODE = 'check_violation', CONSTRAINT = 'currency_change_currency';
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('relabel', 'convert') THEN
    RAISE EXCEPTION 'change_account_currency: modo inválido %', p_mode
      USING ERRCODE = 'check_violation', CONSTRAINT = 'currency_change_mode';
  END IF;
  v_created := (v_acc.created_at AT TIME ZONE v_tz)::DATE;

  change_id := NULL;
  old_currency := v_acc.currency;
  SELECT count(*)::INT,
         COALESCE(sum(CASE WHEN t.expense THEN -t.amount_base ELSE t.amount_base END), 0),
         (count(*) FILTER (WHERE t.fx_rate_source IN ('user', 'transfer')))::INT,
         (count(*) FILTER (WHERE CASE WHEN p_mode = 'convert'
                                   THEN fx_rate_at(v_acc.currency, p_currency, (t.date AT TIME ZONE v_tz)::DATE)
                                   ELSE fx_rate_at(p_currency, v_base, (t.date AT TIME ZONE v_tz)::DATE)
                                 END IS NULL))::INT
    INTO tx_count, flows_base_before, replaced_rates, missing_rates
  FROM transactions t WHERE t.account_id = p_account_id;
  IF p_mode = 'convert' THEN
    replaced_rates := 0;
    missing_rates := missing_rates
      + CASE WHEN v_acc.initial_balance <> 0 AND fx_rate_at(v_acc.currency, p_currency, v_created) IS NULL THEN 1 ELSE 0 END
      + (SELECT count(*)::INT FROM account_valuations v
         WHERE v.account_id = p_account_id AND fx_rate_at(v_acc.currency, p_currency, v.valuation_date) IS NULL);
    IF p_apply AND missing_rates > 0 THEN
      RAISE EXCEPTION 'change_account_currency: faltan % tasas %→%', missing_rates, v_acc.currency, p_currency
        USING ERRCODE = 'check_violation', CONSTRAINT = 'currency_change_missing_rates';
    END IF;
  END IF;
  balance_before := account_balance_now(p_user_id, p_account_id);
  -- sin todas las tasas la conversión no se puede calcular: no se inventa un "después"
  IF p_mode = 'convert' AND missing_rates > 0 THEN
    balance_after := NULL;
    flows_base_after := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  v_snapshot := jsonb_build_object(
    'initial_balance', v_acc.initial_balance,
    'transactions', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'amount', t.amount, 'fx_rate', t.fx_rate,
                                      'fx_rate_source', t.fx_rate_source, 'amount_base', t.amount_base))
                              FROM transactions t WHERE t.account_id = p_account_id), '[]'::JSONB),
    'valuations', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', v.id, 'value', v.value))
                            FROM account_valuations v WHERE v.account_id = p_account_id), '[]'::JSONB));

  BEGIN
    UPDATE accounts a SET
      currency = p_currency,
      initial_balance = CASE WHEN p_mode = 'convert'
        THEN round(a.initial_balance * COALESCE(fx_rate_at(v_acc.currency, p_currency, v_created), 1), v_minor)
        ELSE a.initial_balance END
    WHERE a.id = p_account_id;

    IF p_mode = 'relabel' THEN
      -- el trigger toma la moneda de la cuenta y recalcula tasa y amount_base
      UPDATE transactions t SET fx_rate = NULL WHERE t.account_id = p_account_id;
    ELSE
      UPDATE transactions t SET
        amount = c.new_amount,
        fx_rate = CASE WHEN t.amount_base IS NULL OR c.new_amount = 0 THEN NULL
                       ELSE round(t.amount_base / c.new_amount, 12) END,
        fx_rate_source = CASE WHEN t.amount_base IS NULL OR c.new_amount = 0 THEN NULL ELSE 'conversion' END,
        amount_base = t.amount_base
      FROM (SELECT x.id,
                   round(x.amount * COALESCE(fx_rate_at(v_acc.currency, p_currency, (x.date AT TIME ZONE v_tz)::DATE), 1),
                         v_minor) AS new_amount
            FROM transactions x WHERE x.account_id = p_account_id) c
      WHERE t.id = c.id;

      UPDATE account_valuations v SET
        value = round(v.value * COALESCE(fx_rate_at(v_acc.currency, p_currency, v.valuation_date), 1), v_minor)
      WHERE v.account_id = p_account_id;
    END IF;

    balance_after := account_balance_now(p_user_id, p_account_id);
    SELECT COALESCE(sum(CASE WHEN t.expense THEN -t.amount_base ELSE t.amount_base END), 0)
      INTO flows_base_after FROM transactions t WHERE t.account_id = p_account_id;

    IF NOT p_apply THEN
      RAISE EXCEPTION 'vista previa' USING ERRCODE = 'TP001';
    END IF;

    INSERT INTO account_currency_changes (user_id, account_id, mode, old_currency, new_currency, snapshot)
    VALUES (p_user_id, p_account_id, p_mode, v_acc.currency, p_currency, v_snapshot)
    RETURNING id INTO change_id;
  EXCEPTION WHEN SQLSTATE 'TP001' THEN
    NULL; -- vista previa: los cambios del bloque se deshicieron
  END;
  RETURN NEXT;
END
$$;
