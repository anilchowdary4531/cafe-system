@echo off
setlocal

rem Windows helper for machines where PowerShell blocks npm.ps1.
rem Usage:
rem   backend\dev.cmd

cd /d "%~dp0"

echo Starting backend (nodemon)...
echo If you see "EADDRINUSE", change PORT in backend\.env or stop the other process on that port.
echo.

npm.cmd run dev
