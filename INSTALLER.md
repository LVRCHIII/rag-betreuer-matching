# Installer bauen – BHT Betreuer-Matching

Ziel: Eine **gebündelte Desktop-App** zum kinderleichten Download.
- **Windows:** `BetreuerMatching-Setup.exe` (Doppelklick → installiert → Desktop-Verknüpfung)
- **macOS:** `BetreuerMatching-Installer.dmg` (öffnen → App in „Programme" ziehen)

Beide enthalten Python, alle Abhängigkeiten und das fertige Frontend. Die App läuft
als **ein Prozess** und öffnet automatisch den Browser. Nutzer brauchen **nichts** außer
**Ollama** (lässt sich technisch nicht mit einbetten – separat installieren).

---

## Architektur der gebündelten App

- `launcher.py` ist der Entrypoint. Er legt einen beschreibbaren Daten-Ordner an
  (Windows `%LOCALAPPDATA%\BetreuerMatching`, macOS `~/Library/Application Support/BetreuerMatching`),
  startet das Backend und öffnet den Browser.
- Das Backend (`backend/main.py`) liefert seit dem Single-Origin-Umbau auch das
  **Frontend** (`frontend/dist`) aus – alles auf **einem Port** (Standard 8000, weicht bei
  Belegung automatisch aus).
- Daten (ChromaDB, Uploads, `settings.json`, `.env`, Embedding-Modell-Cache) liegen im
  User-Ordner, **nicht** im Installationsverzeichnis → funktioniert auch ohne Admin-Rechte.

Steuernde Umgebungsvariablen (setzt der Launcher automatisch):
| Variable | Zweck |
|---|---|
| `RAG_DATA_DIR` | beschreibbarer Daten-/Konfig-Ordner |
| `RAG_FRONTEND_DIR` | Pfad zum gebündelten Frontend |
| `HF_HOME` | Cache für das Embedding-Modell |

---

## Windows-Setup.exe bauen

Auf dem **Windows-PC**, einmalig die Build-Werkzeuge installieren:
```powershell
pip install -r build-requirements.txt
winget install JRSoftware.InnoSetup
```
Dann aus dem Projektstamm (venv aktiviert):
```powershell
.\installer\windows\build.ps1
```
Ablauf: Frontend bauen → PyInstaller friert App ein (`dist\BetreuerMatching\`) →
Inno Setup verpackt zu **`installer\output\BetreuerMatching-Setup.exe`**.

---

## macOS-.dmg bauen

Auf dem **MacBook**, einmalig:
```bash
pip install -r build-requirements.txt
brew install create-dmg
```
Dann aus dem Projektstamm (venv aktiviert):
```bash
bash installer/macos/build_dmg.sh
```
Ablauf: Frontend bauen → PyInstaller erzeugt `dist/Betreuer-Matching.app` →
create-dmg verpackt zu **`installer/output/BetreuerMatching-Installer.dmg`**.

> Die `.dmg` muss **auf macOS** gebaut werden – `create-dmg` läuft nicht unter Windows.
> Ein auf Windows gebautes Bundle läuft umgekehrt auch nur auf Windows. Also je App auf
> der jeweiligen Plattform bauen.

---

## Embedding-Modell & App-Icon (in den Build-Skripten enthalten)

- **Embedding-Modell ist eingebettet:** `installer/download_model.py` lädt
  `intfloat/multilingual-e5-small` (~470 MB, nur safetensors) nach
  `installer/model_cache/`. Die Spec bündelt es mit, der Launcher setzt im
  gebündelten Betrieb `EMBEDDING_MODEL` auf den mitgelieferten Pfad und
  `HF_HUB_OFFLINE=1` → **der erste Upload funktioniert ohne Internet**.
  Die Build-Skripte rufen den Download automatisch auf (überspringen, wenn vorhanden).
- **App-Icon:** `installer/make_icon.py` erzeugt das (Platzhalter-)Icon –
  schwarze Salamander-Silhouette auf Orange – als `installer/windows/app.ico` und
  `installer/macos/app.icns`. Ein echtes designtes Icon einfach unter denselben
  Dateinamen ablegen (oder `icon_source.png` ersetzen und Skript neu laufen lassen).

## Optional: noch reibungsloser

- **Code-Signing/Notarisierung:** Unsignierte Apps lösen Warnungen aus
  (Windows SmartScreen, macOS Gatekeeper). Für eine echte Verteilung signieren
  (`create-dmg` und Inno Setup unterstützen Signaturen).
- **Ollama-Modell automatisch ziehen:** Der Launcher zeigt nur einen Hinweis. Optional
  könnte er nach erkanntem Ollama `ollama pull llama3` selbst anstoßen.

---

## Troubleshooting (Build)

| Problem | Ursache | Lösung |
|---|---|---|
| `ModuleNotFoundError` beim Start der .exe (z.B. `datasets`, `langchain_core`) | Paket wird vom Backend eager importiert, war aber in `excludes` | Aus `excludes` entfernen und in `_collect` der Spec aufnehmen |
| Inno Setup: „The system cannot find the path specified" beim Komprimieren von `torch\...` | Windows MAX_PATH (260 Zeichen) – langer Projektpfad + `..\..` + tiefe torch-Dateien | `build.ps1` übergibt `DistDir` als absoluten Pfad (kein `..\..`). Manuell: `iscc /DDistDir=<abs>\dist\BetreuerMatching ...` |
| `iscc` nicht gefunden | winget legt es unter `%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe` ab | Diesen Pfad nutzen (build.ps1 sucht ihn automatisch) |
| Erster Start der App dauert | PyInstaller entpackt + lädt torch/transformers | Normal (~10–20 s beim ersten Start) |

## Bekannte Grenzen

- **Ollama bleibt separat.** Es ist eine eigenständige Anwendung (mit GPU-Treibern) und
  kann nicht in die App eingebettet werden. Installer/Launcher weisen darauf hin.
- **Bundle-Größe** ~1–2 GB (PyTorch CPU + Transformers). Das ist normal für lokale KI-Apps.
- **RAGAS-Evaluierung** ist im Bundle bewusst ausgeschlossen (Entwickler-Werkzeug). Im
  Repo-Betrieb weiterhin verfügbar.
