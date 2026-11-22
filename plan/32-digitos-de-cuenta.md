# 32. Dígitos de cuenta opcionales y aprendidos

Rama nueva `feat/digitos-cuenta` desde `main`. Sale de una conversación con JuanMa (19-nov): pedir los últimos
4 dígitos al crear una cuenta estorba y no sirve en todos los casos.

Hallazgos que resuelve:
1. **Las cuentas de inversión no tienen "últimos 4 dígitos".** Su saldo es la última valoración, no lo que llega
   por correo, y aun así el campo es obligatorio.
2. **Hay bancos y correos que no envían los dígitos.** Entonces el worker manda la transacción a la primera cuenta
   del remitente y le pone `should_verify` (`map_account_ids`), aunque el banco tenga una sola cuenta.
3. **Una cuenta llega con varios números.** La tarjeta adicional o amparada y la tarjeta renovada son la misma
   cuenta, pero llegan con otros dígitos. Hoy cada cuenta admite uno solo, y la restricción única
   `(user_id, bank_id, last_four_digits)` obliga a crear una cuenta nueva por cada número.
4. **El usuario no siempre sabe los dígitos al crear la cuenta.** Pero sí sabe de qué cuenta es cada compra cuando
   la revisa.

Principio: los dígitos dejan de ser un dato que el usuario debe llenar y pasan a ser **identificadores que Topi
reúne**, con el usuario o aprendidos de sus correcciones. Sin cambios en el prompt ni en el modelo (CLAUDE.md:
no se tocan sin evaluar).

## Bloque A. Identificadores por cuenta (API y base)

- **Migración 000053 `account_identifiers`** (con `down`):
  ```
  account_identifiers(
    id BIGSERIAL PK,
    user_id, bank_id,                  -- copiados de la cuenta, para la restricción única
    account_id BIGINT FK accounts ON DELETE CASCADE,
    digits VARCHAR(4) NOT NULL CHECK (digits ~ '^[0-9]{4}$'),
    source TEXT NOT NULL CHECK (source IN ('user', 'learned')),
    created_at TIMESTAMPTZ DEFAULT now()
  )
  UNIQUE (user_id, bank_id, digits)
  ```
  - Copia cada `accounts.last_four_digits` válido como `source='user'`.
  - `accounts.last_four_digits` admite `''` (sin número; no NULL, para no tocar las vistas ni los scans) con CHECK
    de 4 números o vacío, y se quita `UNIQUE_USER_ACCOUNT`. La columna es el número que escribió el usuario; el
    trigger `account_identifiers_sync` lo copia como identificador `user` (cambiarlo reemplaza el anterior `user`).
    Se borra en un plan posterior.
  - Si `user_id`/`bank_id` cambian en la cuenta (cambio de banco), sus identificadores se actualizan en la misma
    transacción, y si chocan, la operación falla con un error de dominio.
- **Dominio** (`core/domain/account.go`):
  - `LastFourDigits` deja de ser obligatorio. `IsEmpty` y la validación de duplicados se basan en nombre + banco,
    no en dígitos.
  - `ChangesReading` sigue pidiendo una lectura si se agregan dígitos.
  - El worker deja de usar `buildAccountsMap` y recibe la lista por identificador (bloque B).
  - Error nuevo `ErrIdentifierTaken`: esos dígitos ya son de otra cuenta del mismo banco. Se mapea a 409 en
    `response.go`, con el texto exacto para el front.
- **Endpoints:**
  - `GET /accounts/:id/identifiers` → `[{id, digits, source, created_at}]`.
  - `POST /accounts/:id/identifiers` `{digits}` → `source='user'`, 409 si están tomados.
  - `DELETE /accounts/:id/identifiers/:identifierId`.
  - Crear o editar una cuenta con `last_four_digits` sigue funcionando: crea o actualiza su identificador `user`.
- **Inversiones:** la API acepta crearlas sin dígitos y no les asigna transacciones por dígitos (bloque B). Si ya
  los tienen, se conservan pero no se usan para asignar.

## Bloque B. Asignación en el worker

- `GET /accounts/admin/list` (lo usa `transform_automations_msgs`) manda por cuenta `identifiers: ["1234", ...]`
  además de `last_four_digits`, para que un worker viejo no se rompa.
- El payload del job agrega `"identifiers": {"1234": "<account_id>", ...}` y `"open_accounts": [ids]`: las cuentas
  abiertas del grupo que no son de inversión, en orden de creación. `accounts` se mantiene igual mientras convivan
  versiones.
- **Nuevo `map_account_ids`**, en este orden:
  1. Los dígitos extraídos coinciden con un identificador de una cuenta que no es de inversión → esa cuenta, sin
     `should_verify`.
  2. No hay coincidencia (dígitos vacíos o desconocidos) y el grupo tiene **una sola** cuenta abierta que no es de
     inversión → esa cuenta, sin `should_verify` si no vinieron dígitos. Si vinieron dígitos desconocidos, sí
     `should_verify`: puede ser una tarjeta nueva o una cuenta que el usuario no creó.
  3. Varias candidatas → la primera que no es de inversión + `should_verify` (la regla de hoy, sin inversiones).
  4. Solo hay cuentas de inversión → la primera + `should_verify`: el remitente no tiene otra cuenta.
- `flag_card_payments` usa la cuenta ya asignada (`transaction["account_id"]`), no vuelve a buscar por dígitos.
  Así un pago a una tarjeta asignada por la regla 2 también se reconoce.
- Las reglas de `payload["verify"]` (bancos `custom`) y de confianza baja siguen igual.
- Tests en `tests/test_mapping.py`: cada regla, un dígito compartido por dos cuentas (no puede pasar por la
  restricción única, pero el mapeo no debe romperse), un payload viejo sin `identifiers`.

