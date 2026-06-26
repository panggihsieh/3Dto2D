# BMPTrace Potrace installer helper for Windows
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

$downloadUrl = "https://potrace.sourceforge.net/download/1.16/potrace-1.16.win64.zip"
$installRoot = Join-Path $env:LOCALAPPDATA "Programs\Potrace"
$zipPath = Join-Path $env:TEMP "potrace-1.16.win64.zip"
$extractPath = Join-Path $env:TEMP "potrace-1.16.win64"

Write-Host "Downloading official Potrace Windows 64-bit zip..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath

if (Test-Path $extractPath) {
  Remove-Item -LiteralPath $extractPath -Recurse -Force
}
Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath -Force

$potraceExe = Get-ChildItem -LiteralPath $extractPath -Recurse -Filter "potrace.exe" | Select-Object -First 1
$mkbitmapExe = Get-ChildItem -LiteralPath $extractPath -Recurse -Filter "mkbitmap.exe" | Select-Object -First 1

if (-not $potraceExe) {
  Write-Host "Could not find potrace.exe in the downloaded zip." -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}

New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
Copy-Item -LiteralPath $potraceExe.FullName -Destination $installRoot -Force
if ($mkbitmapExe) {
  Copy-Item -LiteralPath $mkbitmapExe.FullName -Destination $installRoot -Force
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$pathParts = @($userPath -split ";" | Where-Object { $_ })
if ($pathParts -notcontains $installRoot) {
  [Environment]::SetEnvironmentVariable("Path", (($pathParts + $installRoot) -join ";"), "User")
  $env:Path = "$env:Path;$installRoot"
  Write-Host "Added Potrace to your user PATH: $installRoot" -ForegroundColor Green
}

Write-Host ""
Write-Host "Checking Potrace..." -ForegroundColor Cyan
potrace --version
Write-Host ""
Write-Host "If another PowerShell window cannot find potrace yet, close it and open a new PowerShell." -ForegroundColor Yellow
Read-Host "Press Enter to close"
