# 33. Catálogo de bancos editable desde el admin

Rama nueva `feat/catalogo-bancos` desde `main`. Sale de una conversación con JuanMa (22-nov): quiere agregar
remitentes de bancos desde el panel de admin sin hacer deploy, ver cada banco con su logo y ver qué bancos y
correos agregan los usuarios, para pasar al catálogo los que sirvan.

Hallazgos que resuelve:
1. **Los bancos oficiales están en el código.** `enums/official_banks.go` es un mapa de nombre a correos separados
   por coma. Agregar o cambiar un remitente obliga a hacer un deploy.
2. **Un remitente nuevo no llega a los usuarios que ya tienen el banco.** `SetOfficialBank` copia los correos en
   `banks.email` solo al crear el banco. Si después Bancolombia cambia de dirección, hay que actualizar a mano
   cada fila.
3. **El banco del usuario no está ligado al oficial.** `banks` tiene una fila por usuario con `name` y `email`, y
   `IsOfficialSender` lo reconoce comparando el nombre normalizado.
4. **No hay logos ni una vista de los remitentes.** El admin solo muestra cuentas por banco en `AdminCatalog`, y
   únicamente los nombres que usan 5 o más usuarios.

Principio: el catálogo vive en Postgres y es la única fuente de los remitentes oficiales. Un banco del usuario
ligado al catálogo lee con los remitentes del catálogo. `banks.email` queda solo para los bancos personalizados.
Sin cambios en el prompt ni en el modelo (CLAUDE.md: no se tocan sin evaluar).

## Bloque A. Tablas y migración (API y base)

- **Migración 000055 `bank_catalog`** (con `down`):
  ```
  bank_catalog(
    id BIGSERIAL PK,
    slug TEXT NOT NULL UNIQUE,            -- 'bancolombia', para URLs y tests
    name TEXT NOT NULL UNIQUE,            -- 'Bancolombia', lo que ve el usuario
    country CHAR(2) NOT NULL DEFAULT 'CO',
    color VARCHAR(7) NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    active BOOLEAN NOT NULL DEFAULT true, -- inactivo: no aparece para elegir, sigue leyendo a quien ya lo tiene
    created_at, updated_at TIMESTAMPTZ DEFAULT now()
  )

  bank_catalog_senders(
    id BIGSERIAL PK,
    bank_id BIGINT NOT NULL FK bank_catalog ON DELETE CASCADE,
    email TEXT NOT NULL CHECK (email = lower(email) AND email LIKE '%@%'),
    active BOOLEAN NOT NULL DEFAULT true,
    note TEXT NULL,                       -- 'cambio de dominio nov-2026', 'Bre-B'
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (bank_id, email)
  )

  bank_logos(
    bank_id BIGINT PK FK bank_catalog ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('image/png','image/webp','image/svg+xml')),
    bytes BYTEA NOT NULL CHECK (octet_length(bytes) <= 102400),
    etag TEXT NOT NULL,                   -- sha256 de bytes
    updated_at TIMESTAMPTZ DEFAULT now()
  )

  ALTER TABLE banks ADD COLUMN catalog_id BIGINT NULL REFERENCES bank_catalog(id);
  CREATE INDEX banks_catalog_id ON banks (catalog_id);
  ```
  - El mismo remitente puede estar en dos bancos (hoy `DAVIbankInforma@davibank.com` está en Davibank y en
    ScotiaBank). Por eso la restricción única es `(bank_id, email)` y no solo `email`.
  - **Datos iniciales:** inserta los 11 bancos de `enums.OfficialBanks` con sus remitentes en minúscula.
  - **Backfill:** `banks.catalog_id` se llena cuando el nombre normalizado coincide con uno del catálogo. La
    normalización tiene que ser la misma de `normalizeBankName`: en SQL o con un paso en Go después de migrar.
    Decidir en la implementación y probarlo con los nombres reales del dump.
  - El `down` borra la columna y las tablas. El enum vuelve con el revert del código.
- **Logos:** van en Postgres porque son pocos y pequeños y así entran en los backups. Sin almacenamiento de objetos (CLAUDE.md: nada de AWS) ni deploy
  por logo. Se descartó `public/banks/` del web porque obliga a un deploy por cada logo.

## Bloque B. Dominio, repositorio y caché (API)

- **Repositorio `BankCatalogRepository`:** `List`, `Get`, `Create`, `Update`, `SetActive`, `AddSender`,
  `UpdateSender`, `RemoveSender`, `PutLogo`, `GetLogo`, `DeleteLogo`.
- **Servicio `BankCatalogService` con caché en memoria** de la lista de bancos con sus remitentes activos. Se
  recarga al arrancar, después de cada escritura del admin y cada 5 minutos, por si hay más de una réplica.
