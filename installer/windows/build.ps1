# Build-Skript: erzeugt die Windows-Setup.exe (komplett gebündelt).
# Auf dem Windows-PC im aktivierten venv aus dem Projektstamm ausführen:
#     .\installer\windows\build.ps1
#
# Voraussetzungen (einmalig):
#     pip install -r build-requirements.txt
#     winget install JRSoftware.InnoSetup
#     (Node.js für den Frontend-Build)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $Root

Write-Host "==> [1/4] Embedding-Modell + Icon vorbereiten" -ForegroundColor Cyan
python installer\download_model.py
if (-not (Test-Path "$Root\installer\windows\app.ico")) { python installer\make_icon.py }

Write-Host "==> [2/4] Frontend bauen" -ForegroundColor Cyan
Push-Location frontend
npm install
npm run build
Pop-Location

Write-Host "==> [3/4] App einfrieren (PyInstaller)" -ForegroundColor Cyan
# Saubere Ausgabe
if (Test-Path "$Root\dist\BetreuerMatching") { Remove-Item "$Root\dist\BetreuerMatching" -Recurse -Force }
pyinstaller installer\launcher.spec --noconfirm --distpath "$Root\dist" --workpath "$Root\build\pyi"

Write-Host "==> [4/4] Installer kompilieren (Inno Setup)" -ForegroundColor Cyan
$iscc = (Get-Command iscc -ErrorAction SilentlyContinue).Source
if (-not $iscc) {
    $candidate = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
    if (Test-Path $candidate) { $iscc = $candidate }
}
if (-not $iscc) {
    $candidate2 = "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
    if (Test-Path $candidate2) { $iscc = $candidate2 }
}
if (-not $iscc) {
    Write-Host "[FEHLER] Inno Setup (iscc) nicht gefunden. Installieren mit: winget install JRSoftware.InnoSetup" -ForegroundColor Red
    exit 1
}
New-Item -ItemType Directory -Force -Path "$Root\installer\output" | Out-Null
# DistDir als ABSOLUTEN Pfad übergeben – vermeidet "..\.."-Einschübe, die unter
# Windows das MAX_PATH-Limit (260) bei tiefen torch-Dateien sprengen.
& $iscc "/DDistDir=$Root\dist\BetreuerMatching" installer\windows\installer.iss

Write-Host ""
Write-Host "FERTIG. Setup liegt unter: installer\output\BetreuerMatching-Setup.exe" -ForegroundColor Green
