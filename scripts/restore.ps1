<#
.SYNOPSIS
  Restores a PostgreSQL backup dump into a CreatorOS database.
#>
param(
  [Parameter(Mandatory=$true)]
  [string]$DumpFile,
  [string]$ContainerName = "creatoros-postgres-1",
  [string]$TargetDatabase = "creatoros",
  [string]$User = "creatoros"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $DumpFile)) {
  Write-Error "Dump file not found: $DumpFile"
}

$dumpItem = Get-Item $DumpFile
$containerPath = "/tmp/$($dumpItem.Name)"

Write-Host "Copying dump file to container..." -ForegroundColor Cyan
docker cp $dumpItem.FullName "${ContainerName}:${containerPath}"
if ($LASTEXITCODE -ne 0) {
  Write-Error "Failed to copy dump file to container"
}

Write-Host "Restoring database '$TargetDatabase' from '$($dumpItem.Name)'..." -ForegroundColor Cyan
docker exec $ContainerName pg_restore -U $User -d $TargetDatabase --clean --if-exists $containerPath
if ($LASTEXITCODE -ne 0) {
  Write-Warning "pg_restore completed with warnings or non-fatal errors"
}

docker exec $ContainerName rm -f $containerPath

Write-Host "Database restore finished!" -ForegroundColor Green
