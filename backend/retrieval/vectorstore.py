import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import List, Dict, Any, Optional
from backend.config import settings
from functools import lru_cache


@lru_cache(maxsize=1)
def get_client() -> chromadb.PersistentClient:
    return chromadb.PersistentClient(
        path=settings.chroma_persist_dir,
        settings=ChromaSettings(anonymized_telemetry=False),
    )


def get_or_create_collection(name: str) -> chromadb.Collection:
    client = get_client()
    return client.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})


def add_chunks(
    collection_name: str,
    chunks: List[Dict[str, Any]],
    embeddings: List[List[float]],
    source_file: str,
) -> None:
    col = get_or_create_collection(collection_name)
    ids = [f"{source_file}::chunk_{c['metadata']['chunk_index']}" for c in chunks]
    documents = [c["text"] for c in chunks]
    metadatas = [c["metadata"] for c in chunks]
    col.add(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)


def query_collections(
    collection_names: List[str],
    query_embedding: List[float],
    k: int = 5,
    similarity_threshold: float = 0.0,
) -> List[Dict[str, Any]]:
    results = []
    for name in collection_names:
        try:
            col = get_or_create_collection(name)
            res = col.query(
                query_embeddings=[query_embedding],
                n_results=min(k, col.count()),
                include=["documents", "metadatas", "distances"],
            )
            if not res["ids"][0]:
                continue
            for doc, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
                score = 1 - dist  # cosine distance → similarity
                if score >= similarity_threshold:
                    results.append({
                        "text": doc,
                        "metadata": meta,
                        "score": round(score, 4),
                        "collection": name,
                    })
        except Exception:
            continue
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:k]


def list_collections() -> List[Dict[str, Any]]:
    client = get_client()
    cols = client.list_collections()
    result = []
    for col in cols:
        c = client.get_collection(col.name)
        result.append({"name": col.name, "count": c.count()})
    return result


def delete_collection(name: str) -> None:
    client = get_client()
    client.delete_collection(name)


def get_collection_files(name: str) -> List[str]:
    col = get_or_create_collection(name)
    if col.count() == 0:
        return []
    res = col.get(include=["metadatas"])
    files = set()
    for meta in res["metadatas"]:
        if meta and "source_file" in meta:
            files.add(meta["source_file"])
    return sorted(files)


def delete_file_from_collection(collection_name: str, source_file: str) -> int:
    col = get_or_create_collection(collection_name)
    res = col.get(where={"source_file": source_file}, include=["metadatas"])
    ids = res["ids"]
    if ids:
        col.delete(ids=ids)
    return len(ids)
