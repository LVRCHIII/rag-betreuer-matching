# CLAUDE.md – RAG Betreuer-Matching System (BHT)

> Dieses Dokument ist die primäre Referenz für Claude Code bei der Entwicklung
> des eigenen RAG-Systems für das Betreuer-Matching-Projekt der BHT (Gruppe 02).
> Lies dieses Dokument vollständig, bevor du Code schreibst oder Entscheidungen triffst.

---

## 1. Projektkontext

**Was wird gebaut?**
Ein eigenes, lokal betriebenes RAG-System (Retrieval-Augmented Generation) als
Ersatz für die FB VI-Infrastruktur der BHT, die nicht die gewünschte Qualität
liefert. Das System soll Studierenden der Berliner Hochschule für Technik (BHT)
helfen, geeignete Betreuende für Abschlussarbeiten und akademische Projekte zu
finden.

**Warum Eigenentwicklung?**
Das von FB VI bereitgestellte System hat folgende nicht behebbare Einschränkungen:
- Kein Multi-Collection-Querying (mehrere Collections gleichzeitig abfragen)
- Kein globaler, persistenter System-Prompt konfigurierbar
- LLM-Qualität (Gemma/MinMax) unzureichend für das Matching-Szenario
- Kein RAGAS-Datenexport möglich
- Keine Kontrolle über Chunking-Strategie
- UI nicht anpassbar

**Zielgruppe des Systems:**
Studierende der BHT, die einen Betreuer für ihre Abschlussarbeit suchen.
Das System leitet sie durch eine strukturierte Gesprächslogik und schlägt
3–5 passende Betreuende mit Begründung vor.

---

## 2. Deployment-Architektur

| Umgebung | Gerät | Zweck |
|---|---|---|
| Entwicklung | MacBook (Lucas) | Code schreiben, testen |
| Produktion | Windows PC (Lucas) | Betrieb des Systems |

**Windows-PC Specs:**
- GPU: NVIDIA RTX 5070 Ti (CUDA-fähig)
- CPU: AMD Ryzen 7
- RAM: 32 GB
- Betriebssystem: Windows 11

**Anforderung:** Das System muss auch außerhalb des lokalen Netzwerks erreichbar
sein (z. B. über ngrok, Tailscale oder ähnliches). DSGVO-Konformität ist
gewährleistet, da alle Daten und Modelle lokal verbleiben.

---

## 3. Tech Stack

### Backend
- **Sprache:** Python
- **Framework:** FastAPI (async, OpenAPI-Docs automatisch, gut für REST + WebSocket)
- **Paketmanager:** pip + requirements.txt (oder uv für schnelleres Setup)

### Vektordatenbank
- **Primär:** ChromaDB (lokal, kein Docker erforderlich, einfache Python-Integration)
- **Fallback/Migration:** Qdrant (wenn Performance-Anforderungen steigen)
- Konfigurierbar über Umgebungsvariable `VECTOR_DB_BACKEND`

### Embedding
- **Primär:** `intfloat/multilingual-e5-small` (mehrsprachig, gut für deutsche Texte)
- **Fallback:** `sentence-transformers/all-MiniLM-L6-v2` (schneller, weniger präzise)
- Konfigurierbar über Umgebungsvariable `EMBEDDING_MODEL`
- Modell läuft lokal via `sentence-transformers`

### LLM
- **Runner:** Ollama (läuft direkt auf der RTX 5070 Ti via CUDA)
- **Standardmodell:** `llama3` oder `mistral` (konfigurierbar)
- **API-Fallback:** OpenAI-kompatibles Interface (z. B. für Tests auf dem MacBook
  ohne starke GPU)
- Konfigurierbar über Umgebungsvariable `LLM_BACKEND` (`ollama` | `openai`)
  und `LLM_MODEL`

