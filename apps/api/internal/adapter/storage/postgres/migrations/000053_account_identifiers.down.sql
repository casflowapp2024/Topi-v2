DELETE FROM product_events WHERE name = 'account_identifier_learned';
ALTER TABLE product_events DROP CONSTRAINT product_events_name_check;
ALTER TABLE product_events ADD CONSTRAINT product_events_name_check CHECK (name IN (
  'tx_category_corrected', 'tx_amount_corrected', 'review_resolved', 'budget_created',
  'insight_dismissed', 'insight_feedback', 'ask_topi_asked',
  'support_started', 'support_approved',
  'connection_reconnected',
  'onboarding_step_completed', 'bank_sample_requested',
  'feedback_sent'
));

ALTER TABLE transactions DROP COLUMN source_account_hint;

DROP TRIGGER account_identifiers_sync ON accounts;
DROP FUNCTION account_identifiers_sync();

-- las cuentas sin dígitos toman su primer identificador; si quedan repetidas o vacías, un número propio por id
-- para que vuelva la restricción única (no se borra ninguna cuenta)
UPDATE accounts a SET last_four_digits = i.digits
FROM (SELECT DISTINCT ON (account_id) account_id, digits FROM account_identifiers ORDER BY account_id, id) i
WHERE a.id = i.account_id AND a.last_four_digits = '';
UPDATE accounts a SET last_four_digits = lpad((a.id % 10000)::text, 4, '0')
WHERE a.last_four_digits = ''
   OR EXISTS (SELECT 1 FROM accounts o WHERE o.user_id = a.user_id AND o.bank_id = a.bank_id
              AND o.last_four_digits = a.last_four_digits AND o.id < a.id);

ALTER TABLE accounts DROP CONSTRAINT accounts_last_four_digits_check;
ALTER TABLE accounts ALTER COLUMN last_four_digits DROP DEFAULT;
ALTER TABLE accounts ADD CONSTRAINT unique_user_account UNIQUE (user_id, bank_id, last_four_digits);

DROP TABLE account_identifiers;
