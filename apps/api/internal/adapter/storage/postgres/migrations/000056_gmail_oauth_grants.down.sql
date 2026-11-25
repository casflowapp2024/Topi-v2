DROP TRIGGER IF EXISTS emails_gmail_oauth_grant ON emails;
DROP FUNCTION IF EXISTS gmail_oauth_grant_record();
DROP FUNCTION IF EXISTS gmail_oauth_grant_hash(TEXT);
DROP TABLE IF EXISTS gmail_oauth_grants;
