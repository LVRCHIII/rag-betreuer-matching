# Evaluations-Methodik & Vorgehensdokumentation – RAG Betreuer-Matching

> Arbeitsdokument für die spätere Projektdokumentation (Gruppe 02). Hält fest, **was**
> evaluiert wurde, **wie**, **warum** welche Schritte getan wurden und **welche Ergebnisse**
> herauskamen. Stand: 20. Juni 2026. Modelle/Läufe siehe `benchmark/results/`.

---

## 1. Ziel der Evaluation
Objektiv und reproduzierbar messen, wie gut das selbst entwickelte RAG-System Studierenden
passende Betreuende für Abschlussarbeiten vorschlägt – über viele Fragen statt anekdotisch,
mit denselben Backend-Modulen, die auch der produktive Chat nutzt.

## 2. Drei Evaluationsebenen
- **Ebene A – Matching-Genauigkeit** (ohne LLM, schnell, hunderte Fragen): Known-Item-Retrieval.
  Aus jedem Lehrenden-Profil wird zu einem Forschungsgebiet eine Frage gebaut; die korrekte
  Antwort ist per Konstruktion diese:r Lehrende. Metriken: Top-1/3/5-Trefferquote, MRR.
- **Ebene B – Antwortqualität (RAGAS)**: Faithfulness (Quelltreue), Answer Relevancy
  (Antwortrelevanz), Context Recall (Kontextabdeckung). Bewerter = lokales LLM ("LLM as a Judge"),
  Ähnlichkeit = lokale e5-Embeddings.
- **Ebene C – Robustheit & Compliance**: unpassende/leere Anfragen → korrekte Ablehnung,
  Sprache (Deutsch).

## 3. Ground Truth – und warum wir sie überarbeitet haben
**Problem entdeckt:** Die erste Version baute 1 Frage je Profil aus beliebigen
Forschungsgebiets-Fragmenten. Eine Prüfung zeigte: **61 % der Fragen hatten ein Thema, das
auch bei anderen Lehrenden vorkommt** → die Annahme „ein Thema → genau eine richtige Person"
war für die Mehrheit verletzt; das System wurde für genauso passende Treffer zu Unrecht
abgestraft. Zusätzlich entstanden Themen-Fragmente („Energie-", „Zell-") und zu breite Strings.

**Maßnahme:** Themen-Extraktion bereinigt (keine Fragmente, keine zu breiten Begriffe, nur
Forschungsgebiete – nicht die Professur-Bezeichnung) und **nur eindeutige Themen** verwendet
(genau einer Person zugeordnet). Ergebnis: **689 valide Fragen mit eindeutiger Ground Truth**
(von 374 Profilen haben 208 Forschungsgebiete; daraus 790 distinkte Themen, 689 eindeutig).
→ `dataset.build_matching_questions(..., unique_only=True)`.

**Wichtige Konsequenz:** Die früheren „73,7 % Top-3" waren überhöht, weil der alte Generator
als Notlösung die *Professur* als Thema nahm (solche Fragen echoen den Profiltext → trivial).
Der ehrliche Wert mit echten Forschungsthemen liegt bei ~51 %.

## 4. Datenbasis & Collections
- `g02_lehrende` – 374 Lehrenden-Profile, 1 kompakter Chunk je Person mit `lehrende`-Metadatum
  (`scripts/ingest_lehrende.py`). Quelle: `V001_Datenbasis…xlsx`.
- `g02_modulhandbuecher` – 63 PDFs, 13.253 Chunks (`scripts/ingest_documents.py`).
- `g02_abschlussarbeiten` – 1.975 Chunks (HISinONE-Liste).
Embedding: `intfloat/multilingual-e5-small` (mit `query:`/`passage:`-Präfixen), ChromaDB (Cosine).

## 5. Retrieval-Setup: profilfokussiert vs. „alle Collections"
**Befund:** Mischt man beim Retrieval alle Collections, **fällt Top-3 von ~51 % auf ~33 %** –
die 13k Modulhandbuch-Chunks verdrängen die einzelnen Profil-Chunks.
**Entscheidung:** Haupt-Benchmark **profilfokussiert** (nur `g02_lehrende`). Der Distraktor-Lauf
bleibt als eigener Befund erhalten (`benchmark/results/shootout_mit_distraktoren/`) und begründet
die Empfehlung, beim Matching gezielt die Profil-Collection zu durchsuchen statt alles zu mischen.
→ Multi-Collection-Retrieval ist im Code vorhanden (`retrieve_for(..., extra_collections=...)`).

