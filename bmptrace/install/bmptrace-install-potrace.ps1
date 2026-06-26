# BMPTrace Potrace installer helper
$ErrorActionPreference = "Stop"

Write-Host "BMPTrace Potrace Install" -ForegroundColor Yellow
Write-Host ""

$existing = Get-Command potrace -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Potrace is already available:" -ForegroundColor Green
  potrace --version
  Read-Host "Press Enter to close"
  exit 0
}

$winget = Get-Command winget -ErrorAction SilentlyContinue
if (-not $winget) {
  Write-Host "winget was not found. Please install App Installer from Microsoft Store first." -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}

Write-Host "Searching winget packages for Potrace..." -ForegroundColor Cyan
winget search potrace
Write-Host ""
Write-Host "Copy the exact Id from the list above, then paste it below." -ForegroundColor Yellow
$packageId = Read-Host "Potrace package Id"

if ([string]::IsNullOrWhiteSpace($packageId)) {
  Write-Host "No package Id entered. Nothing was installed." -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}

winget install --id $packageId -e

Write-Host ""
Write-Host "Checking Potrace..." -ForegroundColor Cyan
potrace --version
Read-Host "Press Enter to close"
