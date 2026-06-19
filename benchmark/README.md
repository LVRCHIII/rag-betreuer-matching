# Automatisiertes Benchmark – RAG Betreuer-Matching

Misst die Qualität des RAG-Systems über viele Fragen automatisch und erzeugt einen
Excel-Report (für den Anhang), ein Markdown-Summary und JSON-Rohdaten.

## Drei Test-Ebenen

| Ebene | Was | LLM-Judge? | Umfang |
|---|---|---|---|
| **A – Matching-Genauigkeit** | Taucht die/der korrekte Betreuende in den Treffern auf? Top-1/3/5, MRR | nein (schnell) | Hunderte |
| **B – Antwortqualität (RAGAS)** | Faithfulness, Answer Relevancy, Context Recall | ja (langsam) | Stichprobe (~100) |
| **C – Robustheit** | Lehnt das System unpassende Anfragen korrekt ab? Sprache, Quellen | nein (schnell) | kuratiertes Set |

**Ground Truth ohne manuelles Labeln:** Jedes Lehrenden-Profil nennt Forschungsgebiete.
Zu einem Forschungsgebiet von Prof. X wird automatisch eine Frage gebaut – die korrekte
Antwort ist per Konstruktion Prof. X (Known-Item-Retrieval).

## Voraussetzungen

- Aktives Projekt-venv mit allen `requirements.txt` (chromadb, sentence-transformers, ragas, openpyxl …)
- Laufendes Ollama mit dem gewünschten Modell (z. B. `ollama pull llama3.1:8b`)
- Indexierte Collection (z. B. `lehrende`) – siehe `scripts/ingest_lehrende.py`

## Aufruf

```bash
# Standard: 300 Matching-Fragen, davon 100 mit RAGAS, plus Robustheits-Set
python -m benchmark.run --collection lehrende --n-matching 300 --n-ragas 100

# Schneller Probelauf
python -m benchmark.run --n-matching 30 --n-ragas 10

# Abgebrochenen Lauf fortsetzen
python -m benchmark.run --resume
```

### Windows (RTX-PC) – Schritt für Schritt

```powershell
# 1) Repo aktualisieren
git pull

# 2) Umgebung (einmalig bzw. nach neuen Abhängigkeiten)
python -m venv .venv
& ".venv\Scripts\python.exe" -m pip install -r requirements.txt

# 3) Ollama-Modelle bereitstellen (einmalig)
ollama pull llama3.1:8b

# 4) Datenbasis indexieren, falls Collection noch leer (data/ ist nicht im Repo)
& ".venv\Scripts\python.exe" scripts\ingest_lehrende.py "C:\Pfad\zur\Datenbasis.xlsx" lehrende g02

# 5) Erst Mini-Probelauf, dann der volle Lauf
& ".venv\Scripts\python.exe" -m benchmark.run --n-matching 30 --n-ragas 5
& ".venv\Scripts\python.exe" -m benchmark.run --collection lehrende --n-matching 300 --n-ragas 100
```

Ollama muss laufen (unter Windows startet der Dienst i. d. R. automatisch; sonst `ollama serve`).
Der direkte Aufruf über `.venv\Scripts\python.exe` umgeht die PowerShell-ExecutionPolicy.
Keine zusätzlichen Pakete nötig – alles steckt in `requirements.txt`.

Wichtige Optionen: `--k` (Top-k), `--model` (Antwort-LLM), `--judge-model`
(RAGAS-Bewerter), `--no-robustness`, `--out` (Zielordner). RAGAS nutzt als
Bewerter ein lokales Ollama-Modell und für die Ähnlichkeitsmetriken dieselben
lokalen e5-Embeddings wie das System.

## Ergebnis (im Ordner `--out`, Default `benchmark/results/`)

- `eval_report_<stamp>.xlsx` – Blätter *Zusammenfassung* (KPI-Abgleich), *Pro Frage*, *Verteilungen* (Diagramm)
- `eval_summary_<stamp>.md` – kompaktes Summary zum Zitieren im Bericht
- `eval_raw_<stamp>.json` – Aggregat + alle Einzelergebnisse
- `run.jsonl` – Zwischenstand (für `--resume`)

Die KPI-Zielwerte (`benchmark/report.py` → `TARGETS`) entsprechen Kapitel 6.5 der
Projektdokumentation: Top-3 ≥ 0,70 · Faithfulness ≥ 0,85 · Answer Relevancy ≥ 0,80 ·
Context Recall ≥ 0,75.

## Laufzeit-Hinweis

Ebene A/C laufen in Minuten. Ebene B kostet pro Frage ~30–90 s (LLM-Judge); 100 Fragen
entsprechen also grob 1–2,5 h. Am besten über Nacht/nebenbei laufen lassen – dank
`--resume` ist ein Abbruch unkritisch.
