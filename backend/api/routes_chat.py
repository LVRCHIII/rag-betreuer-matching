import json
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from backend.retrieval.query import retrieve, build_context
from backend.llm.client import stream_llm
from backend.api.routes_settings import get_effective_settings
from backend.ingestion.parser import parse_file
from backend.workspaces import DEFAULT_WORKSPACE, to_internal, to_display

router = APIRouter(prefix="/api/chat", tags=["chat"])

MAX_ATTACHMENT_CHARS = 12000


class Message(BaseModel):
    role: str
    content: str


class Attachment(BaseModel):
    name: str
    text: str


class ChatRequest(BaseModel):
    messages: List[Message]
    collections: List[str]
    workspace: str = DEFAULT_WORKSPACE
    attachments: List[Attachment] = []
    k: int = 5
    similarity_threshold: float = 0.0
    llm_model: Optional[str] = None
    llm_backend: Optional[str] = None
    embedding_model: Optional[str] = None


async def chat_generator(req: ChatRequest):
    def sse(event: str, data: dict):
        return f"data: {json.dumps({'event': event, **data})}\n\n"

    app_settings = get_effective_settings(req.workspace)
    system_prompt = app_settings.get("system_prompt", "")

    user_query = next(
        (m.content for m in reversed(req.messages) if m.role == "user"), ""
    )

    retrieval_query = user_query
    if req.attachments:
        retrieval_query += "\n\n" + "\n\n".join(a.text[:2000] for a in req.attachments)

    chunks = []
    if req.collections:
        internal_collections = [to_internal(req.workspace, c) for c in req.collections]
        chunks = retrieve(
            retrieval_query,
            internal_collections,
            k=req.k,
            similarity_threshold=req.similarity_threshold,
            embedding_model=req.embedding_model,
        )

    context = build_context(chunks)
    sources = [
        {"text": c["text"][:800], "metadata": c["metadata"], "score": c["score"], "collection": to_display(req.workspace, c["collection"])}
        for c in chunks
    ]

    messages = []
    if system_prompt:
        full_system = system_prompt
        if context:
            full_system += (
                "\n\n---\nNummerierte Kontextauszüge aus der Wissensbasis "
                "(nur als Wissensgrundlage verwenden, niemals wörtlich wiedergeben):\n\n"
                f"{context}"
            )
        if req.attachments:
            att_parts = [
                f"Dokument '{a.name}':\n{a.text[:MAX_ATTACHMENT_CHARS]}"
                for a in req.attachments
            ]
            full_system += (
                "\n\n---\nVom Studierenden hochgeladene Dokumente "
                "(zusätzliche Informationen über den Studierenden, z. B. Zeugnis oder Exposé):\n\n"
                + "\n\n".join(att_parts)
            )
        messages.append({"role": "system", "content": full_system})

    for m in req.messages:
        messages.append({"role": m.role, "content": m.content})

    yield sse("sources", {"sources": sources})

    # Request-Werte > gespeicherte Settings > .env-Defaults
    model = req.llm_model or app_settings.get("llm_model")
    backend = req.llm_backend or app_settings.get("llm_backend")

    try:
        async for token in stream_llm(messages, model=model, backend=backend):
            yield sse("token", {"token": token})
    except Exception as e:
        yield sse("error", {"message": f"LLM-Fehler: {e}"})
        return

    yield sse("done", {})


@router.post("/parse")
async def parse_attachment(file: UploadFile = File(...)):
    content = await file.read()
    try:
        text = parse_file(file.filename, content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Datei konnte nicht gelesen werden: {e}")
    truncated = len(text) > MAX_ATTACHMENT_CHARS
    return {"name": file.filename, "text": text[:MAX_ATTACHMENT_CHARS], "truncated": truncated}


@router.post("")
async def chat(req: ChatRequest):
    return StreamingResponse(
        chat_generator(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
