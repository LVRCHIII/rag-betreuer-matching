# SETUP – BHT Betreuer-Matching RAG System

> Zielgerät: Windows-PC mit NVIDIA RTX 5070 Ti, AMD Ryzen 7, 32 GB RAM, Windows 11.
> Diese Anleitung ist vollständig – kein Vorwissen nötig. Claude Code kann sie Schritt für Schritt ausführen.

---

## Schnellinstallation (empfohlen)

Statt der manuellen Schritte unten gibt es jetzt eine Ein-Klick-Installation:

1. **Python 3.11** und **Ollama** installieren (siehe Schritt 0), dann `ollama pull llama3.1:8b`.
2. Projektordner auf den Windows-PC kopieren (das Frontend ist bereits gebaut, `frontend/dist/` muss mitkopiert werden – Node.js wird auf dem Windows-PC **nicht** benötigt).
3. Doppelklick auf **`windows\install.bat`** – erstellt die virtuelle Umgebung, installiert alle Abhängigkeiten und legt eine Desktop-Verknüpfung **"Betreuer-Matching"** an.
4. Starten per Doppelklick auf die Desktop-Verknüpfung (oder `windows\start.bat`). Der Browser öffnet sich automatisch unter http://localhost:8000 – Backend und Frontend laufen als ein Prozess.

Nach Code-Änderungen am Frontend einmal `npm run build` in `frontend/` ausführen, damit `frontend/dist/` aktuell ist.

---

## Schritt 0 – Einmalig: Software installieren

Diese vier Programme müssen vorhanden sein, bevor der Rest läuft.
Alles prüfen mit den Befehlen in Klammern – wenn kein Fehler kommt, ist es installiert.

### Python 3.11 (WICHTIG: genau 3.11, nicht 3.12 oder neuer)

> Warum 3.11? Das Paket `tokenizers` (Teil von sentence-transformers) hat noch keine
> vorgebauten Wheels für Python 3.12+. Mit Python 3.12+ schlägt `pip install` fehl.

1. Öffne https://www.python.org/downloads/release/python-3119/ (Python 3.11.9)
2. Lade "Windows installer (64-bit)" herunter
3. Installer starten → **"Add Python 3.11 to PATH" anhaken** → Install Now
4. Prüfen: `python --version` → muss `Python 3.11.x` zeigen

### Node.js 20 LTS (für Frontend)

1. Öffne https://nodejs.org/ → "LTS" herunterladen
2. Installer durchklicken (alles Standard)
3. Prüfen: `node --version` → muss `v20.x.x` zeigen

### Ollama (LLM lokal auf GPU)

1. Öffne https://ollama.com/download → Windows herunterladen
2. Installer ausführen – Ollama startet automatisch im Hintergrund
3. Im Terminal: Modell herunterladen (einmalig ~4 GB, nutzt GPU automatisch):
   ```
   ollama pull llama3
   ```
4. Prüfen: `ollama list` → zeigt `llama3`

### Git

1. Öffne https://git-scm.com/download/win → Download starten
2. Installer durchklicken (alles Standard)
3. Prüfen: `git --version`

---

## Schritt 1 – Projekt klonen

```bash
git clone https://github.com/LVRCHIII/rag-betreuer-matching.git
cd rag-betreuer-matching
```

---

## Schritt 2 – Backend einrichten

```bash
# Virtualenv mit Python 3.11 erstellen
python -m venv .venv

# Aktivieren (Windows CMD/PowerShell)
.venv\Scripts\activate

# Abhängigkeiten installieren (dauert 2–5 Minuten beim ersten Mal)
pip install -r requirements.txt
```

**Was passiert hier?** pip installiert FastAPI, ChromaDB, sentence-transformers und alle
weiteren Abhängigkeiten. Beim allerersten Start des Backends lädt sentence-transformers
außerdem das Embedding-Modell `intfloat/multilingual-e5-small` herunter (~500 MB).

### .env erstellen

```bash
copy .env.example .env
```

Die Standardwerte in `.env` funktionieren direkt – nichts muss geändert werden,
solange Ollama auf localhost:11434 läuft (das ist der Standard).

### Datenverzeichnisse anlegen

```bash
mkdir data\uploads
mkdir data\chroma
```

---

## Schritt 3 – Frontend einrichten

```bash
cd frontend
npm install
cd ..
```

---

## Schritt 4 – Starten

**Zwei Terminals öffnen** (z.B. zwei PowerShell-Fenster):

**Terminal 1 – Backend:**
```bash
cd rag-betreuer-matching
.venv\Scripts\activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
→ Erfolgreich wenn du siehst: `Application startup complete.`

**Terminal 2 – Frontend:**
```bash
cd rag-betreuer-matching\frontend
npm run dev
```
→ Erfolgreich wenn du siehst: `Local: http://localhost:5174/`

**Im Browser öffnen: http://localhost:5174**

---

## Schritt 5 – Erste Nutzung

1. **Collections erstellen** → Seite "Collections" → Namen eingeben (z.B. `lehrenden_profile`) → "Erstellen"
2. **Dateien hochladen** → Seite "Upload" → Collection auswählen → PDF oder XLSX reinziehen → "Alle hochladen"
   - Beim ersten Upload: Embedding-Modell wird heruntergeladen (~500 MB, einmalig)
3. **Chatten** → Seite "Chat" → Collections oben auswählen → Frage eingeben → Enter

---

## Schritt 6 – Von außen erreichbar machen (optional)

### Tailscale (empfohlen – kostenlos, kein Port-Forwarding nötig)

1. https://tailscale.com → kostenlos registrieren
2. Tailscale auf Windows-PC UND MacBook installieren und mit dem gleichen Account einloggen
3. Beide Geräte erscheinen automatisch im gleichen privaten Netzwerk
4. IP des PCs herausfinden: `tailscale ip -4`
5. Vom MacBook aus erreichbar unter `http://<tailscale-ip>:5174`

### ngrok (schnelle Einmal-Lösung)

```bash
# ngrok installieren: https://ngrok.com/download
ngrok http 5174
```
→ Gibt eine temporäre öffentliche URL aus, z.B. `https://abc123.ngrok.io`

---

## Schritt 7 – Mit Claude Code weiterentwickeln

```bash
cd rag-betreuer-matching
claude
```

Claude Code liest automatisch `CLAUDE.md` – darin steht die gesamte Architektur,
der Tech Stack, alle API-Endpunkte und die Designprinzipien des Projekts.

---

## Fehlerbehebung

| Problem | Ursache | Lösung |
|---|---|---|
| `pip install` schlägt fehl bei `tokenizers` | Python-Version zu neu (3.12+) | Python 3.11 installieren, `.venv` neu erstellen |
| `uvicorn: command not found` | venv nicht aktiviert | `.venv\Scripts\activate` ausführen |
| Backend startet, aber Embedding dauert ewig | Modell wird erstmalig heruntergeladen | Warten (~500 MB), passiert nur einmal |
| `CUDA out of memory` beim Chat | LLM-Modell zu groß | Kleineres Modell: `ollama pull mistral` → in Settings auswählen |
| Ollama antwortet nicht | Ollama läuft nicht | Ollama-App starten oder `ollama serve` im Terminal |
| Port 8000 schon belegt | Anderer Prozess | `.env` → `PORT=8001`, dann Backend neu starten |
| ChromaDB-Fehler beim Start | Beschädigte Datenbank | `data\chroma\` löschen, Dateien neu hochladen |
| Frontend zeigt nichts | Backend nicht erreichbar | Prüfen ob Backend auf Port 8000 läuft: http://localhost:8000/api/health |
