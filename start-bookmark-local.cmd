@echo off
setlocal
title Bookmark Local Launcher

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%scripts\start-bookmark-local.ps1"
set "PW7=C:\Program Files\PowerShell\7\pwsh.exe"

if not exist "%PS_SCRIPT%" (
  echo.
  echo [bookmark] PowerShell launcher script not found:
  echo %PS_SCRIPT%
  echo.
  pause
  exit /b 1
)

if exist "%PW7%" (
  "%PW7%" -ExecutionPolicy Bypass -NoExit -File "%PS_SCRIPT%"
  exit /b %ERRORLEVEL%
)

powershell.exe -ExecutionPolicy Bypass -NoExit -File "%PS_SCRIPT%"
if errorlevel 1 (
  echo.
  echo [bookmark] local launcher exited with an error.
  pause
)

exit /b %ERRORLEVEL%
