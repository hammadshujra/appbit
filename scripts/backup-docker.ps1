# Run from the Appbit project folder in Windows PowerShell or PowerShell 7.
# Creates a consistent SQL dump of the existing MySQL database before upgrade.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$container = (docker compose ps -q db).Trim()
if ($LASTEXITCODE -ne 0 -or -not $container) { throw 'Appbit database container is not running. Start Docker and check docker compose ps.' }
$folder = Join-Path (Get-Location) 'backups'
New-Item -ItemType Directory -Force -Path $folder | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$destination = Join-Path $folder "appbit-before-v2.1.1-$stamp.sql"
$temporary = "/tmp/appbit-before-v2.1.1-$stamp.sql"
try {
    docker compose exec -T db sh -c ('mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --quick --routines --triggers --events --no-tablespaces "$MYSQL_DATABASE" > ' + $temporary)
    if ($LASTEXITCODE -ne 0) { throw 'Database dump failed. The upgrade has not been started.' }
    docker cp "${container}:$temporary" "$destination"
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy the database backup to Windows.' }
    if ((Get-Item -LiteralPath $destination).Length -lt 100) { throw 'The backup is unexpectedly small. Do not upgrade until it is checked.' }
    Write-Host "Backup saved: $destination"
    Write-Host 'Keep this SQL file private. It contains your application database.'
} finally {
    docker compose exec -T db sh -c "rm -f $temporary" | Out-Null
}
