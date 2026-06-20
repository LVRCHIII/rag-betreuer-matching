"""Führt eine Frage durch dieselbe RAG-Pipeline, die auch die Chat-Oberfläche nutzt:
Retrieval (e5-Embeddings + ChromaDB) und Antwortgenerierung (Ollama) mit dem
real konfigurierten System-Prompt. So testet das Benchmark exakt das System,
das die Nutzer erleben.
"""
from typing import List, Dict, Any, Optional

import httpx

from backend.config import settings
from backend.retrieval.query import retrieve, build_context
from backend.retrieval.hybrid import hybrid_retrieve
from backend.api.routes_settings import load_settings_from_disk
from backend.llm.prompts import DEFAULT_SYSTEM_PROMPT
from backend.workspaces import to_internal


def system_prompt_for(workspace: str) -> str:
    s = load_settings_from_disk()
    ws = s.get("workspaces", {}).get(workspace, {})
    return ws.get("system_prompt") or s.get("system_prompt") or DEFAULT_SYSTEM_PROMPT


def retrieve_for(question: str, collection: str, workspace: str, k: int = 5,
                 similarity_threshold: float = 0.0,
                 extra_collections: Optional[List[str]] = None,
                 retrieval: str = "dense") -> List[Dict[str, Any]]:
    """Retrieval über die Ziel-Collection plus optionale Distraktor-Collections.
    retrieval='dense' (e5+ChromaDB) oder 'hybrid' (BM25+dense via RRF)."""
    names = [to_internal(workspace, collection)]
    for c in (extra_collections or []):
        names.append(to_internal(workspace, c))
    if retrieval == "hybrid":
        merged: List[Dict[str, Any]] = []
        for name in names:
            merged.extend(hybrid_retrieve(question, name, k=k))
        merged.sort(key=lambda x: x["score"], reverse=True)
        return merged[:k]
    return retrieve(question, names, k=k, similarity_threshold=similarity_threshold)


def generate_answer(question: str, chunks: List[Dict[str, Any]], workspace: str,
                    model: Optional[str] = None, temperature: float = 0.15,
                    system_prompt: Optional[str] = None) -> str:
    """Erzeugt die Antwort wie routes_chat: System-Prompt + Kontext + Frage (nicht-streamend).
    system_prompt überschreibt den aus den Settings (für A/B-Tests des Prompts)."""
    context = build_context(chunks)
    sysp = system_prompt or system_prompt_for(workspace)
    if context:
        full_system = f"{sysp}\n\n---\nKontext aus der Wissensbasis:\n\n{context}"
    else:
        full_system = (
            f"{sysp}\n\n---\n"
            "Für diese Anfrage wurden KEINE Kontextauszüge aus der Wissensbasis gefunden. "
            "Du darfst KEINE Betreuenden, Namen oder Forschungsgebiete nennen. Antworte kurz "
            "und ehrlich, dass du auf Basis der aktuellen Datenbasis niemanden empfehlen kannst."
        )
    messages = [
        {"role": "system", "content": full_system},
        {"role": "user", "content": question},
    ]
    payload = {
        "model": model or settings.llm_model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature},
    }
    r = httpx.post(f"{settings.ollama_base_url}/api/chat", json=payload, timeout=600)
    r.raise_for_status()
    return r.json().get("message", {}).get("content", "")


def sources_view(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Kompakte Quellen-Darstellung für den Report."""
    return [
        {
            "lehrende": (c.get("metadata", {}) or {}).get("lehrende", ""),
            "fachbereich": (c.get("metadata", {}) or {}).get("fachbereich", ""),
            "score": c.get("score"),
            "datentyp": (c.get("metadata", {}) or {}).get("datentyp", "real"),
        }
        for c in chunks
    ]
