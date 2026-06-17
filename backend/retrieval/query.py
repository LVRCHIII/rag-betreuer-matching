from typing import List, Dict, Any
from backend.ingestion.embedder import embed_texts
from backend.retrieval.vectorstore import query_collections


def retrieve(
    query: str,
    collection_names: List[str],
    k: int = 5,
    similarity_threshold: float = 0.0,
    embedding_model: str = None,
) -> List[Dict[str, Any]]:
    embeddings = embed_texts([query], model_name=embedding_model, is_query=True)
    return query_collections(collection_names, embeddings[0], k=k, similarity_threshold=similarity_threshold)


def build_context(chunks: List[Dict[str, Any]]) -> str:
    parts = []
    for i, chunk in enumerate(chunks, 1):
        meta = chunk.get("metadata", {})
        source = meta.get("source_file", "unbekannt")
        collection = chunk.get("collection", "")
        datentyp = meta.get("datentyp", "real")
        label = "[Synthetische Datenbasis] " if datentyp == "synthetisch" else ""
        if meta.get("source_url"):
            source = f"{source}, {meta['source_url']}"
            if meta.get("scraped_at"):
                source += f", abgerufen am {meta['scraped_at']}"
        if meta.get("llm_enriched") == "ja":
            label += "[Teilweise KI-extrahiert, siehe Kennzeichnung im Text] "
        parts.append(f"[{i}] {label}Quelle: {source} (Collection: {collection})\n{chunk['text']}")
    return "\n\n---\n\n".join(parts)
