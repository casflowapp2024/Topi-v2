ALTER TABLE emails DROP COLUMN IF EXISTS alert_sent_at;
DROP TABLE IF EXISTS notification_prefs;
ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at, DROP COLUMN IF EXISTS email_status;
DROP TABLE IF EXISTS auth_codes;
DROP TABLE IF EXISTS email_outbox;
