# Runbook: Topi en Hetzner + Coolify (Fase 5, Parte B)

Pasos manuales para dejar Topi en producción. Pensado para alguien que no conoce el código:
cada paso dice **qué hacer**, **dónde** y **cómo verificarlo**. Hazlos en orden.

> **Sobre la interfaz de Coolify (v4).** Los nombres de menús y campos cambian entre versiones.
> Donde no hay certeza del nombre exacto se marca **(verificar en tu versión)**. Si algo no aparece
> con ese nombre, busca la opción equivalente; el objetivo de cada paso está escrito para poder
> reconocerla.

## Convenciones

- `LOCAL$` = una terminal en tu computador, en la raíz del repo `topi`.
- `SERVER$` = una sesión SSH en el servidor: `ssh root@<ip-del-servidor>`.
- `<pg>` = nombre del contenedor de `topi-db` en el servidor (se obtiene en B1.3).
- Plantillas de variables: `infra/coolify/*.env.template` (cada variable dice si es secreta y si es de build).
- **Prohibido en producción:** correr el E2E de Playwright, exponer Postgres a internet y reutilizar los
  secretos de desarrollo (`infra/.env`).

## Valores que vas a necesitar

Guárdalos en tu gestor de contraseñas **antes** de empezar. No los pegues en chats ni tickets.

| Valor | Cómo se obtiene | Dónde se usa |
|---|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -hex 32` | topi-db, `DB_PASSWORD` (api), `DATABASE_URL` (worker) |
| `JWT_SECRET` | `openssl rand -hex 32` | topi-api |
| `INTERNAL_API_KEY` | `openssl rand -hex 32` | topi-api y topi-worker (el mismo) |
| Secret de Google (Gmail) rotado | Google Cloud Console (B0.2) | api y worker |
| Secret de Azure (Outlook) rotado | Azure Portal (B0.2) | api y worker |
| `GEMINI_API_KEY` nueva | Google AI Studio, proyecto con facturación (B0.2) | worker |
| Credenciales del bucket S3 | Cloudflare R2 o Backblaze B2 (B0.4) | backups de topi-db, `backup-check.sh` |

---

## B0. Prerrequisitos

### B0.1 Repo en GitHub y conexión con Coolify
1. El repo privado debe existir y tener `main` empujado. Comandos al final de este documento ("Anexo A").
2. En Coolify: menú lateral **Sources** → **+ Add** → **GitHub App** (verificar en tu versión).
   Sigue el asistente; al instalar la app en GitHub, elige **Only select repositories** → solo `topi`.
3. **Verificar:** en GitHub → Settings → Applications → Installed GitHub Apps → la app de Coolify muestra
   acceso solo a `topi`.

### B0.2 Rotar secretos (los viejos están en el historial de los repos viejos)
1. **Google (Gmail):** Google Cloud Console → APIs & Services → Credentials → el OAuth client que usa Gmail
   → **Add secret** / **Reset secret**. Guarda el nuevo; borra el viejo cuando la API ya use el nuevo.
   Rotar el secret **no** invalida los refresh tokens guardados en la tabla `emails`.
2. **Azure (Outlook):** Azure Portal → App registrations → la app → **Certificates & secrets** →
   **New client secret**. Guarda el *Value* (solo se muestra una vez). Borra el viejo después.
3. **Gemini:** Google AI Studio → API keys → crear una key **en un proyecto con facturación activa**.
   Revoca la vieja.
4. **Verificar:** los secretos viejos aparecen como eliminados/revocados en cada consola (hazlo al final de B5).

### B0.3 Generar los secretos propios
```bash
LOCAL$ openssl rand -hex 32   # POSTGRES_PASSWORD
LOCAL$ openssl rand -hex 32   # JWT_SECRET
LOCAL$ openssl rand -hex 32   # INTERNAL_API_KEY
```
Tres valores distintos. **Nunca** los de `infra/.env`.

### B0.4 Bucket para backups (S3-compatible, gratis)
**Cloudflare R2** (recomendado: 10 GB gratis, sin costo de salida):
1. Cloudflare → R2 → **Create bucket** → nombre `topi-backups`.
2. R2 → **Manage R2 API Tokens** → **Create API token** → permiso **Object Read & Write**, limitado al
   bucket `topi-backups`. Guarda *Access Key ID* y *Secret Access Key*.
3. El endpoint es `https://<account-id>.r2.cloudflarestorage.com` (se muestra en la página del token o del
   bucket). Región: `auto`.