## 6. Modelle & Judge (Shootout)
**Vorgehen:** Alle Modelle beantworten **dieselben Fragen** (fester Seed), bewertet vom
**selben festen Judge**; nur das Antwort-Modell variiert → fairer Vergleich. Matching/MRR/Context
Recall sind modell-unabhängig (gleiches Retrieval) und dienen daher als Sanity-Check, nicht zur
Modellauswahl. Auswahl per Composite `0,5·Faithfulness + 0,3·Answer Relevancy + 0,2·Ablehnung`.

Ergebnis (lehrende-only, Prompt v2, Judge qwen2.5:14b):
| Modell | Faithfulness | Answer Rel. | Ablehnung | Deutsch | Composite |
|---|---|---|---|---|---|
| **qwen2.5:14b** | 0,507 | 0,574 | 86,7 % | 100 % | **0,599** |
| llama3.1:8b | 0,453 | 0,549 | 80,0 % | 93,3 % | 0,551 |
| gemma2:9b | 0,179 | 0,342 | 33,3 % | 100 % | 0,259 |
| mistral-nemo | 0,073 | 0,000 | 80,0 % | 100 % | 0,197 |
→ **Gewinner qwen2.5:14b.** (gemma2 schwach bei Ablehnung/Faithfulness; mistral-nemo bei
Answer Relevancy defekt.) Hardware: RTX 5070 Ti, 16 GB VRAM → 14B-Klasse (Q4) ist der Sweet Spot.

## 7. System-Prompt (Robustheit)
**Befund:** Der ursprüngliche Prompt hatte keine Ablehn-Regel; ein schwaches Modell (llama3.1:8b)
beantwortete unpassende Fragen inhaltlich (40 % im ersten Lauf). **Maßnahme:** Prompt-Variante
**v2** mit vorangestelltem Geltungsbereichs-/Ablehnungsblock (`prompt_variants.py`), A/B-testbar.
**Erkenntnis:** Robustheit ist primär ein Modell-Stärke-Thema – qwen lehnt auch mit dem alten
Prompt ~korrekt ab; v2 hilft schwachen Modellen und schadet starken nicht.
**Nebenbefund:** Ein Ähnlichkeits-Schwellwert eignet sich NICHT als Relevanz-Gate – die
e5-Scores von passenden (0,85–0,90) und unpassenden (0,77–0,88) Anfragen überlappen zu stark.

## 8. Metriken – Sorgfalt bei der Auswertung
- **Matching** (Ebene A): Namensabgleich Top-k (Nachnamen-tolerant).
- **RAGAS** (Ebene B): lokaler Judge; NaN-/Parse-Fehlerquote wird mit ausgewiesen.
- **Robustheit** (Ebene C): Die ursprüngliche **Keyword-Heuristik war unzuverlässig** (wertete
  einen tatsächlich erzählten Witz als „ok"). → Ersetzt durch einen **LLM-Judge**
  (`metrics.robustness_llm`): „Hat das System korrekt zurückgewiesen? JA/NEIN" (validiert an
  bekannten Fällen). Heuristik bleibt nachrichtlich erhalten.

## 9. Chronologie der Schritte (mit Begründung)
1. Umgebung: Repo aus iCloud nach `C:\dev` geklont (git scheitert im iCloud-Ordner unter Windows
   an mmap), `data/` übernommen → reproduzierbare Basis auf der RTX.
2. Erster Lauf (llama3.1:8b, 100 RAGAS) → Faithfulness niedrig, Ablehnung 40 % → Verdacht auf
   Modell- und Methodik-Schwächen.
3. **Verifikation der Ground Truth** → 61 % mehrdeutig → eindeutige Ground Truth eingeführt (Kap. 3).
4. **Retrieval-Scope geprüft** → Distraktoren drücken Top-3 stark → profilfokussiert als Hauptmodus (Kap. 5).
5. **Robustheits-Metrik gehärtet** (LLM-Judge) + **Prompt v2** (Kap. 7/8).
6. **Modell-Shootout** (4 Modelle, fester Judge) → qwen2.5:14b gewinnt (Kap. 6).
7. **Finaler Lauf** (qwen, 689 Matching / 300 RAGAS) → ehrliche Zahlen (Kap. 10).
8. **Diagnose** der niedrigen Werte → Retrieval ist der Engpass (Kap. 11).
9. **Nächster Schritt**: stärkeres Embedding (e5-large / BGE-m3) als A/B (Kap. 12).

