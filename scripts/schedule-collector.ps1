# Registers a daily Task Scheduler task that runs the metrics collector (npm run metrics:schedule).
#   -Time   local time to run, default 20:00
#   -Remove deletes the task
#   -Run    what the task itself runs: starts the stack if it is down, waits for Loki, then collects
param(
  [string]$Time = '20:00',
  [switch]$Remove,
  [switch]$Run
)

$ErrorActionPreference = 'Stop'
$TaskName = 'AI-SDLC metrics collector'
$Repo = Split-Path -Parent $PSScriptRoot

if ($Run) {
  Set-Location $Repo
  docker compose -f grafana/compose.yaml up -d
  if ($LASTEXITCODE -ne 0) { Write-Error 'Could not start Grafana and Loki. Is Docker Desktop running?'; exit 1 }
  $ready = $false
  for ($i = 0; $i -lt 30 -and -not $ready; $i++) {
    try { $ready = (Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3100/ready' -TimeoutSec 2).StatusCode -eq 200 } catch { Start-Sleep -Seconds 2 }
  }
  if (-not $ready) { Write-Error 'Loki did not become ready within 60 seconds.'; exit 1 }
  node scripts/collect-metrics.mjs
  exit $LASTEXITCODE
}

if ($Remove) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Removed task '$TaskName'."
  exit 0
}

$script = Join-Path $Repo 'scripts\schedule-collector.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -Run" -WorkingDirectory $Repo
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
# StartWhenAvailable: if the machine was off at $Time, run as soon as it is back, so nothing is lost.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Loads AI-SDLC PR metrics into local Loki' -Force | Out-Null
Write-Host "Registered '$TaskName' daily at $Time. Run it now with: Start-ScheduledTask -TaskName '$TaskName'"