(Backblaze B2 es la alternativa: bucket privado + *Application Key* limitada al bucket; endpoint
`https://s3.<region>.backblazeb2.com`.)

### B0.5 Servidor
```bash
SERVER$ free -h                  # "available" debe dejar >= 1,5 GB para Topi
SERVER$ swapon --show            # si no muestra nada, crear swap:
SERVER$ fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile \
          && echo '/swapfile none swap sw 0 0' >> /etc/fstab
SERVER$ docker --version         # Docker instalado por Coolify
```
- Coolify actualizado: en el panel, **Settings** → actualización (verificar en tu versión).
- **Hetzner Cloud Firewall** (Hetzner Console → Firewalls): entrada TCP 22 (idealmente solo tu IP),
  80 y 443 abiertos; **nada más** (5432 cerrado). Aplicarlo al servidor.
- Panel de Coolify: con su propio dominio y HTTPS, o con el puerto 8000 limitado a tu IP en el firewall.
- **Verificar** desde tu computador: `nc -vz <ip> 5432` debe fallar (timeout o refused).

### B0.6 DNS (un día antes)
- Baja el TTL de los registros `@`, `www` y `api` a **300 s**. **No borres** registros MX ni TXT.

### B0.7 Copiar los scripts al servidor
```bash
LOCAL$ scp -r infra/scripts root@<ip>:/root/topi-scripts
SERVER$ chmod +x /root/topi-scripts/*.sh /root/topi-scripts/prod/*.sh
SERVER$ ls /root/topi-scripts/prod      # backup-check.sh make-admin.sh reset-password.sh restore-prod.sh ...
```
Los scripts de `prod/` exigen `--container <pg>` (o `DATABASE_URL`) y nunca usan el compose local.

---

## B1. Base de datos (`topi-db`)

### B1.1 Crear la base
1. Coolify → proyecto `topi` (créalo si no existe: **Projects** → **+ Add**) → entorno `production`
   → **+ New** (o **+ Add Resource**) → **Databases** → **PostgreSQL** (verificar en tu versión).
2. Valores (ver `db.env.template`):
   - Imagen: `postgres:16-alpine`
   - Usuario: `topi` · Base inicial: `cashflow` · Contraseña: tu `POSTGRES_PASSWORD`
   - **No** activar "Make it publicly available" (o el equivalente que publica un puerto).
3. **Start**.
4. **Verificar:** el estado es *Running/Healthy* y la base **no** tiene puerto público.

### B1.2 Backups a S3
1. Coolify → menú lateral **S3 Storages** → **+ Add** (verificar en tu versión): endpoint, bucket
   `topi-backups`, región, access key y secret de B0.4. Guardar y **validar la conexión** (Coolify la prueba).
2. En `topi-db` → pestaña **Backups** (verificar en tu versión) → nuevo backup programado:
   - Frecuencia (cron): `30 8 * * *` = 03:30 en Bogotá **si el servidor está en UTC**.
     Comprueba la zona: `SERVER$ timedatectl | grep "Time zone"`; si el servidor/Coolify está en
     `America/Bogota`, usa `30 3 * * *`. Coolify tiene un ajuste de zona horaria del servidor
     (verificar en tu versión).
   - Activar **guardar en S3** y elegir el storage creado.
   - Retención: **30** copias (en S3 y, si lo pide, en local).
3. Ejecutar un **backup manual** ahora (botón tipo "Backup now", verificar en tu versión).
4. **Verificar:** el backup aparece como exitoso en Coolify y el archivo está en el bucket
   (Cloudflare → R2 → `topi-backups` → objetos). Anota la carpeta (prefijo) donde quedó: la usa B7.4.

### B1.3 Nombre del contenedor
```bash
SERVER$ docker ps --format '{{.Names}}\t{{.Image}}' | grep postgres
```
El nombre es el identificador que Coolify le da a `topi-db` (coincide con el UUID que se ve en la URL
del recurso). En adelante: `<pg>`.