### Frontend
- **Framework:** React + Vite + TypeScript
- **Styling:** Tailwind CSS
- **Design-Skills:** Vor jedem UI-Arbeitsschritt die verfügbaren Design-Skills
  aus dem Obsidian Vault lesen (Pfad: `~/.claude/skills/` oder im Projekt unter
  `/skills/`). Diese Skills definieren Designprinzipien, Komponenten und
  Designtokens – sie sind verbindlich.
- **Farbpalette (BHT-Projekt):**
  - Dunkel-Teal: `#132933`
  - Warmweiß: `#FFF5EF`
  - Orange-Akzent: `#FFA874`

### Datei-Verarbeitung
- **PDF:** `pypdf2` oder `pdfplumber` (Textextraktion)
- **Excel/XLSX:** `openpyxl` oder `pandas`
- **DOCX:** `python-docx`

---

## 4. Systemarchitektur

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  Chat UI │ Collection Manager │ Upload │ Settings        │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP / WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                   Backend (FastAPI)                      │
│                                                          │
│  /api/upload     → Ingestion Pipeline                   │
│  /api/collections → Collection CRUD                     │
│  /api/chat       → RAG Query + LLM                      │
│  /api/settings   → System-Prompt, Modell-Config         │
└──────┬──────────────────────────────────┬───────────────┘
       │                                  │
┌──────▼──────┐                  ┌────────▼──────────┐
│  ChromaDB   │                  │  Ollama (lokal)   │
│  (Vektor-   │                  │  LLM Inference    │
│   datenbank)│                  │  RTX 5070 Ti      │
└─────────────┘                  └───────────────────┘
```

---

## 5. Collections & Datenbasis

### Collection-Konzept
- Eine Collection = eine semantisch durchsuchbare Wissensbasis
- Mehrere Collections können **gleichzeitig** abgefragt werden (das ist der
  zentrale Vorteil gegenüber FB VI)
- Collections werden im Frontend erstellt, benannt und verwaltet

### Geplante Collections für Betreuer-Matching
| Collection | Inhalt | Format |
|---|---|---|
| `modulhandbuecher` | 63 BHT-Modulhandbücher | PDF |
| `abschlussarbeiten_fb1` | 1.096 historische Abschlussarbeiten FB I | XLSX (HISinONE) |
| `lehrenden_profile` | ~374 Lehrenden-Einträge (teilweise synthetisch) | XLSX |

### Chunking-Strategie
- **Standard:** Recursive Character Text Splitter
  - Chunk-Größe: 500 Tokens (konfigurierbar)
  - Overlap: 50 Tokens
- **Modulhandbücher:** Modul-Einheit als semantische Grenze bevorzugt
- **Lehrenden-Profile:** Ein Chunk pro Lehrenden-Eintrag
- Chunking-Parameter sind pro Collection konfigurierbar

### Metadaten-Schema (Pflicht pro Chunk)
```json
{
  "collection": "modulhandbuecher",
  "source_file": "MHB_FBX_2024.pdf",
  "fachbereich": "FB I",
  "chunk_index": 42,
  "datentyp": "real" | "synthetisch",
  "lehrende": "Prof. Dr. Muster"  // wenn zutreffend
}
```

Synthetische Einträge **müssen** im Metadatum und in der LLM-Antwort als
`[Synthetische Datenbasis]` gekennzeichnet werden.

---

## 6. Ingestion Pipeline

Beim Hochladen einer Datei durchläuft sie folgende Schritte:

1. **Upload** → Datei wird serverseitig gespeichert (`/data/uploads/`)
2. **Parsing** → Text wird je nach Dateityp extrahiert (PDF/XLSX/DOCX)
3. **Chunking** → Text wird in Chunks aufgeteilt (konfigurierbar)
4. **Embedding** → Chunks werden vektorisiert (Embedding-Modell)
5. **Indexing** → Vektoren + Metadaten werden in ChromaDB gespeichert
6. **Status-Feedback** → Frontend zeigt Fortschritt in Echtzeit

Dateiformate: PDF, XLSX, DOCX, TXT, CSV

---

## 7. RAG Query Pipeline

1. **Nutzeranfrage** kommt im Chat an
2. **Embedding** der Anfrage (gleiches Modell wie beim Indexing)
3. **Retrieval** aus einer oder mehreren Collections (konfigurierbar)
   - Top-K Chunks (Standard: k=5, konfigurierbar)
   - Similarity-Threshold (Standard: 0.7)
4. **Kontext-Assembly** → Chunks werden mit Metadaten zusammengestellt
5. **LLM-Aufruf** mit System-Prompt + Kontext + Nutzerfrage
6. **Antwort** wird gestreamt zurück ans Frontend (Streaming via SSE oder WebSocket)
7. **Quellenangabe** → genutzte Chunks werden in der Antwort referenziert

---

## 8. System-Prompt & Chat-Logik (Betreuer-Matching)

### Standard-System-Prompt
```
Du bist ein Beratungssystem der Berliner Hochschule für Technik (BHT) für
Betreuer-Matching.

