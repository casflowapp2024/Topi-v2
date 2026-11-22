DROP FUNCTION IF EXISTS bank_effective_senders(BIGINT, TEXT);
DROP FUNCTION IF EXISTS normalize_bank_name(TEXT);
DROP INDEX IF EXISTS banks_catalog_id;
ALTER TABLE banks DROP COLUMN IF EXISTS catalog_id;
DROP TABLE IF EXISTS bank_logos;
DROP TABLE IF EXISTS bank_catalog_senders;
DROP TABLE IF EXISTS bank_catalog;