### B1.4 Restaurar el dump
```bash
LOCAL$ scp ../cashflowprod.dump root@<ip>:/root/cashflowprod.dump
SERVER$ /root/topi-scripts/prod/restore-prod.sh --container <pg> --dump /root/cashflowprod.dump
```
- Si responde `ERROR: la base ya tiene N tablas`, alguien desplegó la API antes que esto: detén
  `topi-api` en Coolify y repite con `--force` (borra lo que haya en la base).
- **Verificar** (la salida termina así):
  ```
  transactions = 8748
  user_extra   = 62
  emails       = 23
  schema_migrations.version = 17 (topi-api la sube a 21 al arrancar)
  ==> OK: los conteos coinciden con el dump.
  ```

### B1.5 Borrar el dump del servidor
Solo después de que B1.4 dijo OK:
```bash
SERVER$ shred -u /root/cashflowprod.dump && ls /root/*.dump   # "No such file" = borrado
```

---

## B2. API (`topi-api`)

### B2.1 Crear la aplicación
1. Proyecto `topi` / `production` → **+ New** → **Application** → origen: la **GitHub App** de B0.1 →
   repo `topi`, rama `main`.
2. **Build Pack: Dockerfile**. **Base Directory:** `/apps/api`. Dockerfile: `Dockerfile` (relativo a la base).
3. **Ports Exposes:** `8080`.
4. **Domains:** `https://api.topi.cash`.
5. **Watch Paths:** `apps/api/**` (para que un push solo redespliegue la API si cambió `apps/api`;
   verificar en tu versión dónde está el campo).
6. Healthcheck: el Dockerfile ya trae `HEALTHCHECK` contra `/health`. Si Coolify tiene su propio
   healthcheck activado (pestaña **Healthcheck**, verificar en tu versión), configúralo con ruta `/health`
   y puerto `8080`, o desactívalo para que use el del Dockerfile.

### B2.2 Variables
1. Pestaña **Environment Variables** → modo texto/"Developer view" (verificar en tu versión) → pega
   `infra/coolify/api.env.template` y reemplaza cada `<...>`. **Ninguna** es "Build Variable".
2. `DB_HOST`: en `topi-db`, Coolify muestra la **URL interna** (algo como
   `postgres://topi:****@<host>:5432/cashflow`); el `<host>` es `DB_HOST`. Suele ser el mismo `<pg>` de B1.3.
3. `TRUSTED_PROXIES`: la subred de la red de Coolify, donde vive el proxy (Traefik o Caddy):
   ```bash
   SERVER$ docker network inspect coolify -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}'
   ```
   Si la API está en otra red (Coolify la llama *destination*), usa la subred de esa:
   `docker inspect <contenedor-de-topi-api> -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'`.

### B2.3 Deploy y verificación
1. **Deploy**. En **Logs** del deployment: build OK. En los logs del contenedor: `Starting the HTTP server`
   y nada de `error migrating database`.
2. Migraciones:
   ```bash
   SERVER$ docker exec <pg> sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT version, dirty FROM schema_migrations"'
   21|f
   ```
3. Salud (cuando el DNS de B4 apunte; antes, desde el servidor con `curl -H 'Host: api.topi.cash' http://127.0.0.1/health`):
   ```bash
   LOCAL$ curl -s https://api.topi.cash/health
   {"status":"ok","db":"ok","worker":"stale","worker_last_seen":null}
   ```
   `worker: stale` es lo esperado hasta B5.
4. **Verificar `TRUSTED_PROXIES`** después del smoke de B4 (que deja un `login_fail`):
   ```bash
   SERVER$ docker exec <pg> sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT ip, created_at FROM auth_events ORDER BY created_at DESC LIMIT 3"'
   ```
   La IP debe ser **tu IP pública**, no una `10.x`/`172.x`. Si sale una privada, `TRUSTED_PROXIES` no
   cubre al proxy: corrige la subred y redespliega.

### B2.4 Admin
```bash
SERVER$ /root/topi-scripts/prod/make-admin.sh --container <pg> cashflowapp2024@gmail.com
OK: <id> cashflowapp2024@gmail.com role=admin
```

---

## B3. Web (`topi-web`)

