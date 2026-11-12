-- Actividad diaria (plan/25-admin-metricas.md): una fila por usuario y día en que usó la app.
-- La escribe AuthMiddleware una sola vez por usuario y día (caché en memoria + ON CONFLICT DO NOTHING).
-- El día es el de America/Bogota, igual que el resto de métricas del panel admin.
CREATE TABLE user_activity_days (
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  PRIMARY KEY (user_id, day)
);
CREATE INDEX user_activity_days_day ON user_activity_days (day);

-- Historia (aproximada) con lo que solo pasa si el usuario abrió la app:
--   - cada refresh token emitido (login o refresh) y cada login correcto (desde la auth propia, 000019);
--   - el día en que creó a mano una transacción o una cuenta (antes de la auth propia no hay otra señal).
INSERT INTO user_activity_days (user_id, day)
SELECT s.user_id, s.day
FROM (
  SELECT rt.user_id, (rt.created_at AT TIME ZONE 'America/Bogota')::date AS day FROM refresh_tokens rt
  UNION
  SELECT ae.user_id, (ae.created_at AT TIME ZONE 'America/Bogota')::date FROM auth_events ae WHERE ae.event = 'login_ok'
  UNION
  SELECT t.user_id, (t.created_at AT TIME ZONE 'America/Bogota')::date FROM transactions t
  WHERE NOT t.automated AND t.source_message_id IS NULL
  UNION
  SELECT a.user_id, (a.created_at AT TIME ZONE 'America/Bogota')::date FROM accounts a
) s
JOIN users u ON u.id = s.user_id
ON CONFLICT DO NOTHING;
