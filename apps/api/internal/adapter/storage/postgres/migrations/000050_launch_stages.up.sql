-- Despliegue por etapas (plan/27 §I): cuándo empezó cada etapa y la nota de la decisión. Lo fija el admin desde
-- el panel (auditado); las métricas de activación de una etapa se miden desde su fecha de inicio.
CREATE TABLE launch_stages (
  stage VARCHAR(10) PRIMARY KEY CHECK (stage IN ('I.1', 'I.2', 'I.3')),
  started_at DATE NOT NULL,
  note VARCHAR(500) NOT NULL DEFAULT '',
  set_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
