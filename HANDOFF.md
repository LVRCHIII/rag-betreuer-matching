# Session-Handoff – Kontext für die nächste Chat-Session (Windows-PC)

> Kurzfassung der Mac-Session vom **19. Juni 2026**. In der neuen Session auf dem
> Windows-PC einfach auf diese Datei verweisen („lies HANDOFF.md"). Projekt:
> **BHT Consulting Projekt, Gruppe 02 – RAG-gestütztes Betreuer-Matching**, Lucas Bruhn.

---

## TL;DR – nächster Schritt

Das **automatisierte Evaluations-Benchmark ist fertig und im Repo** (`benchmark/`), aber
der **volle Lauf steht noch aus** und soll **hier auf dem Windows-PC (RTX, CUDA)** laufen.
Danach werden die Ergebnisse in **Kapitel 6.5** des Projektabschlussberichts übertragen
und später ein Ergebnis-Kapitel geschrieben.

```powershell
git pull
python -m venv .venv
& ".venv\Scripts\python.exe" -m pip install -r requirements.txt
ollama pull llama3.1:8b
# nur falls Collection 'lehrende' leer ist (data/ ist NICHT im Repo):
& ".venv\Scripts\python.exe" scripts\ingest_lehrende.py "C:\Pfad\zur\Datenbasis.xlsx" lehrende g02
# erst Probe, dann voll:
& ".venv\Scripts\python.exe" -m benchmark.run --n-matching 30 --n-ragas 5
& ".venv\Scripts\python.exe" -m benchmark.run --collection lehrende --n-matching 300 --n-ragas 100
```
Ergebnis: `benchmark\results\` → Excel + Markdown + JSON.

---

## Was in dieser Session gemacht wurde

1. **Projektabschlussbericht – Technisches Konzept (Kap. 5) umgeschrieben** auf die
   **Eigenentwicklung** (weg vom FB-VI-System), inkl. **Gegenüberstellung FB-VI vs.
   Eigenentwicklung** und Anpassung aller abhängigen Stellen (Management Summary, Fazit/
   Soll-Ist, Risiko-Matrix, Abschnitt 3.5). Als **nachverfolgte Änderungen**.
2. **Anwenderhandbuch v2** aktualisiert (sauber + Changelog): Single-Origin-Start (Port 8000),
   `llama3.1:8b`, neue Abschnitte (Installer „in Vorbereitung", Bereiche/Workspaces,
   Chat-Anhänge, Chunk-Browser), großes Kapitel **„Umsetzung & Entwicklung"**, Kapitel
   **„Versionshinweise"** und **9 Bild-Platzhalter** für Screenshots.
3. **Projektabschlussbericht – Kapitel 6 (Artefakte) neu** (nachverfolgte Änderungen):
   - Artefakt 1: **RAG-System („Rack")** – Eigenentwicklung, **auch von Gruppe 3** (Auflagen-Finder) genutzt
   - Artefakt 2: **RAG-Evaluations-Tool** – Eigenentwicklung, **Logik nutzt Gruppe 1**
   - Artefakt 3: **System-Prompt** – **übernommen von Gruppe 8 und Gruppe 1**
   - Artefakt 4: **Datenbasis** – Modulhandbücher **von Gruppe 3** + Betreuerprofile **mit Gruppe 8**
4. **Automatisiertes Benchmark gebaut** (`benchmark/`) + **Evaluations-/Testkonzept.docx**.
5. Alles committet + gepusht: **Commit `a0fd381` auf `main`**.

---

## Das Benchmark (`benchmark/`)

Automatisierte, reproduzierbare Qualitätsmessung über viele Fragen; nutzt dieselben
Backend-Module wie der Chat. **Drei Ebenen:**

- **A – Matching-Genauigkeit** (ohne LLM-Judge, schnell, Hunderte Fragen): Ground Truth
  **automatisch** aus den Lehrenden-Profilen (Forschungsgebiet von Prof. X → Frage,
  korrekte Antwort = Prof. X / Known-Item-Retrieval). Metriken: Top-1/3/5, MRR.
- **B – Antwortqualität (RAGAS, ~100er-Stichprobe)**: Faithfulness, Answer Relevancy,
  Context Recall. Bewerter = lokales Ollama (`llama3.1:8b`), Ähnlichkeit = lokale e5-Embeddings.
- **C – Robustheit** (ohne Judge): unpassende/leere Anfragen → korrekte Ablehnung,
  Sprache (Deutsch), Quellen.

**Dateien:** `dataset.py` (Fragegenerierung), `pipeline.py` (RAG-Aufruf), `metrics.py`
(A/B/C-Metriken), `report.py` (Excel + Markdown + JSON), `run.py` (CLI, **resümierbar** via
`--resume`), `README.md` (inkl. Windows-Anleitung). `benchmark/results/` ist gitignored.

**KPI-Zielwerte** (`report.py` → `TARGETS`, = Kap. 6.5): Top-3 ≥ 0,70 · Faithfulness ≥ 0,85 ·
Answer Relevancy ≥ 0,80 · Context Recall ≥ 0,75. **SUS bewusst raus** (kein Nutzertest).

**Laufzeit-Hinweis:** Ebene A/C in Minuten; Ebene B ~30–90 s pro Frage → 100 Fragen grob
1–2,5 h (deshalb auf der RTX). Bei Abbruch `--resume`.

Der Code wurde isoliert getestet (Fragegenerierung, Metriken, Excel-Report valide); der
**End-to-End-Lauf mit echtem Retrieval + Ollama stand auf dem Mac noch aus** (Mac-venv kaputt,
deshalb auf Windows).

---

## Wichtige technische Fakten

- **Stack:** FastAPI-Backend + React-Frontend (Single-Origin, ein Prozess, **Port 8000**),
  ChromaDB (Cosine), Embedding `intfloat/multilingual-e5-small` (mit `query:`/`passage:`-Präfixen),
  LLM via Ollama `llama3.1:8b` (Temperature 0.15), optional OpenAI-Backend.
- **Collection** fürs Matching: `lehrende` (intern `g02_lehrende`, ~374 Profile). Bereiche/
  Workspaces: `g02` (Betreuer-Matching), `g03` (Auflagen-Finder).
- **Repo:** `github.com/LVRCHIII/rag-betreuer-matching`, Branch `main`, aktuell `a0fd381`.
- **Daten** (`data/`, ChromaDB) und `data/settings.json` sind **gitignored** → auf einem
  frischen Rechner Collection ggf. neu indexieren (`scripts/ingest_lehrende.py`).
- Projektkontext steht ausführlich in **`CLAUDE.md`** (Abschnitt 17 = Benchmark).

---

## Doku-Dateien (liegen auf dem MAC unter ~/Downloads – NICHT im Repo, NICHT auf Windows)

- `Projektabschlussbericht_Gruppe02_v3.docx` – aktuellste Doku (Tech-Konzept + Artefakte, Tracked Changes)
- `Anwenderhandbuch_RAG_Betreuer_Matching_v2.docx`
- `Evaluations_und_Testkonzept_Gruppe02.docx`

> Diese Word-Dateien sind nur auf dem Mac. Für die Testing-Aufgabe egal (alles Relevante ist
> im Repo). Wenn du sie auf Windows brauchst: vom Mac kopieren/übertragen.

---

## Offene To-Dos

1. **Benchmark voll laufen lassen** (Windows, RTX) – siehe TL;DR.
2. Ergebnisse (Top-3, Faithfulness, Answer Relevancy, Context Recall) in **Kap. 6.5** des
   Abschlussberichts eintragen (ersetzt die `[wird ergänzt]`-Platzhalter).
3. **Später:** eigenes Ergebnis-/Evaluations-Kapitel im Bericht schreiben (erst wenn Zahlen da sind).
4. Ganz am Ende: Installer / virtuelle Maschine (bewusst zurückgestellt).
