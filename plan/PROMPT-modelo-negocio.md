# Prompt para Claude Code — Modelo de negocio

> Abre Claude Code en `C:\Users\juanm\WorkSpace\topiv2\topi` y pega lo de abajo.
> Si corres en paralelo con el correo, usa otro worktree: `git worktree add ../topi-negocio -b feat/modelo-negocio main`.

---

Vamos a implementar el modelo de negocio de Topi: que la app cubra sus costos de operación con un plan
gratis completo y un plan Plus, sin incomodar al usuario gratis.

Lee completos `CLAUDE.md`, `plan/22-modelo-negocio.md` (la especificación: principios, planes, bloques
N0–N3 y criterios de aceptación) y `plan/23-correo-transaccional.md` (otro equipo lo implementa en paralelo;
solo para saber qué esperar del `Mailer`).

Restricciones críticas:
1. **Nada que hoy es gratis pasa a ser pago.** Todos los usuarios existentes quedan como fundadores (Plus de
   por vida). Si una función actual quedaría limitada, detente y pregúntame.
2. Los derechos se validan en la API, no solo en el front. Un solo lugar de dominio calcula los derechos.
3. Pagos: nunca guardar datos de tarjeta; webhooks con firma verificada e idempotentes; montos como decimal
   string (nunca float). Nunca marcar un pago como aprobado desde el front.
4. Antes de integrar una pasarela haz el **spike** de N1 (Wompi vs Mercado Pago) leyendo su documentación
   oficial y deja la decisión escrita en `plan/22-modelo-negocio.md`. Espera mi OK antes de codificar el
   adaptador. Usa solo sandbox; las llaves van en variables de entorno.
5. Migraciones con `down`, numeradas a partir de **000040** (la 000038 es de patrimonio y la 000039 la reserva el plan de correo). Si al
   empezar ya hay otras migraciones nuevas en `main`, ajusta y avísame.
6. El correo puede no existir aún: usa el puerto `Mailer` si ya está en `main`; si no, deja los recibos
   detrás de una interfaz y no los envíes.
7. Cero secretos, nada de AWS, no toques los repos viejos ni el dump, privacidad según `CLAUDE.md`.

Forma de trabajo:
- Rama `feat/modelo-negocio` desde `main`.
- Primero dame un plan corto: tablas, endpoints, archivos, cómo el worker reporta tokens de Gemini y
  cualquier choque con el código. Espera mi OK.
- Orden con commits pequeños: N0 medir → spike (espera OK) → N1 Apoyar a Topi → N2 planes y derechos →
  N3 cobro recurrente.
- Tras cada bloque: `go test ./...`, tests del worker, `CI=true npx react-scripts test --watchAll=false` y
  al final `npm run build`.
- Al final verifica los criterios de aceptación del plan, márcalos y muéstrame comandos y salidas
  resumidas, más capturas de la página Planes y el flujo de Apoyar en sandbox. No hagas merge a `main`
  hasta que yo lo pruebe.
- Recuérdame revisar el estado de verificación de Google (sección "Verificación de Google") y anotarlo.
