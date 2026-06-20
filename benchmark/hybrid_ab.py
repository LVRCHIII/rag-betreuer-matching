"""A/B: dichte Suche vs. BM25 vs. Hybrid (RRF) auf der Matching-Ebene (ohne LLM).

Aufruf (venv aktiv, PYTHONIOENCODING=utf-8, PYTHONPATH=Repo):
    python -m benchmark.hybrid_ab [n_fragen]
"""
import os
import sys

from benchmark import dataset, metrics
from backend.retrieval.query import retrieve
from backend.retrieval.hybrid import hybrid_retrieve, _bm25_index, _tokenize
from backend.workspaces import to_internal

# (Label, Collection, Embedding-Modell)
COLLECTIONS = [
    ("e5-small", "lehrende", "intfloat/multilingual-e5-small"),
    ("e5-large", "lehrende_e5large", "intfloat/multilingual-e5-large"),
]


def _srcs(chunks):
    return [{"lehrende": (c.get("metadata", {}) or {}).get("lehrende", "")} for c in chunks]


def bm25_only(query, internal, k=5):
    bm25, ids, docs, metas = _bm25_index(internal)
    scores = bm25.get_scores(_tokenize(query))
    order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]
    return [{"metadata": metas[i] or {}} for i in order]


def evaluate(qs, retit):
    h1 = h3 = h5 = 0
    rr = 0.0
    for q in qs:
        m = metrics.matching_metrics(q.expected, _srcs(retit(q.question)))
        h1 += m["hit@1"]; h3 += m["hit@3"]; h5 += m["hit@5"]; rr += m["reciprocal_rank"]
    n = len(qs)
    return h1 / n, h3 / n, h5 / n, rr / n


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 689
    profs = dataset.load_profiles("lehrende", "g02")
    qs = dataset.build_matching_questions(profs, n, seed=42, unique_only=True)
    print(f"{len(qs)} eindeutige Matching-Fragen\n")

    rows = []
    # BM25 ist embedding-unabhängig (gleiche Texte) → einmal auf e5-small-Collection
    internal_small = to_internal("g02", "lehrende")
    rows.append(("BM25 (lexikalisch)", evaluate(qs, lambda q: bm25_only(q, internal_small))))

    for label, coll, model in COLLECTIONS:
        internal = to_internal("g02", coll)
        rows.append((f"dense {label}", evaluate(qs, lambda q, i=internal, m=model: retrieve(q, [i], k=5, embedding_model=m))))
        rows.append((f"hybrid {label}+BM25", evaluate(qs, lambda q, i=internal, m=model: hybrid_retrieve(q, i, k=5, embedding_model=m))))

    print(f"{'Methode':24} {'Top-1':>7} {'Top-3':>7} {'Top-5':>7} {'MRR':>7}")
    for label, (a1, a3, a5, mrr) in rows:
        print(f"{label:24} {a1*100:6.1f}% {a3*100:6.1f}% {a5*100:6.1f}% {mrr:7.3f}", flush=True)

    out_dir = "benchmark/results/hybrid_ab"
    os.makedirs(out_dir, exist_ok=True)
    lines = [
        "# Hybrid-Retrieval A/B (Matching, Ebene A)", "",
        f"- Fragen: {len(qs)} (eindeutige Ground Truth, Seed 42), Fusion: RRF (k=60)", "",
        "| Methode | Top-1 | Top-3 | Top-5 | MRR |", "|---|---|---|---|---|",
    ]
    for label, (a1, a3, a5, mrr) in rows:
        lines.append(f"| {label} | {a1*100:.1f}% | {a3*100:.1f}% | {a5*100:.1f}% | {mrr:.3f} |")
    with open(os.path.join(out_dir, "vergleich.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"\n✓ geschrieben: {out_dir}/vergleich.md")


if __name__ == "__main__":
    main()
