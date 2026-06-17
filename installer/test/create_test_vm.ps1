# Erstellt eine saubere Windows-11-Test-VM in VirtualBox, um die Setup.exe
# wie ein echter Endnutzer zu installieren (kein Python/Node in der VM).
#
# Voraussetzung: Windows-11-ISO herunterladen (siehe installer/test/README.md)
#
# Aufruf:
#   .\installer\test\create_test_vm.ps1 -IsoPath "C:\Pfad\zu\Win11.iso"
#
# Danach: VM startet, Windows installieren, dann in der VM
# "Geräte -> Gasterweiterungen einlegen" installieren -> der Ordner mit der
# Setup.exe erscheint als Netzlaufwerk (Shared Folder "RAGsetup").

param(
    [Parameter(Mandatory = $true)][string]$IsoPath,
    [string]$VMName = "RAG-Test",
    [int]$CpuCount = 4,
    [int]$MemoryMB = 8192,
    [int]$DiskGB = 60
)

$ErrorActionPreference = "Stop"
$VBoxManage = "$env:ProgramFiles\Oracle\VirtualBox\VBoxManage.exe"
if (-not (Test-Path $VBoxManage)) { throw "VBoxManage nicht gefunden: $VBoxManage" }
if (-not (Test-Path $IsoPath)) { throw "ISO nicht gefunden: $IsoPath" }

$Root = (Resolve-Path "$PSScriptRoot\..\..").Path
$SetupDir = Join-Path $Root "installer\output"
if (-not (Test-Path $SetupDir)) { New-Item -ItemType Directory -Force -Path $SetupDir | Out-Null }

$vmFolder = (& $VBoxManage list systemproperties | Select-String "Default machine folder" ).ToString().Split(":", 2)[1].Trim()
$disk = Join-Path (Join-Path $vmFolder $VMName) "$VMName.vdi"

Write-Host "==> Lege VM '$VMName' an (Windows 11, ${CpuCount} CPU, ${MemoryMB} MB, ${DiskGB} GB)" -ForegroundColor Cyan

# evtl. alte VM gleichen Namens entfernen
$existing = & $VBoxManage list vms | Select-String "`"$VMName`""
if ($existing) {
    Write-Host "   (vorhandene VM '$VMName' wird entfernt)"
    & $VBoxManage controlvm $VMName poweroff 2>$null
    Start-Sleep -Seconds 2
    & $VBoxManage unregistervm $VMName --delete 2>$null
}

& $VBoxManage createvm --name $VMName --ostype Windows11_64 --register | Out-Null
& $VBoxManage modifyvm $VMName --cpus $CpuCount --memory $MemoryMB --vram 128 `
    --firmware efi --graphicscontroller vboxsvga --audio-driver none `
    --usbohci on --nic1 nat
# Windows-11-Pflicht: TPM 2.0 (+ Secure Boot, falls unterstützt)
& $VBoxManage modifyvm $VMName --tpm-type 2.0
try { & $VBoxManage modifyvm $VMName --secure-boot on 2>$null } catch {}

# Festplatte
& $VBoxManage createmedium disk --filename $disk --size ($DiskGB * 1024) --format VDI | Out-Null
& $VBoxManage storagectl $VMName --name "SATA" --add sata --controller IntelAhci --portcount 2 | Out-Null
& $VBoxManage storageattach $VMName --storagectl "SATA" --port 0 --device 0 --type hdd --medium $disk | Out-Null

# Windows-ISO als DVD
& $VBoxManage storageattach $VMName --storagectl "SATA" --port 1 --device 0 --type dvddrive --medium $IsoPath | Out-Null

# Shared Folder mit der Setup.exe (erscheint nach Gasterweiterungen als Netzlaufwerk)
& $VBoxManage sharedfolder add $VMName --name "RAGsetup" --hostpath $SetupDir --automount | Out-Null

Write-Host "==> VM angelegt. Setup.exe liegt im Shared Folder: $SetupDir" -ForegroundColor Green
Write-Host "==> Starte VM ..." -ForegroundColor Cyan
& $VBoxManage startvm $VMName --type gui

Write-Host ""
Write-Host "Nächste Schritte IN der VM:" -ForegroundColor Yellow
Write-Host "  1. Windows 11 installieren (ohne Produktschlüssel -> 'Ich habe keinen Key')."
Write-Host "     MS-Konto-Zwang umgehen: bei der Netzwerk-Abfrage Shift+F10 -> 'OOBE\BYPASSNRO' -> Enter (Neustart),"
Write-Host "     danach 'Ich habe kein Internet' wählen."
Write-Host "  2. Nach dem Desktop: Menü 'Geräte -> Gasterweiterungen einlegen...' -> in der VM installieren -> Neustart."
Write-Host "  3. Im Explorer erscheint Netzlaufwerk mit 'BetreuerMatching-Setup.exe' -> ausführen -> installieren -> starten."
Write-Host "  4. Für KI-Antworten in der VM zusätzlich Ollama installieren (ollama.com) + 'ollama pull llama3'."
