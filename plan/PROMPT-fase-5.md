# Prompt para Claude Code — Fase 5

> Abre Claude Code en `C:\Users\juanm\WorkSpace\topiv2\topi` y pega lo de abajo.

---

Continuamos la migración de Topi. Las Fases 1 a 4 están completas y commiteadas. Ahora vamos con la **Fase 5: deploy en Hetzner + Coolify**.

Lee completos `CLAUDE.md`, `plan/00-plan-general.md` y `plan/05-fase-5-deploy.md`. Tu trabajo es la **Parte A** (código, scripts, CI, plantillas y runbook). La **Parte B** son pasos manuales que haré yo en Coolify, el DNS y las consolas, guiado por el runbook que escribas. Acompáñame en ellos cuando te lo pida.

Restricciones críticas:
1. **Antes del primer push** a GitHub: corre un escáner de secretos sobre todo el historial de `topi` (gitleaks o equivalente) y verifica que no están trackeados `.env`, el dump ni `e2e/.auth`. Si aparece algo, detente y dime antes de reescribir historial.
2. Los scripts de `infra/scripts/prod/` corren en el servidor, contra un contenedor por nombre o un `DATABASE_URL`, **sin** depender del compose local. `restore-prod.sh` debe negarse a restaurar sobre una base con tablas, salvo `--force`.
3. `smoke-prod.sh` es **solo lectura**: no crea usuarios, no llama `set-initial-password` y no escribe datos.
4. El heartbeat del worker (`worker_heartbeat`, migración 000021) y `GET /health` son los únicos cambios funcionales. `/health` responde 200 aunque el worker esté `stale`: es para monitoreo.
5. CI con GitHub Actions: Go con Postgres de servicio, pytest y build del web. Sin Playwright ni el dump.
6. Las plantillas `infra/coolify/*.env.template` no llevan valores reales. Marca cada variable como secreta o no, y como build-time o runtime.
7. El runbook debe ser seguible por alguien que no conoce el código: comandos exactos, dónde hacer clic en Coolify (v4) y cómo verificar cada paso. Donde no estés seguro de cómo se llama algo en la interfaz de Coolify, dilo explícitamente en vez de inventarlo.
8. No cambies el contrato de la API con el front ni la lógica de negocio.

Forma de trabajo:
- Primero dame un plan corto con archivos a crear y modificar. Espera mi OK.
- Commits pequeños, en este orden: (1) escaneo de secretos + `.gitignore`, (2) migración 000021 + heartbeat + `/health` + Swagger off en producción, (3) scripts `prod/` + `smoke-prod.sh` + `backup-check.sh`, (4) CI, (5) plantillas + RUNBOOK.
- Al final: corre en local todo lo que se pueda probar (tests, `smoke-prod.sh` contra el compose local con URLs locales, `restore-prod.sh` contra el contenedor local con y sin `--force`). Muéstrame las salidas resumidas y marca en `plan/05-fase-5-deploy.md` lo que ya está hecho de la Parte A.
- Luego dame los comandos exactos para crear el repo privado en GitHub y hacer el push (con `gh` si está instalado). **No** hagas el push sin mi OK.
- Si algo de la especificación choca con el código real o con cómo funciona Coolify, detente y pregúntame.
