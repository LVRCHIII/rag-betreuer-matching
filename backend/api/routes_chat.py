import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from backend.config import settings
from backend.retrieval.query import retrieve, build_context
from backend.llm.client import stream_llm
from backend.api.routes_settings import load_settings_from_disk
from backend.llm.prompts import DEFAULT_SYSTEM_PROMPT
from backend.workspaces import DEFAULT_WORKSPACE, to_internal, to_display

router = APIRouter(prefix="/api/chat", tags=["chat"])


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    collections: List[str]
    k: int = 5
    similarity_threshold: float = 0.0
    llm_model: Optional[str] = None
    llm_backend: Optional[str] = None
    embedding_model: Optional[str] = None


async def chat_generator(req: ChatRequest, workspace: str = DEFAULT_WORKSPACE):
    def sse(event: str, data: dict):
        return f"data: {json.dumps({'event': event, **data})}\n\n"

    app_settings = load_settings_from_disk()
    ws_settings = app_settings.get("workspaces", {}).get(workspace, {})
    system_prompt = (
        ws_settings.get("system_prompt")
        or app_settings.get("system_prompt")
        or DEFAULT_SYSTEM_PROMPT
    )

    user_query = next(
        (m.content for m in reversed(req.messages) if m.role == "user"), ""
    )

    chunks = []
    if req.collections:
        # Frontend sendet Display-Namen; ChromaDB-Collections sind pro Workspace
        # mit Prefix gespeichert (z. B. g02_lehrende). Daher hier auflösen.
        internal_collections = [to_internal(workspace, c) for c in req.collections]
        chunks = retrieve(
            user_query,
            internal_collections,
            k=req.k,
            similarity_threshold=req.similarity_threshold,
            embedding_model=req.embedding_model,
            mode=settings.retrieval_mode,
        )

    context = build_context(chunks)
    sources = [
        {
            "text": c["text"],
            "metadata": c["metadata"],
            "score": c["score"],
            "collection": to_display(workspace, c["collection"]),
        }
        for c in chunks
    ]

    # Wissensbasis ausgewählt, aber nichts Passendes gefunden: deterministisch und
    # ehrlich antworten, statt das LLM Personen erfinden zu lassen (Faktentreue).
    if req.collections and not chunks:
        yield sse("sources", {"sources": []})
        yield sse("token", {"token": (
            "Auf Basis der aktuellen Datenbasis kann ich dir dazu leider niemanden "
            "empfehlen. Beschreibe dein Thema gern etwas anders oder genauer – oder "
            "prüfe, ob oben die passende Wissensbasis ausgewählt ist."
        )})
        yield sse("done", {})
        return

    messages = []
    if system_prompt:
        if context:
            full_system = f"{system_prompt}\n\n---\nKontext aus der Wissensbasis:\n\n{context}"
        else:
            full_system = (
                f"{system_prompt}\n\n---\n"
                "Für diese Anfrage wurden KEINE Kontextauszüge aus der Wissensbasis gefunden. "
                "Das heißt: Du darfst KEINE Betreuenden, Namen, Forschungsgebiete oder Module nennen – "
                "dir liegen dazu keine belegten Informationen vor. Erfinde unter keinen Umständen Personen. "
                "Antworte ausschließlich kurz und ehrlich, dass du auf Basis der aktuellen Datenbasis "
                "niemanden empfehlen kannst. Ist das Thema noch vage, stell stattdessen eine kurze Rückfrage."
            )
        messages.append({"role": "system", "content": full_system})

    for m in req.messages:
        messages.append({"role": m.role, "content": m.content})

    yield sse("sources", {"sources": sources})

    async for token in stream_llm(messages, model=req.llm_model, backend=req.llm_backend):
        yield sse("token", {"token": token})

    yield sse("done", {})


@router.post("")
async def chat(req: ChatRequest, workspace: str = DEFAULT_WORKSPACE):
    return StreamingResponse(
        chat_generator(req, workspace),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
