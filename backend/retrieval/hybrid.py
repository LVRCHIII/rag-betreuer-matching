"""Hybrides Retrieval: kombiniert dichte Suche (e5-Embeddings + ChromaDB) mit
lexikalischer Suche (BM25) über Reciprocal Rank Fusion (RRF).

Hintergrund: Forschungsgebiete sind oft exakte Fachbegriffe, die BM25 zuverlässig
findet, während dichte Embeddings sie im Profil-Chunk verwässern. RRF fusioniert
rein über die Rangplätze – keine fragile Score-Normalisierung nötig.
"""
import re
from functools import lru_cache
from typing import List, Dict, Any

from rank_bm25 import BM25Okapi

from backend.ingestion.embedder import embed_texts
from backend.retrieval.vectorstore import get_or_create_collection

_TOKEN = re.compile(r"\w+", re.UNICODE)


def _tokenize(text: str) -> List[str]:
    return [t for t in _TOKEN.findall((text or "").lower()) if len(t) >= 2]


@lru_cache(maxsize=8)
def _bm25_index(collection_name: str):
    """Baut (und cacht) den BM25-Index + Dokumentliste einer Collection."""
    col = get_or_create_collection(collection_name)
    data = col.get(include=["documents", "metadatas"])
    ids = data["ids"]
    docs = data["documents"]
    metas = data["metadatas"]
    bm25 = BM25Okapi([_tokenize(d) for d in docs])
    return bm25, ids, docs, metas


def hybrid_retrieve(query: str, collection_name: str, k: int = 5,
                    embedding_model: str = None, candidates: int = 30,
                    rrf_k: int = 60) -> List[Dict[str, Any]]:
    """Top-k Chunks aus einer Collection via RRF(dense, bm25).

    candidates = wie viele Top-Treffer je Ranker in die Fusion einfließen.
    rrf_k = RRF-Glättungskonstante (Standard 60).
    """
    bm25, ids, docs, metas = _bm25_index(collection_name)
    by_id = {cid: (doc, meta) for cid, doc, meta in zip(ids, docs, metas)}

    # --- dichte Suche (ChromaDB) ---
    col = get_or_create_collection(collection_name)
    emb = embed_texts([query], model_name=embedding_model, is_query=True)[0]
    n = min(candidates, col.count())
    dres = col.query(query_embeddings=[emb], n_results=n,
                     include=["distances"])
    dense_ids = dres["ids"][0]

    # --- lexikalische Suche (BM25) ---
    scores = bm25.get_scores(_tokenize(query))
    bm25_order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:candidates]
    bm25_ids = [ids[i] for i in bm25_order]

    # --- Reciprocal Rank Fusion ---
    fused: Dict[str, float] = {}
    for rank, cid in enumerate(dense_ids):
        fused[cid] = fused.get(cid, 0.0) + 1.0 / (rrf_k + rank)
    for rank, cid in enumerate(bm25_ids):
        fused[cid] = fused.get(cid, 0.0) + 1.0 / (rrf_k + rank)

    top = sorted(fused.items(), key=lambda x: x[1], reverse=True)[:k]
    out = []
    for cid, score in top:
        doc, meta = by_id.get(cid, ("", {}))
        out.append({"text": doc, "metadata": meta or {}, "score": round(score, 5),
                    "collection": collection_name})
    return out
