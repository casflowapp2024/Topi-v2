-- Eventos de producto y uso de modelos (plan/25-admin-metricas.md).

-- Lista cerrada de nombres (también en domain.ProductEvent*). props sin montos, comercios ni texto libre:
-- solo ids y enums cortos (p. ej. {"bank_id": 3}, {"kind": "installments"}). Retención 13 meses (cleanup del worker).
CREATE TABLE product_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(40) NOT NULL CHECK (name IN (
    'tx_category_corrected', 'tx_amount_corrected', 'review_resolved', 'budget_created',
    'insight_dismissed', 'insight_feedback', 'ask_topi_asked'
  )),
  props JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(props) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_events_name_created ON product_events (name, created_at);
CREATE INDEX product_events_created ON product_events (created_at);

-- Tokens del modelo por llamada, sin contenido. email_parse lo escribe el worker; ask, la API (Fase 4).
-- El costo se calcula al consultar con LLM_PRICE_*_USD_PER_MTOK.
CREATE TABLE llm_usage (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  feature VARCHAR(20) NOT NULL CHECK (feature IN ('email_parse', 'ask')),
  model VARCHAR(60) NOT NULL,
  tokens_in INT NOT NULL DEFAULT 0 CHECK (tokens_in >= 0),
  tokens_out INT NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX llm_usage_created ON llm_usage (created_at);