- **Se reemplaza `enums.OfficialBanks`:**
  - `SetOfficialBank` → al crear o editar un banco cuyo nombre coincide con uno del catálogo, se pone
    `catalog_id` y se deja de copiar los correos en `banks.email`. Si el usuario escribió sus propios correos
    para un banco del catálogo, se guardan en `banks.email` como extra (ver bloque C).
  - `IsOfficialSender(bankName, sender)` → `IsCatalogSender(catalogID, sender)`, leyendo del caché. Un banco sin
    `catalog_id` nunca es oficial (igual que hoy un banco personalizado).
  - `GET /banks/official` devuelve `[{id, slug, name, color, logo_url}]` de los bancos activos. Se mantiene el
    campo `banks: [names]` mientras el web viejo siga en uso.
  - Se borra `enums/official_banks.go` cuando ya nada lo use.
- **Logo público:** `GET /banks/catalog/:id/logo` sin sesión, con `Content-Type` guardado, `ETag`,
  `Cache-Control: public, max-age=86400` y `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`.
  El web lo muestra siempre con `<img>`, que no ejecuta scripts de un SVG.

## Bloque C. Remitentes efectivos para el worker

- `AdminGetAccountsList` (`repository/account.go`) arma `b.email` así:
  - con `catalog_id`: los remitentes activos del catálogo, más los extra de `banks.email` si hay, sin repetir;
  - sin `catalog_id`: `banks.email`, como hoy.
  Se hace en el SQL (`string_agg` sobre `bank_catalog_senders`) para que `SplitByBankEmails` siga igual y el
  worker no cambie: sigue recibiendo un remitente por job.
- El filtro `b.email <> ''` pasa a ser "tiene remitentes efectivos", para no saltarse un banco del catálogo cuyo
  `banks.email` quedó vacío.
- **Remitente nuevo en una conexión vieja:** no tiene fila en `email_sync_state`, así que el worker lo trata como
  primera lectura (`first_read_since`) y guarda `first_found`/`first_read_at`. Revisar en la implementación:
  - que esa primera lectura de un remitente extra no vuelva a disparar avisos de onboarding ni de "banco sin
    movimientos" (`BANK_UNSUPPORTED_ALERT_SINCE`);
  - desde cuándo leer. Propuesta: desde la creación de la conexión, con un tope de 30 días.
  Agregar un test de jobs para este caso.
- Desactivar un remitente lo saca de los jobs nuevos. Su fila de `email_sync_state` se queda por si se reactiva.

## Bloque D. Endpoints de admin

Todos bajo `/admin`, con `AdminMiddleware` y `AdminAuditMiddleware`, como el resto del panel (plan 25).

- `GET /admin/banks` → catálogo con remitentes, logo, usuarios conectados por banco y la salud de cada remitente.
- `POST /admin/banks`, `PUT /admin/banks/:id`, `POST /admin/banks/:id/active` `{active}`.
- `POST /admin/banks/:id/senders` `{email, note}`, `PUT /admin/banks/:id/senders/:senderId`,
  `DELETE /admin/banks/:id/senders/:senderId`. El correo se guarda en minúscula y se valida el formato.
- `PUT /admin/banks/:id/logo` (multipart, 100 KB como máximo, valida el tipo leyendo los bytes y no solo la
  extensión) y `DELETE /admin/banks/:id/logo`.
- **Salud por remitente (últimos 30 días)**, desde `processed_emails.sender`: correos leídos, con transacción, sin
  transacción y con error, y fecha del último correo. Sirve para ver si un remitente nuevo funciona o si un banco
  dejó de mandar desde una dirección.
- `GET /admin/banks/user-senders` → lo que agregaron los usuarios (bloque E).
- `POST /admin/banks/:id/senders/from-user` `{email}` → pasa un remitente de usuario al catálogo. Además liga al
  catálogo los bancos de usuario que lo usaban y tenían el mismo nombre normalizado.

## Bloque E. Lo que agregaron los usuarios (privacidad)

- Fuente: los remitentes de `banks.email` de bancos sin `catalog_id`, más los extra de bancos con catálogo que no
  están en el catálogo.
- Se agrupa por dirección: usuarios (conteo), nombre de banco más común, cuentas conectadas y la salud del
  remitente en 30 días. **Nunca** se muestra qué usuario lo agregó.
- Regla de privacidad (un usuario puede escribir un correo personal en vez del de un banco):
  - dominios institucionales (no están en la lista de abajo): se muestran completos aunque los use un usuario;
  - dominios personales (`gmail.com`, `hotmail.com`, `outlook.com`, `live.com`, `yahoo.com`, `icloud.com`,
    `proton.me`): se enmascaran (`j***@gmail.com`) salvo que los usen `domain.MinGroupUsers` (5) o más usuarios;
  - el nombre de banco más común sigue la regla actual de `AdminCatalog`: solo con `domain.MinGroupUsers` o más usuarios.
