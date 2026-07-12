<#
    Partnera local launcher (Windows PowerShell).

    Manage the local Partnera app. Everything runs locally - no external service
    is contacted. Data, logs, and the PID live under .partnera/ at the repo root.

    ASCII-only source on purpose: Windows PowerShell 5.1 reads a .ps1 as ANSI
    when there is no BOM, so any non-ASCII byte can break parsing. Keep it ASCII.

    Usage:
        .\scripts\partnera.ps1 <command>

    Commands:
        install          Install dependencies and build the app
        start            Start the app in the background (builds first if needed)
        open             Start (if needed) and open the app in your browser
        stop             Stop the running app (state is saved)
        restart          Stop then start
        status           Show whether the app is running and where
        update           Rebuild from local source (reinstall + build); restarts if running
        logs             Show recent server output
        reset            Delete local data (next start seeds a fresh demo)
        install-desktop  Create Desktop + Start Menu shortcuts (with icon)
        remove-desktop   Remove those shortcuts
        help             Show this help
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
$IconFile = Join-Path $Root "assets\partnera.ico"
if ($env:PARTNERA_PORT) { $Port = $env:PARTNERA_PORT } else { $Port = "4000" }
$AppUrl = "http://localhost:$Port"

function Ensure-DataDir { if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir | Out-Null } }

function Assert-Prereqs {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: Node.js is not installed or not on PATH." -ForegroundColor Red
        Write-Host "       Install Node.js 20+ from https://nodejs.org and try again."
        exit 3
    }
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: pnpm is not installed or not on PATH." -ForegroundColor Red
        Write-Host "       Install it with:  npm i -g pnpm@9"
        exit 3
    }
}

function Get-RunningPid {
    if (-not (Test-Path $PidFile)) { return $null }
    $storedPid = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if (-not $storedPid) { return $null }
    if (Get-Process -Id $storedPid -ErrorAction SilentlyContinue) { return $storedPid }
    return $null
}

function Invoke-Build {
    Assert-Prereqs
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    & pnpm install
    if ($LASTEXITCODE -ne 0) { Write-Host "Install failed." -ForegroundColor Red; exit 4 }
    Write-Host "Building..." -ForegroundColor Cyan
    & pnpm --filter "@partnera/web" build
    if ($LASTEXITCODE -ne 0) { Write-Host "Build failed." -ForegroundColor Red; exit 4 }
    & pnpm --filter "@partnera/web" bundle
    if ($LASTEXITCODE -ne 0) { Write-Host "Bundle failed." -ForegroundColor Red; exit 4 }
}

function Start-App {
    $running = Get-RunningPid
    if ($running) { Write-Host "Already running (PID $running) at $AppUrl" -ForegroundColor Yellow; return }
    Assert-Prereqs
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
        Write-Host "Partnera started at $AppUrl  (PID $($proc.Id))" -ForegroundColor Green
        Write-Host "  Sign in: owner@primebuild.test | brian@primebuild.test | admin@partnera.test"
        Write-Host "  Data:    $DataFile"
    } else {
        Write-Host "Failed to start. Recent errors:" -ForegroundColor Red
        if (Test-Path $ErrFile) { Get-Content $ErrFile -Tail 20 }
        exit 5
    }
}

