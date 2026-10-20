# Plan de migración Topi → Hetzner + Coolify

| Archivo | Contenido |
|---|---|
| `00-plan-general.md` | Arquitectura destino, decisiones, fases, retos |
| `01-fase-1.md` | Detalle y criterios de aceptación de la Fase 1 |
| `02-fase-2-auth.md` | Diseño de auth propia (solo contraseña) y migración de cuentas |
| `03-fase-3-worker.md` | Worker de correos (ex-Saturn) y reanudación de lectura |
| `04-evaluacion-jev.md` | Análisis de Jev vs Gemini (para después) |
| `PROMPT-fase-*.md` | Prompts para Claude Code |

Estado: AWS **apagado por completo**. Fuente de verdad = `../cashflowprod.dump` (PostgreSQL 16, formato custom).
