<#
.SYNOPSIS
  Performs an automated PostgreSQL backup of the CreatorOS database.
#>
param(
  [string]$ContainerName = "creatoros-postgres-1",
  [string]$DatabaseName = "creatoros",
  [string]$User = "creatoros",
  [string]$OutputDir = "backups"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$filename = "${DatabaseName}_backup_${timestamp}.dump"
$hostPath = Join-Path $OutputDir $filename
$containerPath = "/tmp/$filename"

Write-Host "Creating backup for database '$DatabaseName'..." -ForegroundColor Cyan

docker exec $ContainerName pg_dump -U $User -d $DatabaseName -Fc -f $containerPath
if ($LASTEXITCODE -ne 0) {
  Write-Error "pg_dump failed inside container $ContainerName"
}

docker cp "${ContainerName}:${containerPath}" $hostPath
if ($LASTEXITCODE -ne 0) {
  Write-Error "Failed to copy backup dump to host"
}

docker exec $ContainerName rm -f $containerPath

$item = Get-Item $hostPath
Write-Host "Backup completed successfully!" -ForegroundColor Green
Write-Host "File: $($item.FullName)"
Write-Host "Size: $($item.Length) bytes"
