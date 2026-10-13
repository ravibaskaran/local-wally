@echo off
title Local Wally Updater
echo.
echo  Local Wally - one-click updater
echo  ===============================
echo.
echo  Fetching the latest updater script...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}; $s = Join-Path $env:TEMP 'lw-upgrade.ps1'; try { Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/ravibaskaran/local-wally/main/tools/updater/upgrade-local-wally.ps1' -OutFile $s } catch { Write-Host 'Could not reach GitHub - check your internet connection.' -ForegroundColor Yellow; exit 1 }; & $s"
if errorlevel 1 echo. & echo  Updater did not complete - see the messages above.
echo.
pause
