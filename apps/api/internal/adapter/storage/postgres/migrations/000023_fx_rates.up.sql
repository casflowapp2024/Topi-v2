-- Multimoneda (Fase 1): tasas de cambio con pivote USD (1 USD = rate QUOTE) por día y fuente.
-- Las llena el worker (worker/fx.py): 'SFC_TRM' (TRM de la Superfinanciera, USD→COP) y 'ECB'
-- (Frankfurter, el resto). 'manual' es una tasa cargada a mano y gana sobre las demás.
CREATE TABLE fx_rates (
  base       VARCHAR(3) NOT NULL DEFAULT 'USD' CHECK (base = 'USD'),
  quote      VARCHAR(3) NOT NULL REFERENCES currencies (code) CHECK (quote <> 'USD'),
  rate_date  DATE NOT NULL,
  rate       NUMERIC(24, 10) NOT NULL CHECK (rate > 0),
  source     VARCHAR(32) NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (base, quote, rate_date, source)
);

-- Menor = más prioritaria.
CREATE FUNCTION fx_source_priority(p_source TEXT) RETURNS INT
  LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_source WHEN 'manual' THEN 0 WHEN 'SFC_TRM' THEN 1 ELSE 2 END
$$;

-- 1 USD = ? p_quote en p_date. Sin tasa ese día (festivo, fin de semana) usa la última con
-- rate_date <= p_date; entre fuentes del mismo día decide fx_source_priority. NULL si no hay ninguna.
CREATE FUNCTION fx_usd_rate_at(p_quote TEXT, p_date DATE) RETURNS NUMERIC
  LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN upper(p_quote) = 'USD' THEN 1::NUMERIC ELSE (
    SELECT r.rate
    FROM fx_rates r
    WHERE r.base = 'USD' AND r.quote = upper(p_quote) AND r.rate_date <= p_date
    ORDER BY r.rate_date DESC, fx_source_priority(r.source), r.source
    LIMIT 1
  ) END
$$;

-- 1 p_from = ? p_to en p_date, cruzando vía USD. 12 decimales; NULL si falta alguna de las dos patas.
CREATE FUNCTION fx_rate_at(p_from TEXT, p_to TEXT, p_date DATE) RETURNS NUMERIC
  LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN upper(p_from) = upper(p_to) THEN 1::NUMERIC
              ELSE round(fx_usd_rate_at(p_to, p_date) / fx_usd_rate_at(p_from, p_date), 12) END
$$;
