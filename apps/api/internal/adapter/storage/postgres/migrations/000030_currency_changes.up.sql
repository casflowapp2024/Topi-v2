-- Cambiar la moneda de una cuenta con movimientos, cerrar cuentas y cambiar la moneda base del
-- usuario (plan/10-tipos-de-cuenta.md, etapa 3 = Fase 4 del plan multimoneda).
--
-- Las funciones de cambio hacen la vista previa con el mismo código que aplica: hacen los cambios
-- dentro de un bloque y, si no se aplica, lo deshacen con la excepción TP001. Así la vista previa
-- muestra exactamente lo que va a pasar.

-- ---------------------------------------------------------------- 1. cuentas cerradas
-- Una cuenta cerrada conserva su historia (sigue en reportes) pero no recibe movimientos nuevos.
ALTER TABLE accounts ADD COLUMN closed_at TIMESTAMPTZ;

-- Saldo nativo de una cuenta con todo lo registrado (inversiones: ancladas a sus valoraciones).
CREATE FUNCTION account_balance_now(p_user_id VARCHAR, p_account_id BIGINT) RETURNS NUMERIC
  LANGUAGE sql STABLE AS $$
  SELECT a.initial_balance
         + COALESCE((SELECT sum(d.inflow - d.outflow) FROM daily_account_totals d WHERE d.account_id = a.id), 0)
         + COALESCE((SELECT sum(vd.delta) FROM account_valuation_deltas(p_user_id) vd WHERE vd.account_id = a.id), 0)
  FROM accounts a
  WHERE a.id = p_account_id AND a.user_id = p_user_id
$$;

-- ---------------------------------------------------------------- 2. moneda de una cuenta
-- Cada cambio guarda el estado anterior (snapshot) para poder deshacerlo:
--   {"initial_balance": n, "transactions": [{id, amount, fx_rate, fx_rate_source, amount_base}],
--    "valuations": [{id, value}]}
CREATE TABLE account_currency_changes (
  id           BIGSERIAL PRIMARY KEY,
  user_id      VARCHAR(255) NOT NULL,
  account_id   BIGINT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  mode         VARCHAR(10) NOT NULL CHECK (mode IN ('relabel', 'convert')),
  old_currency VARCHAR(3) NOT NULL,
  new_currency VARCHAR(3) NOT NULL,
  snapshot     JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  undone_at    TIMESTAMPTZ
);
CREATE INDEX account_currency_changes_account ON account_currency_changes (account_id, created_at DESC);

-- Cambia la moneda de una cuenta (p_apply = false: solo la vista previa).
--   relabel  los montos ya estaban en la moneda nueva: se queda amount; la tasa y amount_base se
--            recalculan con la tasa de mercado de cada fecha (cambian los reportes históricos;
--            las tasas editadas a mano o de transferencias se pierden: replaced_rates).
--   convert  los montos estaban en la moneda vieja: amount = monto × tasa vieja→nueva de su fecha,
--            redondeado a los decimales de la moneda; amount_base no cambia (los reportes
--            históricos quedan iguales). También el saldo inicial (tasa del día de creación) y las
--            valoraciones. Si falta alguna tasa no se aplica (missing_rates).
-- flows_base_*: suma con signo de amount_base de la cuenta (lo que ven los reportes).
CREATE FUNCTION change_account_currency(
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

-- Deshace un cambio de moneda: solo el último de la cuenta y si después no hubo movimientos ni
-- valoraciones nuevas o editadas en ella.
CREATE FUNCTION undo_account_currency_change(p_user_id VARCHAR, p_change_id BIGINT) RETURNS VOID
  LANGUAGE plpgsql AS $$
DECLARE
  v_ch account_currency_changes%ROWTYPE;
BEGIN
  SELECT * INTO v_ch FROM account_currency_changes c
  WHERE c.id = p_change_id AND c.user_id = p_user_id AND c.undone_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'undo_account_currency_change: cambio % no encontrado', p_change_id USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM 1 FROM accounts a WHERE a.id = v_ch.account_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM account_currency_changes c
             WHERE c.account_id = v_ch.account_id AND c.undone_at IS NULL AND c.created_at > v_ch.created_at)
     OR EXISTS (SELECT 1 FROM accounts a WHERE a.id = v_ch.account_id AND a.currency <> v_ch.new_currency)
     OR EXISTS (SELECT 1 FROM transactions t WHERE t.account_id = v_ch.account_id
                AND (t.created_at > v_ch.created_at OR t.updated_at > v_ch.created_at))
     OR EXISTS (SELECT 1 FROM account_valuations v WHERE v.account_id = v_ch.account_id
                AND (v.created_at > v_ch.created_at OR v.updated_at > v_ch.created_at)) THEN
    RAISE EXCEPTION 'undo_account_currency_change: la cuenta cambió después del cambio %', p_change_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'currency_change_not_undoable';
  END IF;

  UPDATE accounts a SET currency = v_ch.old_currency, initial_balance = (v_ch.snapshot->>'initial_balance')::NUMERIC
  WHERE a.id = v_ch.account_id;
  UPDATE transactions t SET
    amount = (e->>'amount')::NUMERIC,
    fx_rate = (e->>'fx_rate')::NUMERIC,
    fx_rate_source = e->>'fx_rate_source',
    amount_base = (e->>'amount_base')::NUMERIC
  FROM jsonb_array_elements(v_ch.snapshot->'transactions') e
  WHERE t.id = (e->>'id')::BIGINT AND t.account_id = v_ch.account_id;
  UPDATE account_valuations v SET value = (e->>'value')::NUMERIC
  FROM jsonb_array_elements(v_ch.snapshot->'valuations') e
  WHERE v.id = (e->>'id')::BIGINT AND v.account_id = v_ch.account_id;
  UPDATE account_currency_changes c SET undone_at = now() WHERE c.id = p_change_id;
