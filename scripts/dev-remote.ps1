$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot

function Stop-PortListener {
  param([int]$Port)

  try {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
      try {
        Stop-Process -Id $pid -Force -ErrorAction Stop
        Write-Host "Stopped existing listener on port $Port (PID $pid)"
      } catch {
        Write-Warning "Could not stop process $pid on port ${Port}: $($_.Exception.Message)"
      }
    }
  } catch {
    # no listener on this port
  }
}

Stop-PortListener -Port 3001
Stop-PortListener -Port 4174

Start-Process -WindowStyle Hidden -WorkingDirectory $root -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev:api"
Start-Process -WindowStyle Hidden -WorkingDirectory $root -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev:frontend"

Write-Host "Started Bluestone proxy on http://127.0.0.1:3001 and Vite on http://127.0.0.1:4174"
