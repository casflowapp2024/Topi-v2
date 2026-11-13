# Prompt para Claude Code — Panel admin, métricas y fundadores (etapa 1)

> Abre Claude Code en `C:\Users\juanm\WorkSpace\topiv2\topi` y pega lo de abajo.

---

Vamos con la etapa 1 del modelo de negocio de Topi: medir. Panel de administración con la North Star
("usuarios al día semanales"), métricas de activación, lectura, calidad, catálogo y costos, y la lista de
fundadores.

Lee completos `CLAUDE.md`, `plan/25-admin-metricas.md` (la especificación) y `plan/22-modelo-negocio.md`
(contexto: orden de etapas y regla de fundadores).

Restricciones críticas:
1. Privacidad primero: el panel muestra agregados; la tabla de usuarios no muestra montos ni transacciones;
   nombres personalizados y comercios solo con k ≥ 5 usuarios. `product_events` con lista cerrada de nombres y
   sin texto libre ni montos. Todo acceso al panel auditado.
2. Nada se borra: los fundadores se confirman o no, pero no se elimina ningún usuario ni dato.
3. La actividad diaria se registra sin escribir en cada request. Las consultas pesadas van precalculadas
   (vista materializada o `metrics_daily` recalculada de noche por el worker).
4. Migraciones desde **000040** con `down`. `FOUNDER_CUTOFF` y precios por token como variables de entorno.
5. Valida las cifras: la North Star y las cohortes deben cuadrar con una consulta SQL manual sobre la base
   restaurada del dump (local). Muéstrame ambas.
6. Cero secretos, nada de AWS, no toques los repos viejos ni el dump, privacidad según `CLAUDE.md`.

Forma de trabajo:
- Rama `feat/admin-metricas` desde `main`.
- Primero dame un plan corto: tablas, de qué tabla sale cada métrica, endpoints, cómo el worker registra
  tokens de Gemini y qué precalculas. Espera mi OK.
- Orden con commits pequeños: (1) migraciones + actividad diaria + fundadores elegibles; (2) `llm_usage` en el
  worker y `product_events` en la API; (3) endpoints admin y precálculo; (4) panel `/admin` con sus secciones;
  (5) confirmación de fundadores.
- Tras cada bloque: `go test ./...` (e integración si tocas repositorios), tests del worker, jest y al final
  `npm run build`.
- Al final verifica los criterios de aceptación, márcalos y muéstrame comandos, salidas resumidas y capturas
  del panel (claro y oscuro). No hagas merge a `main` hasta que yo lo pruebe.
