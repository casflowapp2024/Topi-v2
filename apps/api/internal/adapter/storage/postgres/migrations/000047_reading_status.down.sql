DROP INDEX IF EXISTS product_events_onboarding_step;

DELETE FROM product_events WHERE name IN ('onboarding_step_completed', 'bank_sample_requested');
ALTER TABLE product_events DROP CONSTRAINT product_events_name_check;
ALTER TABLE product_events ADD CONSTRAINT product_events_name_check CHECK (name IN (
  'tx_category_corrected', 'tx_amount_corrected', 'review_resolved', 'budget_created',
  'insight_dismissed', 'insight_feedback', 'ask_topi_asked',
  'support_started', 'support_approved',
  'connection_reconnected'
));

ALTER TABLE emails DROP COLUMN IF EXISTS unsupported_alert_at;
