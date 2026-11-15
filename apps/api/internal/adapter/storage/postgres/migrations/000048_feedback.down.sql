DELETE FROM product_events WHERE name = 'feedback_sent';
ALTER TABLE product_events DROP CONSTRAINT product_events_name_check;
ALTER TABLE product_events ADD CONSTRAINT product_events_name_check CHECK (name IN (
  'tx_category_corrected', 'tx_amount_corrected', 'review_resolved', 'budget_created',
  'insight_dismissed', 'insight_feedback', 'ask_topi_asked',
  'support_started', 'support_approved',
  'connection_reconnected',
  'onboarding_step_completed', 'bank_sample_requested'
));

DROP TABLE IF EXISTS feedback;
