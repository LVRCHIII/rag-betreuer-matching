@echo off
chcp 65001 >nul
title BHT Betreuer-Matching – Installation
echo.
echo  ============================================
echo   BHT Betreuer-Matching – Installation
echo  ============================================
echo.

REM Zum Parent-Verzeichnis wechseln (Projektroot)
cd /d "%~dp0.."
echo [DEBUG] Aktuelles Verzeichnis: %cd%

REM Python prüfen
where python >nul 2>nul
if errorlevel 1 (
    echo [FEHLER] Python wurde nicht gefunden.
    echo Bitte Python 3.11+ von https://www.python.org/downloads/ installieren
    echo und dabei "Add Python to PATH" aktivieren.
    pause
    exit /b 1
)

echo [1/4] Virtuelle Umgebung wird erstellt...
if exist .venv (
    echo .venv existiert bereits, wird neu erstellt...
    rmdir /s /q .venv 2>nul
)
python -m venv .venv
if errorlevel 1 (
    echo [FEHLER] Virtuelle Umgebung konnte nicht erstellt werden.
    pause
    exit /b 1
)
echo [OK] .venv erstellt.

echo [2/4] Abhaengigkeiten werden installiert (das kann einige Minuten dauern)...
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo [FEHLER] Virtuelle Umgebung konnte nicht aktiviert werden.
    pause
    exit /b 1
)

python -m pip install --upgrade pip >nul 2>&1
pip install -r requirements.txt
if errorlevel 1 (
    echo [FEHLER] Installation der Abhaengigkeiten fehlgeschlagen.
    pause
    exit /b 1
)
echo [OK] Dependencies installiert.

echo [3/4] Konfiguration...
if not exist .env (
    copy .env.example .env >nul
    echo [OK] .env aus Vorlage erstellt.
)

echo [4/4] Desktop-Verknuepfung wird erstellt...
REM Desktop-Pfad ermitteln
for /f "tokens=*" %%A in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::GetFolderPath('Desktop')"') do set "DESKTOP=%%A"

REM Shortcut mit PowerShell erstellen
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP%\Betreuer-Matching.lnk'); $s.TargetPath = '%cd%\windows\start.bat'; $s.WorkingDirectory = '%cd%'; $s.Description = 'BHT Betreuer-Matching starten'; $s.Save(); Write-Host 'Shortcut erstellt: %DESKTOP%\Betreuer-Matching.lnk'"

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
