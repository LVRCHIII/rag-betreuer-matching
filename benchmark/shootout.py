"""Modell-Shootout: lässt mehrere LLMs auf DENSELBEN Fragen antworten, bewertet
von DEMSELBEN festen Judge, und erzeugt eine Vergleichstabelle.

Sauber heißt hier: nur das Antwort-Modell variiert; Fragen (fester Seed), Retrieval,
Judge-Modell, Prompt-Variante und alle Parameter bleiben konstant. Jeder Modell-Lauf
schreibt in ein eigenes Unterverzeichnis und ist via --resume fortsetzbar.

Aufruf (aus der Projektwurzel, venv aktiv, PYTHONIOENCODING=utf-8):
    python -m benchmark.shootout --models qwen2.5:14b,llama3.1:8b,gemma2:9b,mistral-nemo \
        --judge qwen2.5:14b --n-matching 200 --n-ragas 60 \
        --extra-collections modulhandbuecher,abschlussarbeiten --prompt-variant v2
"""
import argparse
import glob
import json
import os
import subprocess
import sys


def latest_raw(out_dir: str):
    files = sorted(glob.glob(os.path.join(out_dir, "eval_raw_*.json")))
    if not files:
        return None
    with open(files[-1], encoding="utf-8") as f:
        return json.load(f)


def run_model(model, judge, args, out_dir):
    cmd = [
        sys.executable, "-m", "benchmark.run",
        "--collection", args.collection, "--workspace", args.workspace,
        "--model", model, "--judge-model", judge,
        "--n-matching", str(args.n_matching), "--n-ragas", str(args.n_ragas),
        "--k", str(args.k), "--seed", str(args.seed),
        "--prompt-variant", args.prompt_variant, "--min-score", str(args.min_score),
        "--out", out_dir, "--resume",
    ]
    if args.extra_collections:
        cmd += ["--extra-collections", args.extra_collections]
    if args.per_profile:
        cmd += ["--per-profile", str(args.per_profile)]
    env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONPATH=os.getcwd())
    print(f"\n=== Modell {model} (Judge {judge}) → {out_dir} ===", flush=True)
    subprocess.run(cmd, env=env, check=False)


def main():
    ap = argparse.ArgumentParser(description="LLM-Shootout für das RAG Betreuer-Matching")
    ap.add_argument("--models", required=True, help="kommagetrennt")
    ap.add_argument("--judge", required=True, help="fester Judge für ALLE Modelle")
    ap.add_argument("--collection", default="lehrende")
    ap.add_argument("--workspace", default="g02")
    ap.add_argument("--extra-collections", default="modulhandbuecher,abschlussarbeiten")
    ap.add_argument("--n-matching", type=int, default=200)
    ap.add_argument("--n-ragas", type=int, default=60)
    ap.add_argument("--per-profile", type=int, default=None)
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--min-score", type=float, default=0.0)
    ap.add_argument("--prompt-variant", default="v2", choices=["current", "v2"])
    ap.add_argument("--out", default="benchmark/results/shootout")
    args = ap.parse_args()

    models = [m.strip() for m in args.models.split(",") if m.strip()]
    os.makedirs(args.out, exist_ok=True)

    for model in models:
        out_dir = os.path.join(args.out, model.replace(":", "_").replace("/", "_"))
        os.makedirs(out_dir, exist_ok=True)
        run_model(model, args.judge, args, out_dir)

    # --- Vergleichstabelle bauen ---
    rows = []
    for model in models:
        out_dir = os.path.join(args.out, model.replace(":", "_").replace("/", "_"))
        data = latest_raw(out_dir)
        if not data:
            print(f"WARN: kein Ergebnis für {model}")
            continue
        a = data["aggregate"]["layer_a"]
        b = data["aggregate"]["layer_b"]
        c = data["aggregate"]["layer_c"]
        cnt = data["aggregate"]["counts"]
        rows.append((model, a, b, c, cnt))

    def f(x, p=False):
        if x is None:
            return "—"
        return f"{x*100:.1f}%" if p else f"{x:.3f}"

    lines = [
        "# Modell-Shootout – RAG Betreuer-Matching", "",
        f"- Judge (fest): **{args.judge}** · Prompt: **{args.prompt_variant}** · "
        f"Distraktoren: {args.extra_collections or '-'} · k={args.k} · Seed={args.seed}",
        f"- Matching n={args.n_matching}, RAGAS n={args.n_ragas} (identische Fragen je Modell)", "",
        "| Modell | Top-3 | MRR | Faithfulness | Answer Rel. | Context Recall | Ablehnung (C) | Deutsch | RAGAS-Fehler |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for model, a, b, c, cnt in rows:
        lines.append(
            f"| {model} | {f(a['hit@3'], True)} | {f(a['mrr'])} | "
            f"{f(b['faithfulness_mean'])} | {f(b['answer_relevancy_mean'])} | "
            f"{f(b['context_recall_mean'])} | {f(c.get('correct_refusal'), True)} | "
            f"{f(c['german'], True)} | {cnt['errors']} |"
        )
    out_md = os.path.join(args.out, "shootout_vergleich.md")
    with open(out_md, "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines))
    print("\n".join(lines))
    print(f"\n✓ Vergleich geschrieben: {out_md}")


if __name__ == "__main__":
    main()
