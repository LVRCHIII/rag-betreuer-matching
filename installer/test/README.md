# Saubere Install-Tests in einer Windows-11-VM (VirtualBox)

Ziel: Die `BetreuerMatching-Setup.exe` wie ein echter Endnutzer in einem
**frischen Windows ohne Python/Node** installieren und starten.

## Schritte

### 1. VirtualBox (einmalig)
Bereits installiert via `winget install Oracle.VirtualBox` (VBoxManage 7.x).

### 2. Windows-11-ISO herunterladen
- https://www.microsoft.com/de-de/software-download/windows11 → Abschnitt
  **„Datenträgerabbild (ISO) für Windows 11 herunterladen"** → Edition wählen →
  Sprache → 64-Bit-Download (~6 GB).
- Kein Produktschlüssel nötig: Windows läuft im Testmodus (nur Wasserzeichen).

### 3. Test-VM anlegen + starten
```powershell
.\installer\test\create_test_vm.ps1 -IsoPath "C:\Users\Lucas\Downloads\Win11.iso"
```
Legt eine VM `RAG-Test` an (EFI + TPM 2.0, 4 CPU, 8 GB RAM, 60 GB Disk), bindet die
ISO ein und teilt `installer/output` als Shared Folder (enthält die Setup.exe).

### 4. In der VM
1. **Windows 11 installieren** – „Ich habe keinen Product Key", Edition „Home" oder „Pro".
   - MS-Konto-Zwang umgehen: bei der Netzwerkabfrage `Shift+F10` → `OOBE\BYPASSNRO`
     → Enter (Neustart) → „Ich habe kein Internet" → „Eingeschränkt fortfahren".
2. Am Desktop: VirtualBox-Menü **„Geräte → Gasterweiterungen einlegen…"** →
   in der VM installieren → Neustart. (Aktiviert Shared Folder + Drag&Drop.)
3. Im Explorer erscheint das Netzlaufwerk mit **`BetreuerMatching-Setup.exe`** →
   ausführen → installieren → über Startmenü/Desktop starten.
4. Optional für echte KI-Antworten: **Ollama** in der VM installieren
   (https://ollama.com) + `ollama pull llama3`. (Ohne Ollama startet die App
   trotzdem; sie zeigt nur einen Hinweis und kann keine LLM-Antworten geben.)

## Worauf beim Test achten
- [ ] Setup.exe läuft ohne Fehler durch, Verknüpfungen werden angelegt.
- [ ] App startet per Doppelklick, Browser öffnet sich automatisch auf `localhost:8000`.
- [ ] **Kein Python/Node nötig** – die App läuft eigenständig.
- [ ] Datenordner unter `%LOCALAPPDATA%\BetreuerMatching` wird angelegt.
- [ ] Ein Datei-Upload funktioniert (Embedding-Modell ist eingebettet → offline OK).
- [ ] Keine fehlenden System-DLLs (z. B. VC++-Runtime) – würde sich hier zeigen.

## Aufräumen
```powershell
& "$env:ProgramFiles\Oracle\VirtualBox\VBoxManage.exe" unregistervm "RAG-Test" --delete
```
