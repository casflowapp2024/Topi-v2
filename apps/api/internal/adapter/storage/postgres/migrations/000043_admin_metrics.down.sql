DROP FUNCTION IF EXISTS refresh_admin_metrics(DATE);
DROP MATERIALIZED VIEW IF EXISTS admin_user_cohort;
DROP MATERIALIZED VIEW IF EXISTS admin_user_stats;
DROP VIEW IF EXISTS admin_user_signup;
DROP TABLE IF EXISTS metrics_daily;
