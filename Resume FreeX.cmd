@echo off
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"

where code >nul 2>nul
if %ERRORLEVEL%==0 (
    start "" code "%ROOT%."
) else (
    echo VS Code CLI not found in PATH - skipping editor launch.
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\resume-freex.ps1"

echo.
echo Press any key to close this window...
pause >nul
