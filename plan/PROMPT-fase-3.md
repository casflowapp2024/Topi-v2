# Prompt para Claude Code — Fase 3

> Abre Claude Code en `C:\Users\juanm\WorkSpace\topiv2\topi` y pega lo de abajo.

---

Continuamos la migración de Topi. Las Fases 1 y 2 están completas y commiteadas. Ahora vamos con la **Fase 3: convertir `apps/worker` (las Lambdas de Saturn) en un worker de larga duración sin AWS**, que lea los correos bancarios desde donde quedó la última corrida (17-oct-2026).

Lee completos `CLAUDE.md`, `plan/00-plan-general.md` y `plan/03-fase-3-worker.md`. Esa última es la especificación: hallazgos/bugs a corregir, diseño, migración 000020, cambios en la API, flujo de un job, configuración y criterios de aceptación.

Restricciones críticas:
1. **Reutiliza** la lógica que funciona: `lib/google_utils.py`, `lib/microsoft_utils.py`, `lib/gemini.py`, `prompt_v3.py`, `map_account_ids`, `transform_automations_msgs` y el mapeo de errores de `api_utils.py`. No reescribas el prompt de Gemini ni cambies el modelo.
2. **Corrige los 7 hallazgos** de la especificación, cada uno con su test. Sobre todo el Bancolombia fijo en la búsqueda de Gmail y la separación de remitentes por coma.
3. **Idempotencia obligatoria:** un mismo correo nunca puede generar dos transacciones (`processed_emails` único + `transactions.source_message_id` + dedupe del empalme legado en la API). Es lo más importante de la fase.
4. Los errores transitorios **no** marcan la conexión con error; solo los de credenciales. Los códigos de error que se envían a la API deben ser los mismos que entiende el front (`token_expired_or_revoked`, `oauth_client_deleted`, `authorization_error`, …).
5. Las migraciones van en la API (`000020_worker`). El worker no migra.
6. Fuera boto3, DynamoDB, S3, Glue, SQS y OpenAI. Elimina `save_emails_data/` y `send_execution_sqs/` cuando su lógica esté en el worker.
7. **Privacidad:** en local **no** proceses correos de usuarios reales. Las pruebas reales van solo con una conexión del equipo usando `WORKER_ONLY_EMAIL_IDS`, primero con `WORKER_DRY_RUN=true`. Si no sabes cuál es la conexión del equipo, pregúntame. Para el resto usa mocks y fixtures.
8. Cero secretos en el repo; actualiza los `.env.example` (worker e infra).
9. No cambies el contrato de la API con el front.
10. **No guardes el contenido de los correos** en ninguna tabla ni log; solo metadatos en `processed_emails`. Cuidado con los `print(f"Event: ...")` del código viejo, que imprimían correos completos.
11. Gemini va detrás de la interfaz `TransactionExtractor` (ver especificación) para poder cambiarlo después por otro extractor. Los fixtures de prueba deben estar anonimizados.

Forma de trabajo:
- Primero dame un plan corto: estructura del paquete `worker/`, archivos a crear, mover y borrar, librerías nuevas y cambios en Go. Espera mi OK.
- Trabaja en este orden, con commits pequeños: (a) migración 000020 + cambios en la API (`source_message_id`, dedupe del empalme, `dedupe_key` en jobqueue) con tests, (b) estructura del worker + config + cliente de la API con X-API-Key + acceso a la DB, (c) corrección de los hallazgos en Gmail/Outlook con tests, (d) interfaz `TransactionExtractor` + `GeminiExtractor`, job loop + `email_sync_state` + `processed_emails` + manejo de errores y reintentos, (e) scheduler (encolado horario, refresh de vistas, limpieza), (f) Dockerfile + compose, (g) limpieza de lo viejo.
- Al final ejecuta `infra/scripts/restore.sh`, levanta el compose y verifica todos los criterios de aceptación de `plan/03-fase-3-worker.md`. Muéstrame los comandos y las salidas resumidas y marca los checkboxes. La prueba real con correo la hacemos juntos: déjame los comandos listos y pídeme el `email_id` del equipo.
- Si algo de la especificación choca con el código real, detente y pregúntame.
