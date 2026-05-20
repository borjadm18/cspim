$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Start-Process -WindowStyle Hidden -WorkingDirectory $root -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev:api"
Start-Process -WindowStyle Hidden -WorkingDirectory $root -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev:frontend"

Write-Host "Started Bluestone proxy on http://127.0.0.1:3001 and Vite on http://127.0.0.1:4174"
