"""Orchestriert das automatisierte Benchmark (Ebenen A, B, C) und schreibt den Report.

Aufruf (aus der Projektwurzel, mit aktivem venv; Ollama muss laufen):

    python -m benchmark.run --collection lehrende --n-matching 300 --n-ragas 100

Der Lauf ist resümierbar: Zwischenstände landen zeilenweise in einer JSONL-Datei;
ein erneuter Aufruf mit --resume überspringt bereits bewertete Fragen.
"""
import argparse
import json
import os
import subprocess
import sys
import traceback
from datetime import date

from backend.config import settings
from benchmark import dataset, pipeline, metrics, report


def git_commit() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], stderr=subprocess.DEVNULL
        ).decode().strip()
    except Exception:
        return "unbekannt"


def load_done(path: str) -> dict:
    done = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    rec = json.loads(line)
                    done[rec["id"]] = rec
    return done


def main():
    ap = argparse.ArgumentParser(description="RAG Betreuer-Matching – automatisiertes Benchmark")
    ap.add_argument("--collection", default="lehrende")
    ap.add_argument("--workspace", default="g02")
    ap.add_argument("--n-matching", type=int, default=300, help="Anzahl Matching-Fragen (Ebene A)")
    ap.add_argument("--n-ragas", type=int, default=100, help="Stichprobe für RAGAS (Ebene B)")
    ap.add_argument("--k", type=int, default=5, help="Top-k beim Retrieval")
    ap.add_argument("--model", default=None, help="LLM für die Antworten (Default: aus Settings)")
    ap.add_argument("--judge-model", default=None, help="LLM als RAGAS-Bewerter (Default: wie --model)")
    ap.add_argument("--out", default="benchmark/results")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--no-robustness", action="store_true", help="Ebene C überspringen")
    args = ap.parse_args()

    model = args.model or settings.llm_model
    judge = args.judge_model or model

    print(f"» Lade Profile aus Collection '{args.collection}' (Workspace {args.workspace}) …")
    profiles = dataset.load_profiles(args.collection, args.workspace)
    if not profiles:
        print("FEHLER: Keine Profile gefunden. Ist die Collection indexiert?")
        sys.exit(1)
    print(f"  {len(profiles)} Profile geladen.")

    matching = dataset.build_matching_questions(profiles, args.n_matching, seed=args.seed)
    robustness = [] if args.no_robustness else dataset.build_robustness_questions()
    ragas_ids = dataset.pick_ragas_sample(matching, args.n_ragas, seed=args.seed)
    questions = matching + robustness
    print(f"  {len(matching)} Matching-Fragen, davon {len(ragas_ids)} mit RAGAS, "
          f"{len(robustness)} Robustheits-Fragen.\n")

    os.makedirs(args.out, exist_ok=True)
    jsonl = os.path.join(args.out, "run.jsonl")
    done = load_done(jsonl) if args.resume else {}
    if done:
        print(f"  Resume: {len(done)} bereits bewertete Fragen werden übersprungen.\n")

    fout = open(jsonl, "a", encoding="utf-8")
    total = len(questions)
    for idx, q in enumerate(questions, 1):
        if q.id in done:
            continue
        rec = {
            "id": q.id, "layer": q.layer, "kind": q.kind, "question": q.question,
            "expected": q.expected, "fachbereich": q.fachbereich,
        }
        try:
            chunks = pipeline.retrieve_for(q.question, args.collection, args.workspace, k=args.k)
            sources = pipeline.sources_view(chunks)
            rec["sources"] = sources

            if q.layer == "A":
                if q.id in ragas_ids:
                    q.layer = "B"          # diese Frage wird zusätzlich RAGAS-bewertet
                    rec["layer"] = "B"

            if rec["layer"] in ("A", "B"):
                rec.update(metrics.matching_metrics(q.expected, sources))

            if rec["layer"] == "B" or q.layer == "C":
                answer = pipeline.generate_answer(q.question, chunks, args.workspace, model=model)
                rec["answer"] = answer

            if rec["layer"] == "B":
                contexts = [c["text"] for c in chunks]
                rec.update(metrics.ragas_evaluate(
                    q.question, rec["answer"], contexts, q.reference, llm_model=judge))

            if q.layer == "C":
                rec.update(metrics.robustness_metrics(rec.get("answer", ""), sources))

        except Exception as e:  # einzelne Fehler nicht den ganzen Lauf abbrechen lassen
            rec["error"] = str(e)
            print(f"  [{idx}/{total}] {q.id}: FEHLER {e}")
            traceback.print_exc()

        fout.write(json.dumps(rec, ensure_ascii=False) + "\n")
        fout.flush()
        tag = rec["layer"]
        extra = ""
        if "hit@3" in rec:
            extra = f"Top3={'✓' if rec['hit@3'] else '✗'}"
        if "faithfulness" in rec:
            extra += f" faith={rec.get('faithfulness')}"
        print(f"  [{idx}/{total}] {q.id} ({tag}) {extra}")

    fout.close()

    # Report aus allen (auch zuvor gespeicherten) Datensätzen erzeugen
    records = list(load_done(jsonl).values())
    meta = {
        "date": date.today().isoformat(), "model": model, "judge_model": judge,
        "embedding_model": settings.embedding_model, "collection": args.collection,
        "k": args.k, "commit": git_commit(),
    }
    xlsx, md, js = report.write_all(records, meta, args.out)
    print(f"\n✓ Fertig. Report geschrieben:\n  {xlsx}\n  {md}\n  {js}")


if __name__ == "__main__":
    main()
