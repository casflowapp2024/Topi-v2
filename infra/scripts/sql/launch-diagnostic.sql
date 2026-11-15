-- Diagnóstico del lanzamiento (plan/27, bloque 0): de dónde se va la gente. Solo conteos: ni nombres, ni correos,
-- ni montos. Incluye las cuentas del equipo. Uso:
--   psql "$DATABASE_URL" -f infra/scripts/sql/launch-diagnostic.sql                       (al día de hoy)
--   psql "$DATABASE_URL" -v as_of="'2026-10-17'" -f infra/scripts/sql/launch-diagnostic.sql
-- as_of = fin de la ventana de 30 días (incluido). Para una copia del dump usa el día del último
-- transactions.created_at (el dump de producción del plan 27 termina el 17-oct-2026).
--
-- Estado de conexión por usuario (el mejor de sus correos):
--   sana         = alguna conexión activa sin error
--   caída        = ninguna sana y alguna con error (credenciales u otro)
--   desactivada  = todas inactivas y sin error

\if :{?as_of}
\else
  \set as_of '(now() AT TIME ZONE ''America/Bogota'')::date'
\endif

\echo '== Embudo por usuario (ventana: los 30 días que terminan en as_of)'
WITH params AS (
  SELECT (:as_of)::date AS as_of, (:as_of)::date - 29 AS since
),
conn AS (
  SELECT user_id,
         count(*)                                                         AS n,
         bool_or(active AND coalesce(error, '') = '')                     AS any_healthy,
         bool_or(coalesce(error, '') <> '')                               AS any_error
  FROM emails GROUP BY user_id
),
tx AS (
  SELECT t.user_id,
         count(*) FILTER (WHERE t.automated)                              AS auto_total,
         count(*) FILTER (WHERE NOT t.automated)                          AS manual_total,
         count(*) FILTER (WHERE t.automated
                          AND (t.created_at AT TIME ZONE 'America/Bogota')::date BETWEEN p.since AND p.as_of) AS auto_30,
         max(t.created_at) FILTER (WHERE t.automated)                     AS last_auto
  FROM transactions t CROSS JOIN params p GROUP BY t.user_id
),
act AS (
  SELECT a.user_id
  FROM user_activity_days a CROSS JOIN params p
  WHERE a.day BETWEEN p.since AND p.as_of
  GROUP BY a.user_id
),
u AS (
  SELECT us.id,
         c.n IS NOT NULL                                                  AS has_conn,
         CASE WHEN c.n IS NULL THEN 'none'
              WHEN c.any_healthy THEN 'healthy'
              WHEN c.any_error THEN 'down'
              ELSE 'disabled' END                                         AS conn_state,
         coalesce(x.auto_total, 0)                                        AS auto_total,
         coalesce(x.manual_total, 0)                                      AS manual_total,
         coalesce(x.auto_30, 0)                                           AS auto_30,
         x.last_auto,
         ac.user_id IS NOT NULL                                           AS active_30
  FROM users us
  JOIN admin_user_signup s ON s.user_id = us.id   -- registro real (los migrados tienen users.created_at = migración)
  CROSS JOIN params p
  LEFT JOIN conn c ON c.user_id = us.id
  LEFT JOIN tx x ON x.user_id = us.id
  LEFT JOIN act ac ON ac.user_id = us.id
  WHERE (s.signup_at AT TIME ZONE 'America/Bogota')::date <= p.as_of
)
SELECT metrica, usuarios FROM (
  SELECT 1 AS o, 'Registrados' AS metrica, count(*) AS usuarios FROM u
  UNION ALL SELECT 2, 'Sin ninguna conexión de correo', count(*) FILTER (WHERE NOT has_conn) FROM u
  UNION ALL SELECT 3, '  de ellos registran a mano', count(*) FILTER (WHERE NOT has_conn AND manual_total > 0) FROM u
  UNION ALL SELECT 4, 'Con conexión', count(*) FILTER (WHERE has_conn) FROM u
  UNION ALL SELECT 5, '  conexión sana', count(*) FILTER (WHERE conn_state = 'healthy') FROM u
  UNION ALL SELECT 6, '  conexión caída', count(*) FILTER (WHERE conn_state = 'down') FROM u
  UNION ALL SELECT 7, '  conexión desactivada sin error', count(*) FILTER (WHERE conn_state = 'disabled') FROM u
  UNION ALL SELECT 8, '    de ellos leían antes', count(*) FILTER (WHERE conn_state = 'disabled' AND auto_total > 0) FROM u
  UNION ALL SELECT 9, 'A. Se fueron por conexión caída (leía antes, 0 lecturas en 30 d)',
                   count(*) FILTER (WHERE conn_state = 'down' AND auto_total > 0 AND auto_30 = 0) FROM u
  UNION ALL SELECT 10, 'B. Conexión pero 0 transacciones leídas en toda su historia',
                   count(*) FILTER (WHERE has_conn AND auto_total = 0) FROM u
  UNION ALL SELECT 11, '  de ellos con la conexión sana', count(*) FILTER (WHERE conn_state = 'healthy' AND auto_total = 0) FROM u
  UNION ALL SELECT 12, 'C. Reciben lectura (>= 1 automática en 30 d) pero no abrieron la app en 30 d',
                   count(*) FILTER (WHERE auto_30 > 0 AND NOT active_30) FROM u
  UNION ALL SELECT 13, 'Al día en 30 d (lectura + app abierta)', count(*) FILTER (WHERE auto_30 > 0 AND active_30) FROM u
  UNION ALL SELECT 14, 'Activos en la app en 30 d (cualquier uso)', count(*) FILTER (WHERE active_30) FROM u
) m ORDER BY o;

\echo '== Conexiones por proveedor (conteo de conexiones, no de usuarios)'
SELECT provider, count(*) AS conexiones,
       count(*) FILTER (WHERE active AND coalesce(error, '') = '') AS sanas,
       count(*) FILTER (WHERE coalesce(error, '') <> '')           AS con_error,
       count(*) FILTER (WHERE NOT active AND coalesce(error, '') = '') AS desactivadas
FROM emails GROUP BY provider ORDER BY provider;

\echo '== Desactivadas que leían antes: mediana de días desde la última lectura hasta as_of'
WITH last_read AS (
  SELECT e.user_id, max(t.created_at) AS last_auto
  FROM emails e JOIN transactions t ON t.user_id = e.user_id AND t.automated
  GROUP BY e.user_id
  HAVING bool_and(NOT e.active AND coalesce(e.error, '') = '')
)
SELECT count(*) AS usuarios,
       round(percentile_cont(0.5) WITHIN GROUP (
         ORDER BY (:as_of)::date - (last_auto AT TIME ZONE 'America/Bogota')::date)::numeric, 1) AS mediana_dias
FROM last_read;

\echo '== Transacciones automáticas / total'
SELECT count(*) FILTER (WHERE automated) AS automaticas, count(*) AS total,
       round(100.0 * count(*) FILTER (WHERE automated) / nullif(count(*), 0), 1) AS pct_automaticas
FROM transactions
WHERE (created_at AT TIME ZONE 'America/Bogota')::date <= (:as_of)::date;
