@echo off
REM Partnera local launcher (cmd wrapper). Double-clickable or: scripts\partnera.cmd start
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0partnera.ps1" %*
