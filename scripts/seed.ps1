<#
.SYNOPSIS
  Seeds the CreatorOS database with the pilot cohort dataset (15 creators, 4 clients, campaigns, orders, ledgers).
#>
param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [switch]$Clean
)

$ErrorActionPreference = "Stop"

if (-not $DatabaseUrl) {
  $DatabaseUrl = "postgres://creatoros:creatoros_local_only@localhost:5432/creatoros?sslmode=disable"
}

$cleanArg = ""
if ($Clean) {
  $cleanArg = "-clean"
}

Write-Host "Seeding CreatorOS Pilot Cohort Data..." -ForegroundColor Cyan

$apiDir = Join-Path $PSScriptRoot "..\apps\api"
Push-Location $apiDir
try {
  $env:DATABASE_URL = $DatabaseUrl
  if ($cleanArg) {
    go run ./cmd/seed $cleanArg
  } else {
    go run ./cmd/seed
  }
  Write-Host "Database seeding completed successfully!" -ForegroundColor Green
} finally {
  Pop-Location
}