- La lista de dominios personales es una constante en Go con test.

## Bloque F. Web

- **Pestaña "Bancos" en el admin** (`components/admin/AdminBanks.jsx`, con `AdminUi`):
  1. Catálogo: tabla con logo, nombre, color, remitentes (chips con estado) y usuarios conectados. Crear y editar
     en una hoja lateral con remitentes, nota, color, activo y subida de logo con vista previa.
  2. Salud: por remitente, barras de con transacción, sin transacción y error, y el último correo. Se resaltan
     los remitentes sin correos en 30 días.
  3. De los usuarios: tabla del bloque E con el botón "Agregar al catálogo", que deja elegir el banco o crear uno
     nuevo.
- **Logo en la app:** `DropDownBanks`, la lista de cuentas y el detalle muestran el logo si el banco tiene
  `catalog_id`. Si no hay logo, se muestra la inicial sobre `color`, o el emoji de hoy para los personalizados.
- `get_banks`/`create_personal_bank` aceptan `catalog_id` y `logo_url` en la respuesta, sin romper la forma
  actual.

## Pruebas

- Go: migración y backfill contra el dump (cuántos `banks` quedan ligados, cuáles no y por qué).
  `IsCatalogSender`. `AdminGetAccountsList` con catálogo, con extras y sin catálogo. Endpoints de admin (rol,
  auditoría, validación del logo, 100 KB). Enmascarado del bloque E.
- Worker: remitente nuevo en una conexión vieja (bloque C), sin avisos duplicados.
- Web: tests de `AdminBanks` y del logo con respaldo de inicial. Revisar en el navegador con `mc-web`/`mc-api`
  (ver memoria de pruebas locales): agregar un remitente en el admin y ver que el siguiente job lo usa.

## Fuera de este plan

- Detectar remitentes de banco en el buzón del usuario sin que los haya escrito.
- Catálogos por país en la UI (la columna `country` queda lista).
- Borrar `banks.email` para los bancos del catálogo: se decide cuando el catálogo lleve un tiempo funcionando.

## Implementado (22-nov) y diferencias con lo de arriba

- **Remitentes sin borrar.** No hay `DELETE` de remitentes: se desactivan. Si se borraran, una copia vieja en
  `banks.email` volvería como remitente "extra" del usuario.
- **Regla de remitentes efectivos** en la función SQL `bank_effective_senders(catalog_id, email)`: los activos del
  catálogo + lo que escribió el usuario que no es un remitente del catálogo (activo o no), en minúscula y sin repetir.
  La usan `AdminGetAccountsList` (jobs del worker) y el estado de lectura de `GET /email/status`.
- **Mayúsculas.** La migración pasa `email_sync_state.sender_email` a minúscula (deja la fila con la lectura más
  reciente si había dos). Sin eso, `BBVA@bbvanet.com.co` contaría como remitente nuevo y repetiría la primera lectura.
- **Remitente nuevo en una conexión vieja (bloque C):** el worker no cambia. Lo lee como primera lectura desde el
  inicio del mes (`first_read_since`), guarda `first_found`, y no vuelve a mandar avisos: `bank_unsupported` se
  marca una vez por conexión (`emails.unsupported_alert_at`) y `confirm_email_read` es idempotente.
- **Al crear o renombrar** un banco del usuario se pone `catalog_id` por nombre (`SetOfficialBank`); al crear se
  siguen copiando los remitentes a `banks.email`, por compatibilidad. Crear un banco del catálogo, renombrarlo o
  agregarle un remitente liga los bancos de usuario con ese nombre (`LinkUserBanks`).
- **Caché:** `domain.SetBankCatalog` guarda la foto que usan `IsSupportedBank`, `IsOfficialSender` y
  `SupportedBanks`; la API la carga al arrancar y cada 5 minutos, y después de cada cambio del admin. Antes de la
  primera carga (y en tests) vale la semilla de la migración.
- **Arreglo de paso:** el total de `AdminGetAccountsList` se pegaba como texto con `$n` que coincidían por casualidad
  con los argumentos de la consulta de afuera; ahora no tiene parámetros.
- **Web:** pestaña Bancos en el admin y logo en `DropDownBanks` (bancos del usuario y oficiales). La lista de cuentas
  todavía no muestra el logo: las consultas de cuentas no traen el banco del catálogo.
- Verificado: `go test ./...`, integración completa contra Postgres 16, tests del web (falla `App.test.js`, igual
  que en `main`: jest no resuelve `react-router-dom`) y en el navegador con usuarios ficticios: crear banco, subir
  logo, pasar un remitente de usuarios al catálogo y ver que los 5 bancos ligados leen con él.
