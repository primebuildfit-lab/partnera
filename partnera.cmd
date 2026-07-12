@echo off
REM Partnera launcher shortcut. Examples:
REM   partnera install
REM   partnera start
REM   partnera status
REM   partnera stop
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\partnera.ps1" %*
