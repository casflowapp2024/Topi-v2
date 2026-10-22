-- Lo usan infra/scripts/reset-password.sh y su versión de producción en infra/scripts/prod/. Variables psql: :'email'
BEGIN;
WITH target AS (
  UPDATE users
  SET password_hash = NULL, password_set_at = NULL,
      token_version = token_version + 1, updated_at = now()
  WHERE lower(email) = lower(trim(:'email'))
  RETURNING id, email, token_version
), revoked AS (
  UPDATE refresh_tokens SET revoked_at = now()
  WHERE user_id IN (SELECT id FROM target) AND revoked_at IS NULL
  RETURNING id
), event AS (
  INSERT INTO auth_events (user_id, email, event, user_agent)
  SELECT id, email, 'admin_reset', 'infra/scripts/reset-password.sh' FROM target
)
SELECT id || ' ' || email || ' token_version=' || token_version
       || ' refresh_revocados=' || (SELECT count(*) FROM revoked)
FROM target;
COMMIT;