END
$$;

-- ---------------------------------------------------------------- 3. moneda base del usuario
-- Cambia la moneda base (p_apply = false: solo la vista previa). Todas las transacciones pasan a la
-- tasa de mercado de su fecha hacia la moneda nueva; las dos patas de cada transferencia quedan con
-- el mismo amount_base (el de la pata en la moneda base si hay una, si no el de la salida). Las
-- tasas editadas a mano se pierden (replaced_rates). net_worth_*: patrimonio de hoy en cada base.
CREATE FUNCTION change_base_currency(p_user_id VARCHAR, p_currency VARCHAR, p_apply BOOLEAN)
RETURNS TABLE (
  old_currency VARCHAR, tx_count INT, missing_rates INT, replaced_rates INT,
  net_worth_before NUMERIC, net_worth_after NUMERIC
)
  LANGUAGE plpgsql AS $$
DECLARE
  v_old VARCHAR := user_base_currency(p_user_id);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM currencies c WHERE c.code = p_currency AND c.is_active) OR p_currency = v_old THEN
    RAISE EXCEPTION 'change_base_currency: moneda inválida %', p_currency
      USING ERRCODE = 'check_violation', CONSTRAINT = 'currency_change_currency';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM user_extra u WHERE u.user_id = p_user_id) THEN
    RAISE EXCEPTION 'change_base_currency: usuario % sin user_extra', p_user_id USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('daily_account_totals:' || p_user_id));

  old_currency := v_old;
  SELECT count(*)::INT, (count(*) FILTER (WHERE t.fx_rate_source = 'user'))::INT
    INTO tx_count, replaced_rates
  FROM transactions t WHERE t.user_id = p_user_id;
  SELECT COALESCE(sum(n.base_value), 0) INTO net_worth_before FROM net_worth(p_user_id) n;

  BEGIN
    UPDATE user_extra u SET base_currency = p_currency WHERE u.user_id = p_user_id;
    UPDATE transactions t SET fx_rate = NULL WHERE t.user_id = p_user_id;

    WITH anchor AS (
      SELECT DISTINCT ON (t.transfer_group_id) t.transfer_group_id AS g, t.amount_base
      FROM transactions t
      WHERE t.user_id = p_user_id AND t.transfer_group_id IS NOT NULL
      ORDER BY t.transfer_group_id, (t.currency = p_currency) DESC, t.expense DESC, t.id
    )
    UPDATE transactions t SET
      amount_base = a.amount_base,
      fx_rate = round(a.amount_base / t.amount, 12),
      fx_rate_source = 'transfer'
    FROM anchor a
    WHERE t.transfer_group_id = a.g AND t.user_id = p_user_id AND a.amount_base IS NOT NULL AND t.amount <> 0;

    SELECT (count(*) FILTER (WHERE t.amount_base IS NULL))::INT INTO missing_rates
    FROM transactions t WHERE t.user_id = p_user_id;
    SELECT COALESCE(sum(n.base_value), 0) INTO net_worth_after FROM net_worth(p_user_id) n;

    IF NOT p_apply THEN
      RAISE EXCEPTION 'vista previa' USING ERRCODE = 'TP001';
    END IF;
  EXCEPTION WHEN SQLSTATE 'TP001' THEN
    NULL;
  END;
  RETURN NEXT;
END
$$;
