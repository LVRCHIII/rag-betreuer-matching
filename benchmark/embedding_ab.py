"""Embedding-A/B: vergleicht Retrieval-Modelle auf der Matching-Ebene (Ebene A, ohne LLM).

Voraussetzung: Die Profile sind je Modell in eine eigene Collection indexiert
(`lehrende`=e5-small, `lehrende_e5large`=e5-large, `lehrende_bge`=BGE-m3). Query- und
Index-Embedding nutzen jeweils dasselbe Modell. Gleiche Fragen (fester Seed) für alle.

Aufruf (venv aktiv, PYTHONIOENCODING=utf-8, PYTHONPATH=Repo):
    python -m benchmark.embedding_ab [n_fragen]
"""
import os
import sys

from benchmark import dataset, metrics
from backend.retrieval.query import retrieve
from backend.workspaces import to_internal

CONFIGS = [
    ("e5-small (Baseline)", "lehrende", "intfloat/multilingual-e5-small"),
    ("e5-large", "lehrende_e5large", "intfloat/multilingual-e5-large"),
    ("BGE-m3", "lehrende_bge", "BAAI/bge-m3"),
]


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 689
    profs = dataset.load_profiles("lehrende", "g02")
    qs = dataset.build_matching_questions(profs, n, seed=42, unique_only=True)
    print(f"{len(qs)} eindeutige Matching-Fragen, {len(CONFIGS)} Embedding-Modelle\n")

    rows = []
    for label, coll, model in CONFIGS:
        internal = to_internal("g02", coll)
        h1 = h3 = h5 = 0
        rr = 0.0
        for q in qs:
            ch = retrieve(q.question, [internal], k=5, embedding_model=model)
            srcs = [{"lehrende": (c.get("metadata", {}) or {}).get("lehrende", "")} for c in ch]
            m = metrics.matching_metrics(q.expected, srcs)
            h1 += m["hit@1"]; h3 += m["hit@3"]; h5 += m["hit@5"]; rr += m["reciprocal_rank"]
        k = len(qs)
        rows.append((label, model, h1 / k, h3 / k, h5 / k, rr / k))
        print(f"{label:22} Top1={h1/k*100:5.1f}%  Top3={h3/k*100:5.1f}%  "
              f"Top5={h5/k*100:5.1f}%  MRR={rr/k:.3f}", flush=True)

    out_dir = "benchmark/results/embedding_ab"
    os.makedirs(out_dir, exist_ok=True)
    lines = [
        "# Embedding-A/B – Retrieval-Vergleich (Matching, Ebene A)", "",
        f"- Fragen: {len(qs)} (eindeutige Ground Truth, Seed 42, profilfokussiert)",
        "- Query- und Index-Embedding je Modell identisch.", "",
        "| Embedding-Modell | Top-1 | Top-3 | Top-5 | MRR |",
        "|---|---|---|---|---|",
    ]
    for label, model, a1, a3, a5, mrr in rows:
        lines.append(f"| {label} (`{model}`) | {a1*100:.1f}% | {a3*100:.1f}% | {a5*100:.1f}% | {mrr:.3f} |")
    with open(os.path.join(out_dir, "vergleich.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"\n✓ geschrieben: {out_dir}/vergleich.md")


if __name__ == "__main__":
    main()
