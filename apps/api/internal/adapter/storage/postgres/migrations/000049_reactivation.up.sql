-- Reactivación personal (plan/27 §G): un correo uno a uno escrito por el equipo. Es un mensaje personal, no
-- novedades: tiene su propio interruptor (encendido) y su propia baja. El registro y el dedupe de 90 días salen
-- de email_outbox (template reactivation_personal).
ALTER TABLE notification_prefs ADD COLUMN email_personal BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX email_outbox_reactivation ON email_outbox (user_id, created_at DESC)
  WHERE template = 'reactivation_personal';
