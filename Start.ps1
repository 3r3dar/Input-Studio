$ErrorActionPreference = 'Stop'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw 'Install Node.js 20 or newer, then run npm ci in this folder.' }
$node = $nodeCommand.Source
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\node-hid'))) { throw 'Dependencies missing. Run npm ci in this folder first.' }
$server = Join-Path $PSScriptRoot 'server.mjs'
$port = if ($env:INPUT_STUDIO_PORT) { $env:INPUT_STUDIO_PORT } else { '17849' }
if ($port -notmatch '^\d+$' -or [int64]$port -lt 1024 -or [int64]$port -gt 65535) { throw 'Invalid INPUT_STUDIO_PORT.' }
$url = "http://127.0.0.1:$port/"
try {
    $existing = Invoke-RestMethod -Uri ($url + 'health') -TimeoutSec 2
    if ($existing.application -eq 'input-studio-local') { Start-Process $url; return }
    throw 'This port belongs to another application.'
} catch {
    if ($_.Exception.Message -eq 'This port belongs to another application.') { throw }
}
Start-Process -FilePath $node -ArgumentList ('"' + $server + '"') -WorkingDirectory $PSScriptRoot
Start-Sleep -Seconds 1
try {
    $health = Invoke-RestMethod -Uri ($url + 'health') -TimeoutSec 3
    if ($health.application -ne 'input-studio-local') { throw 'This port belongs to another application.' }
} catch { throw 'Input Studio did not start. Check its console for an error.' }
Start-Process $url
