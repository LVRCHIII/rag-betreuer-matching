$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$venvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$sysPython = "python"

if (Test-Path $venvPython) {
    $pythonExe = $venvPython
} else {
    $pythonExe = $sysPython
}

Write-Host ""
Write-Host " BHT Betreuer-Matching wird gestartet..."
Write-Host " Browser oeffnet sich gleich unter http://localhost:8000"
Write-Host " Zum Beenden dieses Fenster schliessen (oder Strg+C)."
Write-Host ""

Start-Process "cmd" -ArgumentList "/c timeout /t 4 /nobreak >nul && start http://localhost:8000" -WindowStyle Hidden

& $pythonExe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
