-- "¿Qué le falta a Topi?" (plan/27 §E). El texto lo escribe el usuario (se le pide no poner datos bancarios);
-- solo lo ve el panel admin, con cada acceso auditado. Nunca va al outbox ni a los logs.
CREATE TABLE feedback (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  text VARCHAR(500) NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 500),
  contact_ok BOOLEAN NOT NULL DEFAULT false,
  app_version VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX feedback_user_created ON feedback (user_id, created_at DESC);
CREATE INDEX feedback_unread ON feedback (created_at DESC) WHERE read_at IS NULL;

ALTER TABLE product_events DROP CONSTRAINT product_events_name_check;
ALTER TABLE product_events ADD CONSTRAINT product_events_name_check CHECK (name IN (
  'tx_category_corrected', 'tx_amount_corrected', 'review_resolved', 'budget_created',
  'insight_dismissed', 'insight_feedback', 'ask_topi_asked',
  'support_started', 'support_approved',
  'connection_reconnected',
  'onboarding_step_completed', 'bank_sample_requested',
  'feedback_sent'
));