Deine Aufgabe ist es, Studierende strukturiert durch die Auswahl eines geeigneten
Betreuers für ihre Abschlussarbeit zu führen.

Gehe dabei in folgenden Schritten vor:
1. Erfrage zunächst das Thema oder die Themenidee des Studierenden.
2. Hilf dem Studierenden, das Thema zu konkretisieren, falls es noch vage ist.
3. Frage nach dem Fachbereich und dem Abschluss (Bachelor/Master).
4. Schlage auf Basis der Wissensbasis 3–5 passende Betreuende vor.
5. Begründe jeden Vorschlag mit konkreten Bezügen zu Forschungsgebieten,
   betreuten Themen oder Modulzuständigkeiten aus der Wissensbasis.
6. Kennzeichne Empfehlungen aus synthetischen Daten mit [Synthetische Datenbasis].

Beantworte Anfragen ausschließlich auf Basis der bereitgestellten Kontextdokumente.
Wenn keine ausreichenden Informationen vorliegen, antworte:
'Auf Basis der aktuellen Datenbasis kann keine passende Empfehlung gegeben werden.'

Antworte immer auf Deutsch.
```

Dieser System-Prompt ist im Frontend editierbar und wird persistent gespeichert.

---

## 9. Frontend – Seiten & Features

### Seiten
| Route | Beschreibung |
|---|---|
| `/` | Chat-Interface (Hauptseite) |
| `/collections` | Collections verwalten (erstellen, löschen, Details) |
| `/upload` | Dateien hochladen und einer Collection zuweisen |
| `/settings` | System-Prompt, Modell-Auswahl, Chunking-Parameter |

### Chat-Interface Features
- Streaming-Antworten (kein Warten auf vollständige Antwort)
- Quellenanzeige unter jeder Antwort (welche Chunks wurden genutzt?)
- Mehrere Collections gleichzeitig auswählbar (Checkboxen)
- Chat-Verlauf innerhalb der Session (kein persistentes Log nötig)
- Systemprompt-Vorschau/Edit im Chat

### Collection Manager Features
- Liste aller Collections mit Chunk-Anzahl und Dateien
- Collection erstellen / umbenennen / löschen
- Einzelne Dateien aus einer Collection entfernen
- Status: Indexing läuft / bereit / Fehler

### Upload Features
- Drag & Drop für PDF, XLSX, DOCX, TXT
- Collection auswählen oder neue erstellen
- Chunking-Parameter konfigurieren (Chunk-Größe, Overlap)
- Embedding-Modell auswählen
- Echtzeit-Fortschrittsanzeige

### Settings
- System-Prompt (Textarea, persistent gespeichert)
- LLM-Modell auswählen (Liste verfügbarer Ollama-Modelle via API)
- Embedding-Modell auswählen
- Vektordatenbank-Info (ChromaDB-Pfad, Collection-Übersicht)
- Remote-Zugang (ngrok / Tailscale Tunnel ein-/ausschalten)

---

## 10. API-Endpunkte (FastAPI)

```
POST   /api/upload                  # Datei hochladen + indexieren
GET    /api/collections             # Alle Collections auflisten
POST   /api/collections             # Neue Collection erstellen
DELETE /api/collections/{name}      # Collection löschen
GET    /api/collections/{name}/files # Dateien in einer Collection
DELETE /api/collections/{name}/files/{file_id} # Datei entfernen