1. **+ New** → **Application** → GitHub App → `topi`, `main`. **Build Pack: Dockerfile**.
   **Base Directory:** `/apps/web`. **Ports Exposes:** `8080`. **Watch Paths:** `apps/web/**`.
2. **Domains:** `https://www.topi.cash,https://topi.cash`.
3. Redirección a `www`: Coolify v4 tiene una opción de dirección del dominio, del tipo
   *"Redirect to www"* / *"Allow www & non-www"* (verificar en tu versión). Elige **redirigir a www**.
   Si tu versión no la tiene, deja solo `https://www.topi.cash` y pide ayuda para configurar la
   redirección en el proxy.
4. **Environment Variables** → pega `web-build-args.env.template`. Marca **"Build Variable"** en
   `REACT_APP_API_URL` y `REACT_APP_GA_TRACKING_ID` (se hornean en el build; cambiarlas = redeploy).
5. **Deploy**.
6. **Verificar** (cuando haya DNS): `https://www.topi.cash` carga el login; `https://topi.cash` redirige a
   `https://www.topi.cash/`. El smoke de B4 lo comprueba todo.

> B3 compila React **en el servidor**. Con 4 GB eso es frágil: el modo recomendado es
> **"Front desde GHCR"** (abajo), donde GitHub Actions compila y Coolify solo descarga la imagen.

---

## Front desde GHCR (`topi-web` como Docker Image)

El workflow `.github/workflows/web-image.yml` compila `apps/web` en cada push a `main` que toque
`apps/web/**` (o a mano: Actions → **web-image** → **Run workflow**) y publica
`ghcr.io/casflowapp2024/topi-web` con dos tags: `latest` y `sha-<commit corto>`. Conserva las últimas
10 versiones. Las `REACT_APP_*` quedan **horneadas en la imagen**: cambiarlas = cambiar la variable
en GitHub y volver a correr el workflow (en Coolify no se configuran).

### G1. Variables del repo (GitHub)
Repo → **Settings** → **Secrets and variables** → **Actions** → pestaña **Variables** → *New repository variable*:

| Variable | Valor |
|---|---|
| `WEB_API_URL` | `https://api.topi.cash` (sin barra final). **Obligatoria**: si falta, el workflow falla. |
| `WEB_GA_TRACKING_ID` | `G-XXXXXXX`, o no crearla (vacía = sin Google Analytics). |

Son *variables*, no secrets: terminan en el JavaScript público.

Primer build: Actions → **web-image** → **Run workflow** (rama `main`). Al terminar, el paquete
aparece en el perfil de la org → **Packages** → `topi-web`, vinculado al repo (privado, como el repo).
Si no aparece vinculado: paquete → **Package settings** → *Connect repository* → `Topi-v2`, y en
*Manage Actions access* dale al repo rol **Write** (lo necesita el job de limpieza).

### G2. PAT de solo lectura y `docker login` en el servidor
1. En GitHub, con una cuenta con acceso al repo: **Settings** (de la cuenta) → **Developer settings** →
   **Personal access tokens** → **Tokens (classic)** → *Generate new token (classic)*.
   Nombre `coolify-ghcr-pull`, scope **solo `read:packages`**, expiración 1 año (anótala para rotarlo).
   Los fine-grained tokens no sirven para GHCR.
2. En el servidor, como `root` (Coolify ejecuta Docker como root, verificar en tu versión):
   ```bash
   SERVER$ read -rs GHCR_PAT && echo "$GHCR_PAT" | docker login ghcr.io -u <usuario-github> --password-stdin; unset GHCR_PAT
   Login Succeeded
   SERVER$ docker pull ghcr.io/casflowapp2024/topi-web:latest        # comprobar
   ```
   `read -rs` evita que el token quede en el historial. La credencial queda en `/root/.docker/config.json`.
3. Rotar: generar el PAT nuevo, repetir el `docker login` y borrar el viejo en GitHub.

### G3. Crear el recurso en Coolify
1. **+ New** → **Docker Image** (verificar en tu versión; a veces está como *Docker Image* dentro de
   *Applications*). Imagen: `ghcr.io/casflowapp2024/topi-web`, tag `latest`. Nombre: `topi-web-ghcr`.
