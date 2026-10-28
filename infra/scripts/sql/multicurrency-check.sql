-- Chequeo después de la migración 000024 (multimoneda, Fase 2). Solo lee; no muestra datos de usuarios.
--
--   docker exec -i <contenedor-postgres> psql -U topi -d cashflow -f - < infra/scripts/sql/multicurrency-check.sql
--
-- Todo en 0 salvo las filas informativas (transacciones, filas de totales, candidatos de transferencia).
-- La comparación completa de reportes ANTES/DESPUÉS es TestReportSnapshot
-- (apps/api/internal/adapter/storage/postgres/repository/report_snapshot_integration_test.go).

\echo '== versión de migraciones (esperado 24, dirty = f)'
SELECT version, dirty FROM schema_migrations;

\echo '== transacciones (informativo) y problemas (todo en 0)'
SELECT
  (SELECT count(*) FROM transactions)                                                  AS transacciones,
  (SELECT count(*) FROM transactions WHERE currency IS NULL)                           AS sin_moneda,
  (SELECT count(*) FROM transactions t JOIN accounts a ON a.id = t.account_id
    WHERE t.currency <> a.currency)                                                    AS moneda_distinta_a_la_cuenta,
  (SELECT count(*) FROM transactions WHERE amount_base IS NULL)                        AS esperando_tasa,
  (SELECT count(*) FROM transactions
    WHERE fx_rate_source = 'migration' AND (fx_rate <> 1 OR amount_base <> amount))    AS migracion_con_base_distinta;

\echo '== totales diarios contra transactions (esperado 0 usuarios con diferencias)'
SELECT (SELECT count(*) FROM daily_account_totals)        AS filas_totales,
       (SELECT count(*) FROM daily_account_totals_drift()) AS usuarios_con_diferencias;

\echo '== saldo nativo por cuenta: transactions vs totales diarios (esperado 0)'
SELECT count(*) AS cuentas, count(*) FILTER (WHERE coalesce(t.s, 0) <> coalesce(d.s, 0)) AS saldos_distintos
FROM accounts a
LEFT JOIN (SELECT account_id, sum(CASE WHEN expense THEN -amount ELSE amount END) AS s
           FROM transactions GROUP BY 1) t ON t.account_id = a.id
LEFT JOIN (SELECT account_id, sum(inflow - outflow) AS s
           FROM daily_account_totals GROUP BY 1) d ON d.account_id = a.id;

\echo '== vistas materializadas que deben haber desaparecido (esperado solo category_predictions)'
SELECT matviewname FROM pg_matviews WHERE schemaname = 'public' ORDER BY 1;

\echo '== candidatos a transferencia por revisar (informativo; no se ligan solos)'
SELECT count(*) AS parejas, count(DISTINCT out_transaction_id) AS salidas, count(DISTINCT user_id) AS usuarios
FROM transfer_link_candidates;
