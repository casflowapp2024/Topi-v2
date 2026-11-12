-- Precálculo del panel admin (plan/25-admin-metricas.md). El panel nunca barre las tablas grandes en cada carga:
--   - metrics_daily: una cifra por día (America/Bogota) y clave; refresh_admin_metrics(desde) recalcula desde ese
--     día hasta hoy (el worker lo llama cada noche con los últimos 7 días). Los días viejos quedan guardados aunque
--     la limpieza borre processed_emails.
--   - admin_user_stats y admin_user_cohort: vistas materializadas por usuario (sin montos), refrescadas en la misma
--     función.
-- "Automática" = transactions.automated (la crea el lector de correos). "Al día" en una ventana de 7 días = al menos
-- una transacción automática creada y al menos un día de actividad (user_activity_days) en esa ventana.

CREATE TABLE metrics_daily (
  day DATE NOT NULL,
  key VARCHAR(40) NOT NULL,
  value NUMERIC NOT NULL,
  PRIMARY KEY (day, key)
);
CREATE INDEX metrics_daily_key_day ON metrics_daily (key, day);

-- Fecha de registro: la menor entre users y user_extra (los migrados tienen users.created_at = día de la migración).
CREATE VIEW admin_user_signup AS
SELECT u.id AS user_id,
       LEAST(u.created_at, COALESCE((SELECT min(ue.created_at) FROM user_extra ue WHERE ue.user_id = u.id), u.created_at)) AS signup_at
FROM users u;

-- Por usuario: hitos de activación y conteos de 30 días. Sin montos ni descripciones.
CREATE MATERIALIZED VIEW admin_user_stats AS
SELECT s.user_id,
       s.signup_at,
       (SELECT min(e.created_at) FROM emails e WHERE e.user_id = s.user_id) AS first_connection_at,
       (SELECT min(t.created_at) FROM transactions t WHERE t.user_id = s.user_id AND t.automated) AS first_auto_tx_at,
       LEAST(
         (SELECT min(pe.created_at) FROM product_events pe WHERE pe.user_id = s.user_id AND pe.name = 'budget_created'),
         (SELECT min(c.updated_at) FROM categories c WHERE c.user_id = s.user_id AND c.budget > 0)
       ) AS first_budget_at,
       (SELECT max(pe.created_at) FROM processed_emails pe WHERE pe.user_id = s.user_id) AS last_email_read_at,
       (SELECT count(*) FROM transactions t WHERE t.user_id = s.user_id AND t.automated
          AND t.created_at >= now() - interval '30 days') AS auto_tx_30d,
       (SELECT count(*) FROM transactions t WHERE t.user_id = s.user_id AND NOT t.automated
          AND t.created_at >= now() - interval '30 days') AS manual_tx_30d,
       now() AS computed_at
FROM admin_user_signup s;
CREATE UNIQUE INDEX admin_user_stats_user ON admin_user_stats (user_id);

-- Retención: ¿el usuario estuvo al día en su semana 1, 4 y 12 después del registro? La semana k es la ventana
-- [registro + 7k, registro + 7k + 6] (días de Bogotá). NULL = esa semana todavía no termina.
CREATE MATERIALIZED VIEW admin_user_cohort AS
WITH base AS (
  SELECT s.user_id,
         (s.signup_at AT TIME ZONE 'America/Bogota')::date AS signup_day,
         (now() AT TIME ZONE 'America/Bogota')::date AS today
  FROM admin_user_signup s
),
windows AS (
  SELECT b.user_id, b.signup_day, k, b.signup_day + 7 * k AS w_from, b.signup_day + 7 * k + 6 AS w_to, b.today
  FROM base b CROSS JOIN (VALUES (1), (4), (12)) AS ks(k)
),
status AS (
  SELECT w.user_id, w.signup_day, w.k,
         CASE WHEN w.w_to >= w.today THEN NULL
              ELSE EXISTS (SELECT 1 FROM user_activity_days a
                           WHERE a.user_id = w.user_id AND a.day BETWEEN w.w_from AND w.w_to)
               AND EXISTS (SELECT 1 FROM transactions t
                           WHERE t.user_id = w.user_id AND t.automated
                             AND t.created_at >= w.w_from::timestamp AT TIME ZONE 'America/Bogota'
                             AND t.created_at < (w.w_to + 1)::timestamp AT TIME ZONE 'America/Bogota')
         END AS al_dia
  FROM windows w
)
SELECT user_id,
       signup_day,
       date_trunc('week', signup_day)::date AS cohort_week,
       bool_or(al_dia) FILTER (WHERE k = 1) AS w1,
       bool_or(al_dia) FILTER (WHERE k = 4) AS w4,
       bool_or(al_dia) FILTER (WHERE k = 12) AS w12
FROM status
GROUP BY user_id, signup_day;
CREATE UNIQUE INDEX admin_user_cohort_user ON admin_user_cohort (user_id);

-- Recalcula metrics_daily desde p_from (NULL = toda la historia) hasta hoy y refresca las vistas.
-- Devuelve cuántas filas escribió.
CREATE OR REPLACE FUNCTION refresh_admin_metrics(p_from DATE DEFAULT NULL) RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  tz CONSTANT TEXT := 'America/Bogota';
  v_to DATE := (now() AT TIME ZONE tz)::date;
  v_from DATE;
  v_from_ts TIMESTAMPTZ;
  v_rows INTEGER;