2. **Ports Exposes:** `8080`. **Sin variables de entorno.** Límite de memoria 64 MB (como B7.3).
3. Healthcheck: la imagen trae el suyo (`/healthz`). Si Coolify pide uno HTTP: ruta `/healthz`, puerto `8080`.
4. Antes de mover los dominios, pruébalo con el dominio que genera Coolify (`*.sslip.io`, en **Domains**)
   o sin dominio: **Deploy** → el contenedor queda *healthy* y `GET /healthz` responde `ok`.
   (El login no funcionará en ese dominio por CORS: es esperado.)

### G4. Migrar los dominios desde el `topi-web` viejo
Dos recursos con el mismo dominio confunden al proxy, así que va en este orden (corte de segundos a
un par de minutos):
1. `topi-web` (viejo) → **Domains**: anota exactamente lo que tiene (`https://www.topi.cash,https://topi.cash`
   y la opción de redirección a www) → bórralos → **Save** → **Stop**.
2. `topi-web-ghcr` → **Domains**: pega los mismos dominios y la misma redirección a www → **Save** → **Deploy**.
3. Verificar:
   ```bash
   LOCAL$ curl -sI https://www.topi.cash | head -1          # 200
   LOCAL$ curl -sI https://topi.cash | grep -i location     # https://www.topi.cash/
   LOCAL$ infra/scripts/smoke-prod.sh                       # 0 fallas
   ```
   Si el certificado tarda, **Redeploy** de `topi-web-ghcr` (B4.3).
4. Vuelta atrás: quitar los dominios de `topi-web-ghcr`, devolverlos al viejo y **Deploy** del viejo.
5. Con unos días estable: borrar el `topi-web` viejo (así deja de compilar en el servidor con cada push).

### G5. Deploy de una versión nueva
Hasta que Coolify tenga HTTPS, el deploy es manual: cuando el workflow termine en verde,
`topi-web-ghcr` → **Redeploy** (descarga `latest` de nuevo; verificar en tu versión que haga
`pull`; si no, activa la opción de *pull latest image* del recurso). Después:
`LOCAL$ infra/scripts/smoke-prod.sh`.

Más adelante, el job `deploy` del workflow (hoy con `if: false`) llama a la API de Coolify. Para activarlo:
1. Coolify → **Keys & Tokens** → **API tokens** → token con permiso de *deploy*.
2. GitHub → **Secrets** → `COOLIFY_URL` (`https://<coolify>`, sin barra final), `COOLIFY_WEB_UUID`
   (el UUID de `topi-web-ghcr`, aparece en su URL en Coolify) y `COOLIFY_TOKEN`.
3. Quitar `if: false` del job `deploy` y hacer push.

### G6. Rollback a un commit anterior
1. Elige el tag: paquete `topi-web` en GitHub → versiones, o `git log --oneline -- apps/web`
   (`sha-` + los 7 primeros caracteres del commit). Solo existen las **últimas 10** versiones.
2. `topi-web-ghcr` → tag de la imagen: `latest` → `sha-<commit>` → **Save** → **Redeploy**.
3. Smoke. Cada build tiene su `BUILD_ID`, así que el service worker de los navegadores también vuelve
   a la versión anterior.
4. Para volver a la normalidad: tag `latest` → **Redeploy**. Ojo: el siguiente push a `apps/web`
   vuelve a mover `latest`, pero el recurso sigue fijado al `sha-` hasta que lo cambies.
5. Si la versión ya no está en GHCR: Actions → **web-image** → **Run workflow** no deja elegir un commit;
   haz `git revert` de los commits malos y push (genera una imagen nueva).

---

## B4. DNS y TLS

1. En tu proveedor DNS: registros **A** de `@`, `www` y `api` → IP del servidor (y **AAAA** si el servidor
   tiene IPv6). Si el DNS está en Cloudflare: **DNS only** (nube gris), para que Let's Encrypt emita sin fricción.
2. Comprobar la propagación:
   ```bash
   LOCAL$ dig +short topi.cash www.topi.cash api.topi.cash     # las tres: la IP del servidor
   ```
3. Coolify emite los certificados al detectar el DNS (puede tardar unos minutos; si no, **Redeploy** del
   recurso). En los logs del proxy (Servers → servidor → Proxy, verificar en tu versión) no debe haber
   errores de ACME.
