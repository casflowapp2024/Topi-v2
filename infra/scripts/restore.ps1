# Restaura el dump de producción (pg_dump formato custom, PG 16) en el Postgres local.
#
#   pwsh infra/scripts/restore.ps1 [-DumpFile ruta\al\dump] [-NoApi]
#
# Equivalente a restore.sh para Windows sin Git Bash/WSL:
# excluye pg_cron del TOC, restaura con --no-owner --no-acl, dropea y recrea la DB,
# y levanta la API (aplica migraciones -> versión 18). Solo necesita Docker.
param(
    [string]$DumpFile,
    [switch]$NoApi
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

$InfraDir = Split-Path -Parent $PSScriptRoot
$RepoDir = Split-Path -Parent $InfraDir
$ComposeFile = Join-Path $InfraDir 'docker-compose.yml'

# Variables de infra/.env (las del entorno tienen prioridad)
$EnvFile = Join-Path $InfraDir '.env'
if (Test-Path $EnvFile) {
    foreach ($line in Get-Content $EnvFile) {
        if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
        $key, $value = $line -split '=', 2
        $key = $key.Trim()
        if (-not [Environment]::GetEnvironmentVariable($key)) {
            [Environment]::SetEnvironmentVariable($key, $value.Trim())
        }
    }
}

$DbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { 'topi' }
$DbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { 'cashflow' }
if (-not $DumpFile) {
    $DumpFile = if ($env:DUMP_FILE) { $env:DUMP_FILE } else { Join-Path $RepoDir '..\cashflowprod.dump' }
}
if (-not (Test-Path $DumpFile)) { throw "No existe el dump: $DumpFile" }
$env:DUMP_FILE = (Resolve-Path $DumpFile).Path

function Compose { docker compose -f $ComposeFile @args }
function Pg { Compose exec -T postgres @args }

Write-Host "==> Dump: $env:DUMP_FILE"
Write-Host '==> Levantando postgres'
try { Compose stop api 2>$null | Out-Null } catch {}
Compose up -d --wait postgres

Write-Host '==> Generando lista del TOC sin pg_cron'
Pg sh -c 'pg_restore -l /dump/cashflowprod.dump > /tmp/full.list && grep -viE "cron" /tmp/full.list > /tmp/restore.list'
Write-Host '    entradas excluidas:'
Pg sh -c 'grep -iE "cron" /tmp/full.list | sed "s/^/      /" || true'

Write-Host "==> Recreando la base $DbName"
Pg psql -v ON_ERROR_STOP=1 -U $DbUser -d postgres `
    -c "DROP DATABASE IF EXISTS `"$DbName`" WITH (FORCE);" `
    -c "CREATE DATABASE `"$DbName`";"

Write-Host '==> pg_restore (--no-owner --no-acl)'
Pg pg_restore -U $DbUser -d $DbName --no-owner --no-acl --exit-on-error -j 4 `
    -L /tmp/restore.list /dump/cashflowprod.dump

Write-Host '==> Conteos'
Pg psql -U $DbUser -d $DbName -At -F ' = ' -c @"
SELECT 'transactions', count(*) FROM transactions
UNION ALL SELECT 'user_extra', count(*) FROM user_extra
UNION ALL SELECT 'schema_migrations.version', max(version) FROM schema_migrations;
"@

if (-not $NoApi) {
    Write-Host '==> Levantando la API (aplica migraciones pendientes)'
    Compose up -d --build --wait api
    Pg psql -U $DbUser -d $DbName -At -c "SELECT 'schema_migrations.version = ' || version || ' dirty=' || dirty FROM schema_migrations;"
}

Write-Host '==> Listo'
