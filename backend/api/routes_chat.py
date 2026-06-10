import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from backend.retrieval.query import retrieve, build_context
from backend.llm.client import stream_llm
from backend.api.routes_settings import load_settings_from_disk

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


async def chat_generator(req: ChatRequest):
    def sse(event: str, data: dict):
        return f"data: {json.dumps({'event': event, **data})}\n\n"

    app_settings = load_settings_from_disk()
    system_prompt = app_settings.get("system_prompt", "")

    user_query = next(
        (m.content for m in reversed(req.messages) if m.role == "user"), ""
    )

    chunks = []
    if req.collections:
        chunks = retrieve(
            user_query,
            req.collections,
            k=req.k,
            similarity_threshold=req.similarity_threshold,
            embedding_model=req.embedding_model,
        )

    context = build_context(chunks)
    sources = [
        {"text": c["text"][:200], "metadata": c["metadata"], "score": c["score"], "collection": c["collection"]}
        for c in chunks
    ]

    messages = []
    if system_prompt:
        if context:
            full_system = f"{system_prompt}\n\n---\nKontext aus der Wissensbasis:\n\n{context}"
        else:
            full_system = system_prompt
        messages.append({"role": "system", "content": full_system})

    for m in req.messages:
        messages.append({"role": m.role, "content": m.content})

    yield sse("sources", {"sources": sources})

    async for token in stream_llm(messages, model=req.llm_model, backend=req.llm_backend):
        yield sse("token", {"token": token})

    yield sse("done", {})


@router.post("")
async def chat(req: ChatRequest):
    return StreamingResponse(
        chat_generator(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
