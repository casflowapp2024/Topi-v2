DROP INDEX IF EXISTS transactions_source_message;
ALTER TABLE transactions DROP COLUMN IF EXISTS source_message_id;
DROP TABLE IF EXISTS processed_emails;
DROP TABLE IF EXISTS email_sync_state;
DROP INDEX IF EXISTS email_jobs_active_dedupe;
ALTER TABLE email_jobs DROP COLUMN IF EXISTS locked_by;
ALTER TABLE email_jobs DROP COLUMN IF EXISTS locked_at;
ALTER TABLE email_jobs DROP COLUMN IF EXISTS dedupe_key;
