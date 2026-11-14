-- Pagos (plan/22-modelo-negocio.md, N1 "Apoyar a Topi"). Nunca datos de tarjeta: solo la referencia de la
-- pasarela. El estado lo escribe el webhook (firma verificada) o la consulta del servidor a la pasarela; el front
-- nunca marca un pago. id = external_reference en la pasarela.
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('mercadopago')),
  -- id del pago en la pasarela (NULL hasta que el comprador paga)
  provider_ref VARCHAR(64),
  -- preferencia de checkout (Mercado Pago)
  checkout_ref VARCHAR(100),
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('support', 'subscription')),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  -- estado y detalle tal como los da la pasarela (p. ej. "approved/accredited")
  raw_status VARCHAR(80),
  approved_at TIMESTAMPTZ,
  receipt_enqueued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payments_provider_ref ON payments (provider, provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX payments_user ON payments (user_id, created_at DESC);
CREATE INDEX payments_status_created ON payments (status, created_at);

-- Eventos de producto del aporte (sin montos: solo que empezó y que se aprobó)
ALTER TABLE product_events DROP CONSTRAINT product_events_name_check;
ALTER TABLE product_events ADD CONSTRAINT product_events_name_check CHECK (name IN (
  'tx_category_corrected', 'tx_amount_corrected', 'review_resolved', 'budget_created',
  'insight_dismissed', 'insight_feedback', 'ask_topi_asked',
  'support_started', 'support_approved'
));