## Bloque C. Aprender de las correcciones

- **Guardar lo que vio el LLM:** columna `transactions.source_account_hint VARCHAR(4) NULL` (misma migración), que
  se llena solo si el LLM devolvió 4 dígitos. El worker la envía en el POST y la API la acepta solo con `X-API-Key`.
  Son 4 dígitos, nada del cuerpo del correo.
- **Cuándo se aprende:** al cambiar `account_id` de una transacción `automated` con `source_account_hint` (editar la
  transacción o resolverla desde Por revisar), y la cuenta nueva no es de inversión:
  - Si `(user, banco de la cuenta nueva, hint)` está libre → se crea un identificador `learned`.
  - Si ya es de esa misma cuenta → nada.
  - Si es de otra cuenta → no se aprende nada. No se mueve el identificador ni se pregunta en ese momento: la
    corrección puede ser un caso aislado.
  - Si la cuenta nueva es de otro banco que el remitente → no se aprende nada (fue un error de asignación, no un
    número nuevo).
- **Re-aplicar a lo pendiente:** al aprender `1234 → cuenta X`, las otras transacciones del usuario con el mismo
  hint, el mismo banco, `should_verify=true` y en otra cuenta pasan a X y salen de Por revisar. Se devuelve cuántas
  se movieron ("Movimos 3 más de ••1234 a Visa Oro").
- Se hace en el servicio de transacciones, en la misma transacción de la base. Evento de producto
  `account_identifier_learned` (props: `source`, conteo movido; sin dígitos) en `domain.ProductEvent` y el CHECK.
- Tests: servicio con gomock y de integración del caso con conflicto y de re-aplicar.

## Bloque D. App

- **Onboarding** (`StepCreateAccount` / acciones del onboarding): **no pide los dígitos**. El usuario aún no
  tiene cuentas, lo normal es una por banco y la regla 2 del bloque B la reconoce sin ellos; si luego crea otra
  del mismo banco, los dígitos se aprenden de sus correcciones.
- **Crear y editar cuenta** (`EditCreateFinAccountForm.js`, `AccountCreate.js`):
  - "Últimos 4 dígitos (opcional)" con ayuda corta: "Si tu banco los pone en el correo, Topi reconoce la cuenta
    más rápido. Si no los sabes, los aprende cuando corrijas un movimiento."
  - Oculto para las inversiones (`isInvestmentAccount`).
  - Validación: vacío o exactamente 4 números.
- **Detalle de la cuenta** (`AccountDetail.js`), sección "Números reconocidos":
  - "••1234 · lo agregaste tú" / "••5678 · aprendido de tus correcciones", con quitar y agregar.
  - El 409 muestra "Esos dígitos ya son de <otra cuenta>".
  - No se muestra en las inversiones.
- **Por revisar / editar movimiento:** si el movimiento trae `source_account_hint`, se muestra "El correo decía
  ••1234". Al cambiarlo de cuenta, el aviso del bloque C informa cuántos más se movieron.
- Donde hoy se muestra `last_four_digits` (tarjetas, selectores, `AccountSwitcher`) no cambia nada, porque sigue
  viniendo de la columna. Sin dígitos se muestra solo el nombre, sin "••".
- Ventanas con `Dialog`, versión PC y móvil, formatos de `helpers.js`.

## Decisiones al implementar (20-nov)

- Las cuentas **cerradas** tampoco entran al mapa de dígitos ni a las candidatas: no reciben movimientos nuevos.
  "Cerrar y abrir" (cambio de moneda) crea la nueva sin dígitos y le pasa los números de la cerrada.
- La lectura prioritaria de una cuenta lleva todas las cuentas de la misma conexión y banco (`SameReadAs`): la
  regla 2 solo es correcta si el job las conoce todas.
- `PUT /accounts/:id` con `last_four_digits: ""` quita el número escrito; sin el campo lo conserva.
- El evento `account_identifier_learned` lleva solo `moved` (bool).
- 22-nov, probando en producción: las inversiones no guardan dígitos (migración 000054 quita los de relleno) y se
  quitó la sección "Números reconocidos" del detalle de la cuenta: un usuario nuevo no la entiende y basta la ayuda
  del formulario. Los endpoints `/accounts/:id/identifiers` se quedan (los usa "cerrar y abrir").

## Fuera de alcance

- Distinguir varias cuentas del mismo banco cuando el correo no trae dígitos (por ejemplo por el texto "cuenta de
  ahorros" o "Visa"): exige cambiar el prompt y evaluarlo. Esas siguen yendo a Por revisar.
- Borrar `accounts.last_four_digits`.

## Verificación

- `go test ./...` y los tests de integración del repositorio con la migración aplicada sobre el dump restaurado
  (contenedores desechables, ver memoria de pruebas locales). Comprobar que todo `last_four_digits` existente quedó
  como identificador y que no se perdió ninguna cuenta.
- Worker: `pytest` en Docker. Prueba real solo con la conexión del equipo (`WORKER_ONLY_EMAIL_IDS`), primero con
  `WORKER_DRY_RUN=true`. Comparar la asignación con la de `main` sobre los mismos correos: ninguna transacción que
  antes quedaba bien asignada debe cambiar.
- En la app (local): crear una tarjeta sin dígitos en un banco con una sola cuenta → lo leído llega sin "Por
  revisar". Con dos cuentas → corregir una compra → se crea el identificador aprendido y las demás del mismo número
  se mueven. Quitar el identificador desde el detalle. Crear una inversión sin el campo.
