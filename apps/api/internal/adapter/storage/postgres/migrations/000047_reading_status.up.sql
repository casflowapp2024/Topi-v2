-- Bienvenida y banco no soportado (plan/27 §B y §C)

-- cuándo se avisó por correo que una conexión sana no trae movimientos (una vez por conexión)
ALTER TABLE emails ADD COLUMN unsupported_alert_at TIMESTAMPTZ;

ALTER TABLE product_events DROP CONSTRAINT product_events_name_check;
ALTER TABLE product_events ADD CONSTRAINT product_events_name_check CHECK (name IN (
  'tx_category_corrected', 'tx_amount_corrected', 'review_resolved', 'budget_created',
  'insight_dismissed', 'insight_feedback', 'ask_topi_asked',
  'support_started', 'support_approved',
  'connection_reconnected',
  'onboarding_step_completed', 'bank_sample_requested'
));

-- cada paso de la bienvenida cuenta una sola vez por usuario
CREATE UNIQUE INDEX product_events_onboarding_step ON product_events (user_id, (props ->> 'step'))
  WHERE name = 'onboarding_step_completed';