4. Smoke test (desde tu computador):
   ```bash
   LOCAL$ infra/scripts/smoke-prod.sh
   ...
   Resultado: N ok, 0 fallas, M avisos
   ```
   Debe terminar con **0 fallas**. El aviso de `worker stale` es normal hasta B5. El smoke es de solo lectura,
   salvo una fila `login_fail` en `auth_events` (`smoke-test@invalid.test`).
5. Prueba manual: entra con `cashflowapp2024@gmail.com` → aviso de migración → crea contraseña →
   dashboard con datos → el menú de admin funciona.

---

## B5. Worker (`topi-worker`, salida controlada)

### B5.1 Crear
1. **+ New** → **Application** → GitHub App → `topi`, `main`. **Build Pack: Dockerfile**.
   **Base Directory:** `/apps/worker`. **Watch Paths:** `apps/worker/**`. **Sin dominio.**
2. El worker no escucha ningún puerto. Si Coolify exige "Ports Exposes", pon `8080` y **no** le asignes
   dominio (verificar en tu versión). Desactiva el healthcheck de Coolify si pide una ruta HTTP: el
   Dockerfile trae el suyo y la salud real se ve en `/health` de la API.
3. **Environment Variables:** `worker.env.template`, todas de runtime.
4. `API_BASE_URL`: el hostname interno de `topi-api` (Coolify lo muestra en el recurso; verificar en tu
   versión). Para comprobarlo después del primer deploy:
   ```bash
   SERVER$ docker exec <contenedor-del-worker> python -c "import urllib.request,os;print(urllib.request.urlopen(os.environ['API_BASE_URL']+'/health',timeout=5).read())"
   ```
   Si no resuelve, usa `API_BASE_URL=https://api.topi.cash` (sale por el proxy con TLS; también funciona).

### B5.2 Etapa 1: dry run con la conexión del equipo
1. Busca el `emails.id` de la conexión del equipo:
   ```bash
   SERVER$ docker exec <pg> sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT e.id, e.email, e.provider, e.active FROM emails e JOIN users u ON u.id = e.user_id WHERE u.email = '"'"'cashflowapp2024@gmail.com'"'"'"'
   ```
2. Variables: `WORKER_DRY_RUN=true`, `WORKER_ONLY_EMAIL_IDS=<ese id>` → **Deploy**.
3. **Verificar:**
   - Logs del worker (JSON): `job loop iniciado` con `dry_run: true` y `only_email_ids: [<id>]`, y
     líneas de lo que *crearía* desde el 17-oct.
   - `curl -s https://api.topi.cash/health` → `"worker":"ok"` con `worker_last_seen` reciente.

### B5.3 Etapa 2: escritura real con la misma conexión
1. `WORKER_DRY_RUN=false` (misma `WORKER_ONLY_EMAIL_IDS`) → **Deploy**.
2. **Verificar:** las transacciones nuevas aparecen en la app (cuenta del equipo).
3. Forzar una segunda lectura y comprobar que **no duplica**:
   ```bash
   SERVER$ docker exec <pg> sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT count(*) FROM transactions WHERE source_message_id IS NOT NULL"'
   SERVER$ docker exec <contenedor-del-worker> python -m worker enqueue-now
   # esperar a que termine (logs) y repetir el conteo: debe ser el mismo
   ```
4. **Etapa 3** (Fase 6, no ahora): `WORKER_ONLY_EMAIL_IDS=` vacío → todas las conexiones.

---

## B6. Consolas OAuth

1. **Google Cloud** → Credentials → OAuth client de Gmail → *Authorized redirect URIs*: deja **solo**
   `https://www.topi.cash/gmail-auth-connect` (y `http://localhost:3000/gmail-auth-connect` si se usa en
   desarrollo). Borra los `*.amazoncognito.com` y `*.cloudfront.net`. *Authorized JavaScript origins*:
   `https://www.topi.cash`.
2. Borra el OAuth client que usaba Cognito para el login con Google (el login con Google ya no existe).
3. **Azure** → App registration de Outlook → **Authentication** → Redirect URIs: solo
   `https://www.topi.cash/gmail-auth-connect` (y el de localhost si aplica).
4. **Verificar:** en la app, Ajustes → Conexiones → "Conectar nuevo Email" con una cuenta del equipo
   completa el flujo sin `redirect_uri_mismatch`.

