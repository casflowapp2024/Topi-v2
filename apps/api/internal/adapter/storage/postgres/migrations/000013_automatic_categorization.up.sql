-- Add raw_description column to transaction table
-- This column stores the original description from email transactions
-- and cannot be updated by users (only inserted by AdminCreateTransactions)
ALTER TABLE TRANSACTIONS ADD COLUMN RAW_DESCRIPTION VARCHAR(255);

-- Update RAW_DESCRIPTION with existing DESCRIPTION values for existing records
UPDATE TRANSACTIONS SET RAW_DESCRIPTION = DESCRIPTION WHERE USER_ID != '';

-- Create an index on raw_description for better query performance
CREATE INDEX IDX_TRANSACTIONS_RAW_DESCRIPTION ON TRANSACTIONS (USER_ID, RAW_DESCRIPTION);

-- Create a materialized view for transaction categorization analysis
-- This view groups transactions by raw_description and category_id
-- and calculates frequency and relative frequency for automatic categorization
CREATE MATERIALIZED VIEW CATEGORY_PREDICTIONS AS
SELECT
    T.USER_ID,
    T.RAW_DESCRIPTION,
    T.CATEGORY_ID,
    C.NAME AS CATEGORY_NAME,
    COUNT(*) AS FREQUENCY,
    ROUND(
        (COUNT(*) * 100.0) / SUM(COUNT(*)) OVER (PARTITION BY T.USER_ID, T.RAW_DESCRIPTION),
        2
    ) AS RELATIVE_FREQUENCY_PERCENT,
    CURRENT_TIMESTAMP     AS UPDATED_AT
FROM TRANSACTIONS T
LEFT JOIN CATEGORIES C ON C.ID = T.CATEGORY_ID AND C.USER_ID = T.USER_ID
WHERE T.RAW_DESCRIPTION IS NOT NULL AND T.RAW_DESCRIPTION != ''
GROUP BY T.USER_ID, T.RAW_DESCRIPTION, T.CATEGORY_ID, C.NAME
HAVING COUNT(*) > 1
ORDER BY T.USER_ID, T.RAW_DESCRIPTION, FREQUENCY DESC;

-- Create a unique index on materialized view for concurrent refresh capability
CREATE UNIQUE INDEX IDX_CATEGORY_PREDICTIONS_UNIQUE
ON CATEGORY_PREDICTIONS (user_id, raw_description, category_id);

SELECT cron.schedule('category_predictions', '0 0 */2 * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY CATEGORY_PREDICTIONS');