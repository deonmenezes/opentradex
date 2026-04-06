$ErrorActionPreference = "Stop"

$workspace = if ($env:OPENTRADEX_WORKSPACE) { $env:OPENTRADEX_WORKSPACE } else { Join-Path $HOME "opentradex" }
$packageManager = if ($env:OPENTRADEX_PACKAGE_MANAGER) { $env:OPENTRADEX_PACKAGE_MANAGER } else { "npm" }

Write-Host "Welcome to OpenTradex"
Write-Host "Our implementation. Your strategy."
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js 22+ is required before running this installer."
}

if ($packageManager -eq "bun" -and -not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Host "Bun is not installed, so this installer is falling back to npm."
  $packageManager = "npm"
}

if ($packageManager -eq "bun") {
  bun add -g opentradex@latest
} else {
  npm install -g opentradex@latest
}

opentradex onboard --workspace $workspace