function Wait-ForApp {
    for ($i = 0; $i -lt 40; $i++) {
        try {
            $r = Invoke-WebRequest -Uri "$AppUrl/login" -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200) { return $true }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Open-App {
    Start-App
    Write-Host "Waiting for the app to be ready..." -ForegroundColor Cyan
    if (Wait-ForApp) {
        Start-Process $AppUrl
        Write-Host "Opened $AppUrl in your browser." -ForegroundColor Green
    } else {
        Write-Host "The app did not respond in time. Check logs:" -ForegroundColor Red
        if (Test-Path $ErrFile) { Get-Content $ErrFile -Tail 20 }
        exit 5
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
        Write-Host "  URL:  $AppUrl"
        Write-Host "  PID:  $running"
    } else {
        Write-Host "Partnera: STOPPED" -ForegroundColor Yellow
    }
    if (Test-Path $DataFile) { $dataState = "exists" } else { $dataState = "none - first run will seed demo" }
    if (Test-Path $Bundle) { $builtState = "yes" } else { $builtState = "no - run install" }
    Write-Host "  Data:  $DataFile  ($dataState)"
    Write-Host "  Built: $builtState"
    Write-Host "  Node:  $( if (Get-Command node -ErrorAction SilentlyContinue) { (& node --version) } else { 'not found' } )"
}

function Ensure-Icon {
    if (-not (Test-Path $IconFile)) {
        Write-Host "Generating application icon..." -ForegroundColor Cyan
        & (Join-Path $PSScriptRoot "make-icon.ps1")
    }
}

function New-AppShortcut([string]$LinkPath) {
    $shell = New-Object -ComObject WScript.Shell
    $sc = $shell.CreateShortcut($LinkPath)
    $sc.TargetPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    $sc.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" open"
    $sc.WorkingDirectory = $Root
    $sc.IconLocation = "$IconFile,0"
    $sc.Description = "Partnera - local affiliate, referral and partnership platform"
    $sc.WindowStyle = 1
    $sc.Save()
}

function Install-Desktop {
    Ensure-Icon
    $desktop = Join-Path ([Environment]::GetFolderPath("Desktop")) "Partnera.lnk"
    $programs = [Environment]::GetFolderPath("Programs")
    $startLink = Join-Path $programs "Partnera.lnk"
    New-AppShortcut $desktop
    New-AppShortcut $startLink
    Write-Host "Desktop and Start Menu shortcuts created:" -ForegroundColor Green
    Write-Host "  $desktop"
    Write-Host "  $startLink"
    Write-Host "Double-click 'Partnera' to launch."
}

function Remove-Desktop {
    $desktop = Join-Path ([Environment]::GetFolderPath("Desktop")) "Partnera.lnk"
    $startLink = Join-Path ([Environment]::GetFolderPath("Programs")) "Partnera.lnk"
    foreach ($p in @($desktop, $startLink)) {
        if (Test-Path $p) { Remove-Item $p -Force; Write-Host "Removed $p" -ForegroundColor Green }
    }
    Write-Host "Shortcuts removed. (Local data under .partnera/ was left intact.)"
}

try {
    switch ($Command.ToLower()) {
        "install"         { Invoke-Build; Write-Host "Done. Start with: .\scripts\partnera.ps1 open" -ForegroundColor Green }
        "start"           { Start-App }
        "open"            { Open-App }
        "stop"            { Stop-App }
        "restart"         { Stop-App; Start-Sleep -Seconds 1; Start-App }
        "status"          { Show-Status }
        "update"          {
            $wasRunning = [bool](Get-RunningPid)
            if ($wasRunning) { Stop-App }
            Invoke-Build
            Write-Host "Updated (rebuilt from local source)." -ForegroundColor Green
            if ($wasRunning) { Start-App }
        }
        "logs"            {
            if (Test-Path $LogFile) { Get-Content $LogFile -Tail 40 } else { Write-Host "No logs yet." }
            if ((Test-Path $ErrFile) -and (Get-Item $ErrFile).Length -gt 0) { Write-Host "--- errors ---" -ForegroundColor Red; Get-Content $ErrFile -Tail 20 }
        }
        "reset"           {
            Stop-App
            if (Test-Path $DataFile) { Remove-Item $DataFile -Force; Write-Host "Local data deleted. Next start seeds a fresh demo." -ForegroundColor Green }
            else { Write-Host "No data to reset." }
        }
        "install-desktop" { Install-Desktop }
        "remove-desktop"  { Remove-Desktop }
        default           { Get-Help $PSCommandPath -Detailed | Out-String | Write-Host }
    }
    exit 0
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