POST   /api/chat                    # RAG-Anfrage (streamed)
GET    /api/models                  # Verfügbare LLM-Modelle (Ollama)

GET    /api/settings                # Aktuelle Settings laden
POST   /api/settings                # Settings speichern

GET    /api/health                  # Healthcheck
```

---

## 11. Konfiguration (.env)

```env
# LLM
LLM_BACKEND=ollama           # ollama | openai
LLM_MODEL=llama3             # Modellname
OLLAMA_BASE_URL=http://localhost:11434
OPENAI_API_KEY=              # Optional, für Fallback

# Embedding
EMBEDDING_MODEL=intfloat/multilingual-e5-small

# Vektordatenbank
VECTOR_DB_BACKEND=chroma     # chroma | qdrant
CHROMA_PERSIST_DIR=./data/chroma

# Upload
UPLOAD_DIR=./data/uploads
MAX_UPLOAD_SIZE_MB=100

# Server
HOST=0.0.0.0
PORT=8000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

## 12. Projektstruktur

```
rag-betreuer-matching/
├── CLAUDE.md                  # Diese Datei
├── .env                       # Lokale Konfiguration (nicht in Git)
├── .env.example               # Vorlage für .env
├── requirements.txt
│
├── backend/
│   ├── main.py                # FastAPI App + Router
│   ├── config.py              # Settings aus .env
│   ├── ingestion/
│   │   ├── parser.py          # PDF/XLSX/DOCX Textextraktion
│   │   ├── chunker.py         # Chunking-Strategien
│   │   └── embedder.py        # Embedding-Modell-Interface
│   ├── retrieval/
│   │   ├── vectorstore.py     # ChromaDB / Qdrant Interface
│   │   └── query.py           # RAG Query Pipeline
│   ├── llm/
│   │   ├── client.py          # Ollama / OpenAI Interface
│   │   └── prompts.py         # System-Prompt Templates
│   └── api/
│       ├── routes_chat.py
│       ├── routes_collections.py
│       ├── routes_upload.py
│       └── routes_settings.py
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Chat.tsx
│   │   │   ├── Collections.tsx
│   │   │   ├── Upload.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   └── api/              # API-Client (fetch-Wrapper)
│   └── skills/               # Design-Skills aus Obsidian Vault (hierher kopieren)
│
└── data/                      # Gitignored
    ├── uploads/
    └── chroma/
```

---

## 13. Design-Skills (UI)

**Wichtig:** Vor jedem UI-Arbeitsschritt müssen die Design-Skills gelesen werden.

Diese befinden sich im Obsidian Vault und sollten ins Projekt unter
`frontend/skills/` kopiert werden. Claude Code liest sie automatisch
vor dem UI-Design.

Die Skills definieren:
- Typografie und Spacing
- Komponenten-Patterns
- Designprinzipien
- Animationen und Interaktionen

Die BHT-Projektfarben sind verbindlich (siehe Abschnitt 3 – Tech Stack).

---

## 14. Entwicklungsreihenfolge (empfohlen)

1. **Backend-Grundgerüst** – FastAPI + Health-Endpoint + .env-Konfiguration
2. **Ingestion Pipeline** – Parser + Chunker + ChromaDB-Anbindung
3. **Upload-Endpoint** – Datei hochladen + indexieren (ohne Frontend)
4. **RAG Query Pipeline** – Retrieval + Ollama-Anbindung + Streaming
5. **Chat-Endpoint** – /api/chat mit Streaming
6. **Frontend-Grundgerüst** – Vite + React + Tailwind + Routing
7. **Chat-UI** – Hauptseite mit Streaming-Antworten + Collection-Auswahl
8. **Upload-UI** – Drag & Drop + Fortschrittsanzeige
9. **Collection Manager** – Verwaltung der Collections
10. **Settings-Seite** – System-Prompt + Modell-Konfiguration
11. **Remote-Zugang** – ngrok / Tailscale Integration
12. **Deployment-Skript** – Windows-PC Setup (CUDA, Ollama, Start-Script)

