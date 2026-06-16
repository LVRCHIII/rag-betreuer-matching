@echo off
chcp 65001 >nul
title BHT Betreuer-Matching – Installation
echo.
echo  ============================================
echo   BHT Betreuer-Matching – Installation
echo  ============================================
echo.

cd /d "%~dp0.."

where python >nul 2>nul
if errorlevel 1 (
    echo [FEHLER] Python wurde nicht gefunden.
    echo Bitte Python 3.11+ von https://www.python.org/downloads/ installieren
    echo und dabei "Add Python to PATH" aktivieren.
    pause
    exit /b 1
)

echo [1/4] Virtuelle Umgebung wird erstellt...
if not exist .venv (
    python -m venv .venv
)

echo [2/4] Abhaengigkeiten werden installiert (das kann einige Minuten dauern)...
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip >nul
pip install -r requirements.txt
if errorlevel 1 (
    echo [FEHLER] Installation der Abhaengigkeiten fehlgeschlagen.
    pause
    exit /b 1
)

echo [3/4] Konfiguration...
if not exist .env (
    copy .env.example .env >nul
    echo .env aus Vorlage erstellt.
)

echo [4/4] Desktop-Verknuepfung wird erstellt...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Betreuer-Matching.lnk'); ^
   $s.TargetPath = '%~dp0start.bat'; ^
   $s.WorkingDirectory = '%~dp0'; ^
   $s.Description = 'BHT Betreuer-Matching starten'; ^
   $s.Save()"

echo.
echo  ============================================
echo   Installation abgeschlossen!
echo.
echo   Starten: Doppelklick auf "Betreuer-Matching"
echo   auf dem Desktop (oder windows\start.bat).
echo.
echo   Hinweis: Ollama muss separat installiert
echo   sein (https://ollama.com) und ein Modell
echo   geladen, z.B.:  ollama pull llama3
echo  ============================================
echo.
pause
