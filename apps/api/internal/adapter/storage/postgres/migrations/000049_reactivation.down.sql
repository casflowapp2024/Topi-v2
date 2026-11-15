DROP INDEX IF EXISTS email_outbox_reactivation;
ALTER TABLE notification_prefs DROP COLUMN IF EXISTS email_personal;
