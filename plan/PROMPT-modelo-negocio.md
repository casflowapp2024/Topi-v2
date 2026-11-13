# Prompt para Claude Code — Apoyar a Topi (etapa 2 del modelo de negocio)

> Abre Claude Code en `C:\Users\juanm\WorkSpace\topiv2\topi` y pega lo de abajo.
> Requiere la etapa 1 (`plan/25-admin-metricas.md`) en `main`. Las etapas 3 (Fase 4) y 4 (lanzar Plus) tienen
> su propio prompt / se harán después.

---

Vamos con la etapa 2 del modelo de negocio de Topi: **Apoyar a Topi**, un pago único voluntario. No se vende
ninguna función: es un "si te sirve, apóyanos".

Lee completos `CLAUDE.md` y `plan/22-modelo-negocio.md` (§ Orden, § N1 y criterios de aceptación).

Restricciones críticas:
1. Primero el **spike**: compara Wompi y Mercado Pago leyendo su documentación oficial (pago único, cobro
   recurrente en Colombia para el futuro, webhooks con firma, comisiones, sandbox). Escribe la decisión en
   `plan/22-modelo-negocio.md` y **espera mi OK** antes de codificar el adaptador.
2. Nunca guardes datos de tarjeta; webhooks con firma verificada e idempotentes; montos como decimal string;
   el front nunca marca un pago como aprobado. Solo sandbox; llaves en variables de entorno.
3. No muestres Plus, precios de suscripción ni funciones pagas en ninguna parte.
4. Recibo con la plantilla `billing_generic` y el `Mailer` existentes.
5. Migraciones con `down`, desde **000045** (o el siguiente número libre en `main`). Cero secretos, nada de AWS, no toques los
   repos viejos ni el dump.

Forma de trabajo:
- Rama `feat/apoyar-topi` desde `main`.
- Spike → espera OK → plan corto (tabla, endpoints, archivos) → espera OK → implementación con commits
  pequeños: puerto `Billing` + adaptador, `payments`, webhook, front (menú de usuario → hoja de montos →
  checkout → gracias), sección "Dinero" en el panel admin.
- Tras cada bloque: `go test ./...`, jest y al final `npm run build`.
- Al final prueba de punta a punta en sandbox, verifica los criterios de aceptación de N1, márcalos y
  muéstrame comandos, salidas y capturas. No hagas merge a `main` hasta que yo lo pruebe.
- Recuérdame anotar el estado de verificación de Google en el plan.