## 10. Ergebnisse – finaler Lauf (qwen2.5:14b, profilfokussiert)
689 Matching / 300 RAGAS / 15 Robustheit. `benchmark/results/final/`.
| KPI | Ergebnis | Ziel |
|---|---|---|
| Top-3 | 51,5 % | ≥0,70 |
| Top-1 / Top-5 / MRR | 33,0 % / 58,1 % / 0,425 | – |
| Faithfulness | 0,491 (Median 0,52) | ≥0,85 |
| Answer Relevancy | 0,610 (Median 0,86) | ≥0,80 |
| Context Recall | 0,501 | ≥0,75 |
| Korrekte Ablehnung (LLM-Judge) | 80,0 % | – |
| Sprache Deutsch | 100 % | – |

## 11. Kern-Erkenntnis: der Engpass ist das Retrieval, nicht die Generierung
RAGAS-Werte aufgeschlüsselt nach Retrieval-Erfolg (300 Fragen):
| Teilmenge | n | Faithfulness | Answer Rel. | Context Recall | Ø |
|---|---|---|---|---|---|
| Treffer in Top-1 | 91 | 0,589 | 0,719 | 0,912 | 0,740 |
| Treffer in Top-3 | 153 | 0,587 | 0,720 | 0,856 | 0,721 |
| überhaupt gefunden (Top-5) | 179 | 0,586 | 0,735 | 0,836 | 0,719 |
| Retrieval verfehlt | 121 | 0,348 | 0,424 | 0,004 | 0,259 |
**Interpretation:** Wird der richtige Profil-Chunk gefunden, antwortet das System ordentlich
(Context Recall 0,86, Answer Relevancy 0,72). Die niedrigen Gesamtwerte sind überwiegend **Folge**
verfehlter Treffer (Context Recall 0,00 bei Miss), nicht schlechter Antworten. Der Gesamtwert
≈ Retrieval-Trefferquote. → **Ein Hebel (besseres Retrieval) verbessert fast alle KPIs gleichzeitig.**

## 12. Nächster Schritt: stärkeres Embedding-Modell (A/B)
`multilingual-e5-small` ist das kleinste seiner Familie. Hypothese: ein stärkeres Embedding hebt
die Trefferquote und damit alle Folge-KPIs. A/B (matching-only, ohne LLM → schnell, `benchmark/embedding_ab.py`)
gegen **e5-large** und **BGE-m3**, neu indexiert in `g02_lehrende_e5large` / `g02_lehrende_bge`,
689 eindeutige Fragen.

| Embedding-Modell | Top-1 | Top-3 | Top-5 | MRR |
|---|---|---|---|---|
| e5-small (Baseline) | 33,2 % | 52,4 % | 60,1 % | 0,434 |
| **e5-large** | **38,3 %** | **53,3 %** | **61,1 %** | **0,467** |
| BGE-m3 | 25,5 % | 38,9 % | 44,8 % | 0,324 |

**Ergebnis:** e5-large verbessert v. a. Top-1 (+5 Pp) und MRR (+0,03), Top-3 nur minimal
(+0,9 Pp) – ein kleiner, kostenloser Gewinn, übernehmenswert. BGE-m3 ist hier klar schlechter
(ohne passende Prompt-/Instruktionsnutzung) → verworfen. **Kernaussage:** Der Embedding-Tausch
allein hebt die Trefferquote nicht entscheidend; die Top-5-Decke (~61 %) zeigt, dass in ~40 %
der Fälle das richtige Profil gar nicht unter den Top-5 ist. Größerer Hebel daher: **hybrides
Retrieval (BM25 + dense)** für exakte Fachbegriffe bzw. feiner/reichhaltiger gechunkte Profile.

### 12b. Hybrid-Retrieval (BM25 + dense, RRF) – `benchmark/hybrid_ab.py`, `backend/retrieval/hybrid.py`
| Methode | Top-1 | Top-3 | Top-5 | MRR |
|---|---|---|---|---|
| BM25 (nur lexikalisch) | 61,8 % | 89,3 % | 92,7 % | 0,753 |
| dense e5-small | 31,9 % | 50,9 % | 58,5 % | 0,420 |
| hybrid e5-small+BM25 | 60,1 % | 75,2 % | 83,2 % | 0,687 |
| dense e5-large | 36,9 % | 50,9 % | 58,8 % | 0,449 |
| **hybrid e5-large+BM25** | **68,2 %** | **81,4 %** | **86,1 %** | **0,752** |

