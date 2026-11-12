DROP TABLE IF EXISTS admin_audit;
DROP INDEX IF EXISTS users_founder_eligible;
ALTER TABLE users
  DROP COLUMN IF EXISTS founder_confirmed_by,
  DROP COLUMN IF EXISTS founder_confirmed_at,
  DROP COLUMN IF EXISTS founder_eligible;
