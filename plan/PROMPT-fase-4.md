# Prompt para Claude Code — Fase 4

> Abre Claude Code en `C:\Users\juanm\WorkSpace\topiv2\topi` y pega lo de abajo.

---

Continuamos la migración de Topi. Las Fases 1, 2 y 3 están completas y commiteadas. Ahora vamos con la **Fase 4: dejar el frontend (`apps/web`) listo para producción**. n8n y el chatbot **no** se implementan: se eliminan del repo.

Lee completos `CLAUDE.md`, `plan/00-plan-general.md` y `plan/04-fase-4-web.md`. Esa última es la especificación: hallazgos, tareas A–E y criterios de aceptación.

Restricciones críticas:
1. **El service worker es lo más delicado de la fase.** Hay usuarios con la PWA vieja instalada (caché cache-first de `index.html`). El SW nuevo debe sacarlos de esa versión sin pantalla en blanco y sin pedirles que borren nada. Pruébalo con el SW viejo real (está en `../cash-flow-front/public/service-worker.js`).
2. No cambies la lógica de negocio del front ni el contrato con la API. Esta fase es limpieza, empaquetado y verificación. Si la prueba E2E encuentra bugs reales del front o de la API, **repórtamelos primero** con evidencia, propón el arreglo y espera mi OK antes de corregir algo fuera del alcance.
3. Antes de borrar `src/components/zobs/`, mueve los componentes que sí se usan (`DropDownAccounts`, `DropDownPeriod`, `SummaryCategories`) y verifica con el build que no queda ningún import roto.
4. No toques el flujo de Conexiones (OAuth de Gmail/Outlook).
5. Cero secretos en el repo. Las variables `REACT_APP_*` se pasan como build args.
6. Las pruebas E2E usan un usuario migrado real del dump. Al terminar, deja la base restaurada (`infra/scripts/restore.sh`).

Forma de trabajo:
- Primero dame un plan corto: archivos a borrar, mover y crear, y la estrategia del service worker. Espera mi OK.
- Trabaja en este orden, con commits pequeños: (A) limpieza, (B) service worker, (C) Dockerfile + nginx + compose, (D) configuración y URLs, (E) Playwright.
- Al final verifica todos los criterios de aceptación de `plan/04-fase-4-web.md`. Muéstrame los comandos y las salidas resumidas (incluido `curl -I` de los headers y el resultado de Playwright) y marca los checkboxes.
- Si algo de la especificación choca con el código real, detente y pregúntame.
