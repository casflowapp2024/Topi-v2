ALTER TABLE email_sync_state
  DROP COLUMN IF EXISTS first_read_at,
  DROP COLUMN IF EXISTS first_found;