**Ergebnis:** Lexikalische/hybride Suche hebt Top-3 von ~51 % auf 81–89 % – der mit Abstand
größte Hebel. **Validitäts-Vorbehalt:** Die Fragen enthalten das Forschungsgebiet wörtlich aus
dem Zielprofil, daher trifft BM25 nahezu geschenkt; bei paraphrasierten Realanfragen fiele BM25
zurück und der dichte Anteil würde wichtiger. Die absoluten Werte sind also nach oben verzerrt,
die qualitative Aussage (lexikalische Komponente unverzichtbar) ist aber robust. Dass BM25-only
hier den Hybrid schlägt, liegt an der Gleichgewichtung im RRF (schwacher Dense-Ranker verwässert);
für die Produktion ist **hybrid e5-large** dennoch robuster (fängt Paraphrasen ab), ggf. mit
stärkerer BM25-Gewichtung. → `backend/retrieval/hybrid.py` ist als wiederverwendbare Funktion
bereit zur Integration in die produktive Query-Pipeline.

### 12c. Endergebnis: voller Benchmark mit Hybrid-Retrieval (Vorher/Nachher)
Identischer Aufbau (qwen2.5:14b, 689 Matching / 300 RAGAS, profilfokussiert, Prompt v2), nur das
Retrieval variiert. `benchmark/results/final/` (dense) vs. `benchmark/results/final_hybrid/`
(hybrid e5-large + BM25).
| KPI | dense (e5-small) | hybrid (e5-large+BM25) | Ziel | Status hybrid |
|---|---|---|---|---|
| Top-1 | 33,0 % | 66,8 % | – | – |
| **Top-3** | 51,5 % | **79,8 %** | ≥0,70 | **erfüllt** |
| Top-5 | 58,1 % | 84,9 % | – | – |
| MRR | 0,425 | 0,738 | – | – |
| Faithfulness | 0,491 | 0,532 | ≥0,85 | nicht erfüllt |
| Answer Relevancy | 0,610 | 0,693 | ≥0,80 | nicht erfüllt |
| **Context Recall** | 0,501 | **0,803** | ≥0,75 | **erfüllt** |
| Korrekte Ablehnung (Ebene C) | 80,0 % | 93,3 % | – | – |

**Fazit:** Hybrid-Retrieval hebt fast alle KPIs deutlich; Top-3 und Context Recall erreichen das
Ziel. Faithfulness bleibt unter Ziel – das ist überwiegend die Strenge/Eigenbewertung des lokalen
14B-Judge (Median 0,60), nicht ein Retrieval-Problem. Empfehlung fürs System: Hybrid produktiv
(ist integriert, `retrieval_mode='hybrid'`); zur Validierung der Faithfulness perspektivisch ein
stärkerer, separater Judge.

## 13. Limitationen
- **Selbst-Bewertungs-Bias:** qwen2.5:14b ist zugleich Antwort-Modell und Judge → mögliche
  Begünstigung qwens bei RAGAS. Matching und Robustheit sind judge-unabhängig.
- **Schwacher Judge:** ein lokales 8B/14B-Modell unterschätzt Faithfulness tendenziell und
  produziert vereinzelt unparsbare Ausgaben (NaN, im Report ausgewiesen).
- **Synthetische Profilanteile:** Teile der Datenbasis sind synthetisch erweitert.
- **Ground Truth** deckt nur Profile mit Forschungsgebieten ab (208 von 374).

## 14. Reproduzierbarkeit
Arbeitsverzeichnis `C:\dev\rag-betreuer-matching`, venv aktiv, Ollama läuft. Immer mit
`PYTHONIOENCODING=utf-8` und `PYTHONPATH` aufs Repo. Nicht `PYTHONUTF8=1` setzen (bricht das
Lesen der cp1252-`settings.json`).
```
# Finaler Lauf
python -m benchmark.run --collection lehrende --model qwen2.5:14b --judge-model qwen2.5:14b \
  --n-matching 689 --n-ragas 300 --prompt-variant v2 --out benchmark/results/final --resume
# Shootout
python -m benchmark.shootout --models qwen2.5:14b,llama3.1:8b,gemma2:9b,mistral-nemo \
  --judge qwen2.5:14b --n-matching 200 --n-ragas 60 --prompt-variant v2
```
Jeder Lauf schreibt Excel + Markdown + JSON und protokolliert Modell, Judge, Prompt-Variante,
Distraktoren, Seed und Git-Commit für die Nachvollziehbarkeit.
