@echo off
chcp 65001 >nul
title BHT Betreuer-Matching
cd /d "%~dp0.."

if not exist .venv\Scripts\activate.bat (
    echo [FEHLER] Keine Installation gefunden. Bitte zuerst windows\install.bat ausfuehren.
    pause
    exit /b 1
)

call .venv\Scripts\activate.bat

echo.
echo  BHT Betreuer-Matching wird gestartet...
echo  Browser oeffnet sich gleich unter http://localhost:8000
echo  Zum Beenden dieses Fenster schliessen (oder Strg+C).
echo.

start "" /b cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:8000"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
pause
