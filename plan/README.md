# Plan de migración Topi → Hetzner + Coolify

| Archivo | Contenido |
|---|---|
| `00-plan-general.md` | Arquitectura destino, decisiones, fases, retos |
| `01-fase-1.md` | Detalle y criterios de aceptación de la Fase 1 |
| `02-fase-2-auth.md` | Diseño de auth propia (solo contraseña) y migración de cuentas |
| `03-fase-3-worker.md` | Worker de correos (ex-Saturn) y reanudación de lectura |
| `04-fase-4-web.md` | Frontend listo para producción (sin n8n ni chatbot) |
| `05-fase-5-deploy.md` | Deploy en Coolify: código (Parte A) y runbook manual (Parte B) |
| `10-tipos-de-cuenta.md` | Transferencias, inversiones con valoraciones, tarjetas y cambio de moneda de cuentas |
| `20-ux-fase-3-vistas.md` | UX Fase 3: Inicio (ritmo, flujo, patrimonio), bandeja "Por revisar", agregar discreto, movimientos por día |
| `21-cuotas.md` | Repartir compras a cuotas en gastos, presupuestos y cortes de tarjeta |
| `21-ux-layout-y-modales.md` | Layout de PC (contenedor común, grilla 12 col, menú de usuario) y rediseño de modales |
| `22-modelo-negocio.md` | Modelo de negocio: gratis + Plus, fundadores, Apoyar a Topi, medición de costos, pagos |
| `23-correo-transaccional.md` | Correo con Resend: outbox, recuperar contraseña, verificación, conexión caída, resumen mensual |
| `90-evaluacion-jev.md` | Análisis de Jev vs Gemini (para después) |
| `PROMPT-fase-*.md` | Prompts para Claude Code |

Estado: AWS **apagado por completo**. Fuente de verdad = `../cashflowprod.dump` (PostgreSQL 16, formato custom).