---

## B7. Monitoreo

1. **Notificaciones de Coolify:** menú **Notifications** del equipo (verificar en tu versión) → Email o
   Telegram → activar *deployment failed* y *container stopped/unhealthy*. Enviar la prueba.
2. **Uptime:** Uptime Kuma (en Coolify: **+ New** → **Service** → Uptime Kuma) o UptimeRobot gratis:
   - `https://api.topi.cash/health`: tipo *HTTP(s) – Keyword*, keyword `"worker":"ok"`, intervalo 5 min.
     Alerta si no responde, si no es 200 (la base caída da 503) o si falta la keyword (worker stale).
   - `https://www.topi.cash/healthz`: tipo HTTP, 200.
3. **Límites de memoria** por recurso (pestaña de límites de recursos, verificar en tu versión):
   api 256 MB, worker 384 MB, web 64 MB, db 512 MB (orientativos; ajústalos mirando `docker stats`).
4. **Probar el backup** (anota fecha y resultado):
   ```bash
   SERVER$ S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com S3_BUCKET=topi-backups \
           AWS_ACCESS_KEY_ID=<key> AWS_SECRET_ACCESS_KEY=<secret> \
           /root/topi-scripts/prod/backup-check.sh --prefix <carpeta-de-B1.2> --container <pg>
   ...
   ==> OK: el backup <objeto> se restaura y tiene datos.
   ```
   Restaura el último backup en un Postgres temporal (no toca producción) y compara los conteos.
5. **Probar las alertas:** detén `topi-worker` en Coolify → en ≤ 15 min llega la alerta de `/health`
   (worker stale) y la de Coolify (contenedor detenido). Vuelve a arrancarlo.

---

## Operación diaria

| Tarea | Comando |
|---|---|
| Hacer admin a alguien | `SERVER$ /root/topi-scripts/prod/make-admin.sh --container <pg> <email>` |
| "Olvidé mi contraseña" | `SERVER$ /root/topi-scripts/prod/reset-password.sh --container <pg> <email>` |
| Estado de la migración de cuentas | `SERVER$ /root/topi-scripts/prod/auth-report.sh --container <pg> [dias]` |
| Smoke después de un deploy | `LOCAL$ infra/scripts/smoke-prod.sh` |
| Probar el backup (mensual) | `SERVER$ .../prod/backup-check.sh ...` (B7.4) |
| Consulta SQL manual | `SERVER$ docker exec -it <pg> psql -U topi -d cashflow` (nunca abrir 5432) |

**Rollback de un deploy:** en el recurso → **Deployments** → elegir el anterior y volver a desplegarlo
(verificar en tu versión), o `git revert` + push. El front desde GHCR: tag `sha-<commit>` (ver G6). Las migraciones no se revierten solas: si un deploy
incluyó una migración, avisar antes de hacer rollback.

**Restaurar la base desde un backup:** detener `topi-api` y `topi-worker`, bajar el backup del bucket
y restaurarlo con `restore-prod.sh --container <pg> --dump <archivo> --force`, con
`EXPECTED_TRANSACTIONS/EXPECTED_USER_EXTRA/EXPECTED_EMAILS` iguales a lo que mostró `backup-check.sh`.

---

## Anexo A: crear el repo privado y hacer el primer push

Antes del push: `gitleaks` limpio sobre todo el historial (ver `plan/05-fase-5-deploy.md`).
```bash
LOCAL$ docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:v8.21.2 git /repo --redact   # "no leaks found"
LOCAL$ git ls-files | grep -iE '(^|/)\.env($|\.)|\.(dump|dmp)$|\.auth/'                   # solo los .env.example
```
Con GitHub CLI (`winget install GitHub.cli`, luego `gh auth login`):
```bash
LOCAL$ gh repo create <org-o-usuario>/topi --private --source . --remote origin
LOCAL$ git push -u origin main
```
Sin GitHub CLI: crea el repo **privado y vacío** en github.com (sin README ni .gitignore) y:
```bash
LOCAL$ git remote add origin git@github.com:<org-o-usuario>/topi.git
LOCAL$ git push -u origin main
```
**Verificar:** GitHub → Actions → el workflow `ci` corre y termina en verde.