---

## 15. Wichtige Qualitätsprinzipien

- **Sprache:** Alle UI-Texte und System-Prompts auf Deutsch
- **Synthetische Daten** immer als solche kennzeichnen (`[Synthetische Datenbasis]`)
- **DSGVO:** Alle Daten verbleiben lokal – keine externen API-Calls für
  Embeddings oder LLM (außer wenn explizit als Fallback konfiguriert)
- **Fehlerbehandlung:** Jeder API-Endpoint gibt sinnvolle Fehlermeldungen zurück
- **Streaming:** Chat-Antworten werden gestreamt, nie gebuffert
- **Konfigurierbarkeit:** Modelle, Chunk-Größen und System-Prompt sind zur
  Laufzeit änderbar ohne Neustart

---

## 16. Evaluierung (RAGAS)

Das System soll RAGAS-Evaluierung unterstützen:
- Endpoint `POST /api/eval` nimmt Test-Fragen + Ground-Truth entgegen
- Berechnet: Faithfulness, Answer Relevance, Context Recall
- Exportiert Ergebnisse als JSON/CSV

Test-Set: 20–30 deutsche Fragen aus dem Betreuer-Matching-Kontext
(Faithfulness, Answer Relevance, Fallback-Verhalten)

---

## 17. Automatisiertes Benchmark / Evaluation (umgesetzt – Stand 19. Juni 2026)

Ordner **`benchmark/`** – automatisierte, reproduzierbare Qualitätsmessung über viele
Fragen. Erweitert die unter Abschnitt 16 geplante `/api/eval`-Logik und nutzt dieselben
Backend-Module (retrieve, build_context, Ollama, RAGAS).

**Drei Test-Ebenen:**
- **A – Matching-Genauigkeit** (ohne LLM-Judge, schnell, Hunderte Fragen): Ground Truth
  automatisch aus den Lehrenden-Profilen (Forschungsgebiet von Prof. X → Frage, korrekte
  Antwort = Prof. X). Metriken: Top-1/3/5, MRR.
- **B – Antwortqualität (RAGAS, LLM-as-Judge, Stichprobe ~100)**: Faithfulness,
  Answer Relevancy, Context Recall. Bewerter = lokales Ollama-Modell; Embeddings = lokales e5.
- **C – Robustheit** (ohne Judge): unpassende/leere Anfragen → korrekte Ablehnung,
  Sprache (Deutsch), Quellen.

**Aufruf:** `python -m benchmark.run --collection lehrende --n-matching 300 --n-ragas 100`
(resümierbar via `--resume`). **Output** in `benchmark/results/` (gitignored): Excel-Report
(Zusammenfassung mit KPI-Ampel / Pro-Frage / Verteilungen+Chart), Markdown-Summary, JSON.
Windows-Schritte siehe `benchmark/README.md`.

**KPI-Zielwerte** (in `benchmark/report.py` → `TARGETS`, = Kap. 6.5 der Projektdoku):
Top-3 ≥ 0,70 · Faithfulness ≥ 0,85 · Answer Relevancy ≥ 0,80 · Context Recall ≥ 0,75.
SUS bewusst raus (kein Nutzertest).

**Status / nächster Schritt:** Code fertig + isoliert getestet (Logik, Excel valide), aber
**voller Lauf steht noch aus** – auf dem Windows-PC (RTX) ausführen: venv bauen, Ollama
starten (`llama3.1:8b`), Collection `lehrende` indexieren, dann Mini-Probelauf, dann voller
Lauf. Ergebnisse anschließend in Kap. 6.5 des Abschlussberichts übertragen.

---

*Erstellt: Juni 2026 | Projekt: BHT Betreuer-Matching, Gruppe 02 | Lucas Bruhn*
