DELETE FROM product_events WHERE name IN ('support_started', 'support_approved');
ALTER TABLE product_events DROP CONSTRAINT product_events_name_check;
ALTER TABLE product_events ADD CONSTRAINT product_events_name_check CHECK (name IN (
  'tx_category_corrected', 'tx_amount_corrected', 'review_resolved', 'budget_created',
  'insight_dismissed', 'insight_feedback', 'ask_topi_asked'
));

DROP TABLE IF EXISTS payments;
