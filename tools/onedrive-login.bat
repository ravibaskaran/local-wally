@echo off
setlocal
cd /d "%~dp0"
echo.
echo ========================================================
echo  Local Wally - OneDrive Sign-In Helper (PowerShell)
echo ========================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0onedrive-login.ps1"
pause