BEGIN
  v_from := COALESCE(p_from, (SELECT (min(signup_at) AT TIME ZONE tz)::date FROM admin_user_signup), v_to);
  IF v_from > v_to THEN
    v_from := v_to;
  END IF;
  v_from_ts := v_from::timestamp AT TIME ZONE tz;

  DELETE FROM metrics_daily WHERE day BETWEEN v_from AND v_to;

  -- conteos por día de hechos con fecha
  INSERT INTO metrics_daily (day, key, value)
  SELECT d, k, v FROM (
    SELECT (s.signup_at AT TIME ZONE tz)::date AS d, 'signups' AS k, count(*) AS v
      FROM admin_user_signup s WHERE s.signup_at >= v_from_ts GROUP BY 1
    UNION ALL
    SELECT a.day, 'dau', count(*) FROM user_activity_days a WHERE a.day >= v_from GROUP BY 1
    UNION ALL
    SELECT (p.created_at AT TIME ZONE tz)::date, 'emails_processed', count(*)
      FROM processed_emails p WHERE p.created_at >= v_from_ts GROUP BY 1
    UNION ALL
    SELECT (p.created_at AT TIME ZONE tz)::date, 'emails_' || p.status, count(*)
      FROM processed_emails p WHERE p.created_at >= v_from_ts AND p.status IN ('transaction', 'no_transaction', 'error')
      GROUP BY 1, 2
    UNION ALL
    SELECT (t.created_at AT TIME ZONE tz)::date, CASE WHEN t.automated THEN 'tx_auto' ELSE 'tx_manual' END, count(*)
      FROM transactions t WHERE t.created_at >= v_from_ts GROUP BY 1, 2
    UNION ALL
    -- llegó para verificar: sigue marcada o ya se resolvió (evento review_resolved verify de esa transacción)
    SELECT (t.created_at AT TIME ZONE tz)::date, 'tx_auto_should_verify', count(*)
      FROM transactions t
      WHERE t.automated AND t.created_at >= v_from_ts
        AND (t.should_verify OR EXISTS (
          SELECT 1 FROM product_events pe
          WHERE pe.name = 'review_resolved' AND pe.user_id = t.user_id AND pe.props->>'kind' = 'verify'
            AND (pe.props->>'transaction_id')::bigint = t.id))
      GROUP BY 1
    UNION ALL
    SELECT (pe.created_at AT TIME ZONE tz)::date,
           CASE pe.name WHEN 'tx_category_corrected' THEN 'corrections_category'
                        WHEN 'tx_amount_corrected' THEN 'corrections_amount'
                        WHEN 'review_resolved' THEN 'review_resolved'
                        WHEN 'budget_created' THEN 'budgets_created' END,
           count(*)
      FROM product_events pe
      WHERE pe.created_at >= v_from_ts
        AND pe.name IN ('tx_category_corrected', 'tx_amount_corrected', 'review_resolved', 'budget_created')
      GROUP BY 1, 2
    UNION ALL
    SELECT (l.created_at AT TIME ZONE tz)::date, x.k, sum(x.v)
      FROM llm_usage l
      CROSS JOIN LATERAL (VALUES ('llm_calls', 1::numeric), ('llm_tokens_in', l.tokens_in::numeric),
                                 ('llm_tokens_out', l.tokens_out::numeric)) AS x(k, v)
      WHERE l.created_at >= v_from_ts
      GROUP BY 1, 2
    UNION ALL
    SELECT (o.sent_at AT TIME ZONE tz)::date, 'mails_sent', count(*)
      FROM email_outbox o WHERE o.status = 'sent' AND o.sent_at >= v_from_ts GROUP BY 1
  ) facts
  WHERE d BETWEEN v_from AND v_to;

  -- ventanas móviles: un valor por cada día del rango
  WITH days AS (
    SELECT g::date AS d FROM generate_series(v_from, v_to, interval '1 day') g
  ),
  auto_days AS (
    SELECT DISTINCT t.user_id, (t.created_at AT TIME ZONE tz)::date AS day
    FROM transactions t
    WHERE t.automated AND t.created_at >= v_from_ts - interval '30 days'
  ),
  act AS (
    SELECT a.user_id, a.day FROM user_activity_days a WHERE a.day >= v_from - 30
  )
  INSERT INTO metrics_daily (day, key, value)
  SELECT days.d, 'wau', (SELECT count(DISTINCT a.user_id) FROM act a WHERE a.day BETWEEN days.d - 6 AND days.d) FROM days
  UNION ALL
  SELECT days.d, 'mau', (SELECT count(DISTINCT a.user_id) FROM act a WHERE a.day BETWEEN days.d - 29 AND days.d) FROM days
  UNION ALL
  SELECT days.d, 'north_star_7d', (
    SELECT count(DISTINCT a.user_id) FROM act a
    WHERE a.day BETWEEN days.d - 6 AND days.d
      AND EXISTS (SELECT 1 FROM auto_days x WHERE x.user_id = a.user_id AND x.day BETWEEN days.d - 6 AND days.d)
  ) FROM days
  UNION ALL
  SELECT days.d, 'auto_users_7d', (
    SELECT count(DISTINCT x.user_id) FROM auto_days x WHERE x.day BETWEEN days.d - 6 AND days.d
  ) FROM days;

  SELECT count(*) INTO v_rows FROM metrics_daily WHERE day BETWEEN v_from AND v_to;

  REFRESH MATERIALIZED VIEW admin_user_stats;
  REFRESH MATERIALIZED VIEW admin_user_cohort;

  RETURN v_rows;
END;
$$;

SELECT refresh_admin_metrics(NULL);
