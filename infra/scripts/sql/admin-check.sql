-- Verificación manual del panel admin (plan/25): North Star y cohortes calculadas directo de las tablas base,
-- sin metrics_daily ni las vistas admin_*. Debe cuadrar con GET /admin/metrics/summary y /cohorts.
-- Solo agregados (conteos). Uso:
--   psql "$DATABASE_URL" -v as_of="'2026-10-16'" -f infra/scripts/sql/admin-check.sql
-- as_of = el día "al" que se mide la North Star (por defecto, hoy en Bogotá).

\if :{?as_of}
\else
  \set as_of '(now() AT TIME ZONE ''America/Bogota'')::date'
\endif

\echo '== North Star: usuarios con >= 1 transacción automática y >= 1 día de actividad en los 7 días al as_of (12 puntos, cada 7 días)'
WITH points AS (
  SELECT (:as_of)::date - 7 * w AS d FROM generate_series(0, 11) AS w
),
auto_tx AS (   -- día de Bogotá de cada transacción automática
  SELECT t.user_id, (t.created_at AT TIME ZONE 'America/Bogota')::date AS day
  FROM transactions t WHERE t.automated
)
SELECT p.d AS dia,
       (SELECT count(*) FROM (
          SELECT a.user_id FROM user_activity_days a WHERE a.day BETWEEN p.d - 6 AND p.d
          INTERSECT
          SELECT x.user_id FROM auto_tx x WHERE x.day BETWEEN p.d - 6 AND p.d
       ) al_dia) AS north_star_manual
FROM points p
ORDER BY p.d;

\echo '== Cohortes: % al día en la semana 1, 4 y 12 después del registro (semana k = [registro + 7k, registro + 7k + 6])'
WITH signup AS (
  SELECT u.id AS user_id,
         (LEAST(u.created_at, COALESCE(min(ue.created_at), u.created_at)) AT TIME ZONE 'America/Bogota')::date AS day
  FROM users u LEFT JOIN user_extra ue ON ue.user_id = u.id
  GROUP BY u.id, u.created_at
),
weeks AS (
  SELECT s.user_id, date_trunc('week', s.day)::date AS cohort_week, k,
         s.day + 7 * k AS w_from, s.day + 7 * k + 6 AS w_to
  FROM signup s CROSS JOIN (VALUES (1), (4), (12)) AS ks(k)
),
act AS (
  SELECT w.user_id, w.k, count(a.day) > 0 AS opened
  FROM weeks w LEFT JOIN user_activity_days a ON a.user_id = w.user_id AND a.day BETWEEN w.w_from AND w.w_to
  GROUP BY w.user_id, w.k
),
reads AS (
  SELECT w.user_id, w.k, count(t.id) > 0 AS read_auto
  FROM weeks w LEFT JOIN transactions t ON t.user_id = w.user_id AND t.automated
    AND (t.created_at AT TIME ZONE 'America/Bogota')::date BETWEEN w.w_from AND w.w_to
  GROUP BY w.user_id, w.k
),
status AS (
  SELECT w.cohort_week, w.k,
         w.w_to < (now() AT TIME ZONE 'America/Bogota')::date AS ended,
         a.opened AND r.read_auto AS al_dia
  FROM weeks w JOIN act a USING (user_id, k) JOIN reads r USING (user_id, k)
)
SELECT cohort_week AS semana,
       count(*) FILTER (WHERE k = 1) AS usuarios,
       count(*) FILTER (WHERE k = 1 AND ended) AS s1_elegibles, count(*) FILTER (WHERE k = 1 AND ended AND al_dia) AS s1,
       count(*) FILTER (WHERE k = 4 AND ended) AS s4_elegibles, count(*) FILTER (WHERE k = 4 AND ended AND al_dia) AS s4,
       count(*) FILTER (WHERE k = 12 AND ended) AS s12_elegibles, count(*) FILTER (WHERE k = 12 AND ended AND al_dia) AS s12
FROM status
WHERE cohort_week >= date_trunc('week', (now() AT TIME ZONE 'America/Bogota')::date - 7 * 26)::date
GROUP BY cohort_week
ORDER BY cohort_week DESC;
