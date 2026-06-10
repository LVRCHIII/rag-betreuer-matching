# Setup-Anleitung – BHT Betreuer-Matching RAG System

> Windows-PC mit RTX 5070 Ti (CUDA), Claude Code installiert.

---

## 1. Voraussetzungen installieren

### Python 3.11
1. Öffne [python.org/downloads](https://www.python.org/downloads/) und lade Python **3.11.x** herunter
2. Installer starten – **wichtig:** "Add Python to PATH" anhaken
3. Prüfen: `python --version` im Terminal → muss `3.11.x` zeigen

### Node.js (für Frontend)
1. Öffne [nodejs.org](https://nodejs.org/) und lade die LTS-Version herunter
2. Installer durchklicken
3. Prüfen: `node --version` → muss `v18+` zeigen

### Ollama (LLM lokal auf GPU)
1. Öffne [ollama.com/download](https://ollama.com/download) und lade Ollama für Windows herunter
2. Installieren – Ollama läuft dann automatisch im Hintergrund
3. Modell herunterladen (einmalig, lädt einige GB):
   ```
   ollama pull llama3
   ```
4. Prüfen: `ollama list` → zeigt `llama3`

### Git
1. Öffne [git-scm.com](https://git-scm.com/download/win) und installiere Git
2. Prüfen: `git --version`

---

## 2. Projekt klonen

```bash
git clone https://github.com/lucasbruhn/rag-betreuer-matching.git
cd rag-betreuer-matching
```

---

## 3. Backend einrichten

```bash
# Virtualenv erstellen (Python 3.11)
python -m venv .venv

# Aktivieren (Windows)
.venv\Scripts\activate

# Abhängigkeiten installieren
pip install -r requirements.txt
```

> Beim ersten Start lädt `sentence-transformers` das Embedding-Modell herunter (~500 MB). Das passiert automatisch.

### .env konfigurieren

```bash
copy .env.example .env
```

Die `.env` muss nichts geändert werden – Standardwerte funktionieren mit Ollama auf localhost.

---

## 4. Frontend einrichten

```bash
cd frontend
npm install
cd ..
```

---

## 5. Starten

Zwei Terminals öffnen:

**Terminal 1 – Backend:**
```bash
cd rag-betreuer-matching
.venv\Scripts\activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 – Frontend:**
```bash
cd rag-betreuer-matching\frontend
npm run dev
```

Danach im Browser öffnen: **http://localhost:5174**

---

## 6. Erste Nutzung

1. **Collections erstellen** → Seite "Collections" → z.B. `lehrenden_profile`, `modulhandbuecher`
2. **Dateien hochladen** → Seite "Upload" → Collection auswählen → PDF/XLSX hochladen
3. **Chatten** → Seite "Chat" → gewünschte Collections auswählen → Frage stellen

---

## 7. Von außen erreichbar machen (optional)

### ngrok
```bash
# ngrok installieren: https://ngrok.com/download
ngrok http 5174
```
→ Gibt eine öffentliche URL aus, z.B. `https://abc123.ngrok.io`

### Tailscale (empfohlen für dauerhaften Zugriff)
1. [tailscale.com](https://tailscale.com) → kostenlos registrieren
2. Tailscale auf Windows-PC und MacBook installieren
3. Beide einloggen → automatisch im gleichen privaten Netzwerk
4. Auf dem PC die IP herausfinden: `tailscale ip`
5. Vom Mac aus erreichbar unter `http://<tailscale-ip>:5174`

---

## 8. Mit Claude Code weiterentwickeln

```bash
cd rag-betreuer-matching
claude
```

Claude Code liest die `CLAUDE.md` im Projektverzeichnis und kennt die gesamte Architektur.

---

## Fehlerbehebung

| Problem | Lösung |
|---|---|
| `ollama: command not found` | Ollama neu starten oder PATH prüfen |
| Embedding-Modell lädt ewig | Einmalig beim ersten Start normal (~500 MB) |
| `CUDA out of memory` | Kleineres Modell wählen: `ollama pull mistral` |
| Port 8000 belegt | `.env` → `PORT=8001` ändern |
| ChromaDB-Fehler | `data/chroma/` löschen und neu indexieren |
