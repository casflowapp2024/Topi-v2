-- Fundadores (plan/22-modelo-negocio.md). Elegible = registrado antes de FOUNDER_CUTOFF: lo marca la API al
-- arrancar (la migración no lee variables de entorno) y nunca lo desmarca. Confirmar no borra a nadie.
ALTER TABLE users
  ADD COLUMN founder_eligible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN founder_confirmed_at TIMESTAMPTZ,
  ADD COLUMN founder_confirmed_by VARCHAR(255);
CREATE INDEX users_founder_eligible ON users (founder_eligible) WHERE founder_eligible;

-- Auditoría del panel admin: cada acceso (GET /admin/...) y cada acción sobre fundadores.
-- target = id del usuario afectado o la ruta consultada; detail sin datos financieros.
CREATE TABLE admin_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id VARCHAR(255) NOT NULL,
  action VARCHAR(40) NOT NULL,   -- view | founder_confirm | founder_unconfirm | founder_confirm_active | metrics_refresh
  target VARCHAR(255),
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_created ON admin_audit (created_at DESC);
