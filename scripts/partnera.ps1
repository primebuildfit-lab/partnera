<#
    Partnera local launcher (Windows PowerShell).

    Manage the local Partnera app: install, start, stop, status, update, logs,
    reset. Everything runs locally - no external service is contacted. Data,
    logs, and the PID live under .partnera/ at the repo root.

    Usage:
        .\scripts\partnera.ps1 <command>

    Commands:
        install    Install dependencies and build the app
        start      Start the app (builds first if needed)
        stop       Stop the running app (state is saved)
        restart    Stop then start
        status     Show whether the app is running and where
        update     Rebuild from local source (reinstall + build); restarts if running
        logs       Show recent server output
        reset      Delete local data (next start seeds a fresh demo)
        help       Show this help
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Command = "help"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$DataDir = Join-Path $Root ".partnera"
$DataFile = Join-Path $DataDir "data.json"
$PidFile = Join-Path $DataDir "server.pid"
$LogFile = Join-Path $DataDir "server.log"
$ErrFile = Join-Path $DataDir "server.err.log"
$Bundle = Join-Path $Root "packages\web\dist\server.mjs"
if ($env:PARTNERA_PORT) { $Port = $env:PARTNERA_PORT } else { $Port = "4000" }

function Ensure-DataDir { if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir | Out-Null } }

function Get-RunningPid {
    if (-not (Test-Path $PidFile)) { return $null }
    $storedPid = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if (-not $storedPid) { return $null }
    $proc = Get-Process -Id $storedPid -ErrorAction SilentlyContinue
    if ($proc) { return $storedPid }
    return $null
}

function Invoke-Build {
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    & pnpm install
    Write-Host "Building..." -ForegroundColor Cyan
    & pnpm --filter "@partnera/web" build
    & pnpm --filter "@partnera/web" bundle
}

function Start-App {
    $running = Get-RunningPid
    if ($running) { Write-Host "Already running (PID $running) at http://localhost:$Port" -ForegroundColor Yellow; return }
    Ensure-DataDir
    if (-not (Test-Path $Bundle)) { Write-Host "App not built yet - building..." -ForegroundColor Cyan; Invoke-Build }

    $env:PORT = $Port
    $env:PARTNERA_DATA = $DataFile
    $proc = Start-Process -FilePath "node" -ArgumentList @("`"$Bundle`"") `
        -WorkingDirectory $Root -RedirectStandardOutput $LogFile -RedirectStandardError $ErrFile `
        -WindowStyle Hidden -PassThru
    $proc.Id | Out-File -FilePath $PidFile -Encoding ascii
    Start-Sleep -Seconds 1
    if (Get-Process -Id $proc.Id -ErrorAction SilentlyContinue) {
        Write-Host "Partnera started at http://localhost:$Port  (PID $($proc.Id))" -ForegroundColor Green
        Write-Host "  Sign in: owner@primebuild.test | brian@primebuild.test | admin@partnera.test"
        Write-Host "  Data:    $DataFile"
        Write-Host "  Logs:    .\scripts\partnera.ps1 logs"
    } else {
        Write-Host "Failed to start. Recent errors:" -ForegroundColor Red
        if (Test-Path $ErrFile) { Get-Content $ErrFile -Tail 20 }
    }
}

function Stop-App {
    $running = Get-RunningPid
    if (-not $running) { Write-Host "Not running." -ForegroundColor Yellow; if (Test-Path $PidFile) { Remove-Item $PidFile -Force }; return }
    Write-Host "Stopping (PID $running)..." -ForegroundColor Cyan
    Stop-Process -Id $running -Force -ErrorAction SilentlyContinue
    if (Test-Path $PidFile) { Remove-Item $PidFile -Force }
    Write-Host "Stopped. State was saved after each change." -ForegroundColor Green
}

function Show-Status {
    $running = Get-RunningPid
    if ($running) {
        Write-Host "Partnera: RUNNING" -ForegroundColor Green
        Write-Host "  URL:  http://localhost:$Port"
        Write-Host "  PID:  $running"
    } else {
        Write-Host "Partnera: STOPPED" -ForegroundColor Yellow
    }
    if (Test-Path $DataFile) { $dataState = "exists" } else { $dataState = "none - first run will seed demo" }
    if (Test-Path $Bundle) { $builtState = "yes" } else { $builtState = "no - run install" }
    Write-Host "  Data: $DataFile  ($dataState)"
    Write-Host "  Built: $builtState"
}

switch ($Command.ToLower()) {
    "install" { Invoke-Build; Write-Host "Done. Start with: .\scripts\partnera.ps1 start" -ForegroundColor Green }
    "start"   { Start-App }
    "stop"    { Stop-App }
    "restart" { Stop-App; Start-Sleep -Seconds 1; Start-App }
    "status"  { Show-Status }
    "update"  {
        $wasRunning = [bool](Get-RunningPid)
        if ($wasRunning) { Stop-App }
        Invoke-Build
        Write-Host "Updated (rebuilt from local source)." -ForegroundColor Green
        if ($wasRunning) { Start-App }
    }
    "logs"    {
        if (Test-Path $LogFile) { Get-Content $LogFile -Tail 40 } else { Write-Host "No logs yet." }
        if ((Test-Path $ErrFile) -and (Get-Item $ErrFile).Length -gt 0) { Write-Host "--- errors ---" -ForegroundColor Red; Get-Content $ErrFile -Tail 20 }
    }
    "reset"   {
        Stop-App
        if (Test-Path $DataFile) { Remove-Item $DataFile -Force; Write-Host "Local data deleted. Next start seeds a fresh demo." -ForegroundColor Green }
        else { Write-Host "No data to reset." }
    }
    default   { Get-Help $PSCommandPath -Detailed | Out-String | Write-Host }
}
