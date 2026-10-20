-- Unschedule the job that populates the balance_history table
SELECT cron.unschedule('historic_cumulative_balance');

-- Drop the balance_history table
DROP INDEX IF EXISTS IDX_HISTORIC_BALANCE;

DROP MATERIALIZED VIEW IF EXISTS HISTORIC_CUMULATIVE_BALANCE CASCADE;