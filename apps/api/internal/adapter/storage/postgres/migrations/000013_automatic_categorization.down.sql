-- Reverse the automatic categorization migration

-- Unschedule *
SELECT cron.unschedule('category_predictions');

-- Drop the unique index on the materialized view *
DROP INDEX IF EXISTS IDX_CATEGORY_PREDICTIONS_UNIQUE;

-- Drop the index on raw_description
DROP INDEX IF EXISTS IDX_TRANSACTIONS_RAW_DESCRIPTION;

-- Drop the materialized view for transaction categorization analysis *
DROP MATERIALIZED VIEW IF EXISTS CATEGORY_PREDICTIONS;

-- Remove the raw_description column from the transaction table
ALTER TABLE TRANSACTIONS DROP COLUMN IF EXISTS RAW_DESCRIPTION;
