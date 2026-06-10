import os
import asyncio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
import json

from backend.config import settings
from backend.ingestion.parser import parse_file
from backend.ingestion.chunker import chunk_text
from backend.ingestion.embedder import embed_texts
from backend.retrieval.vectorstore import add_chunks

router = APIRouter(prefix="/api/upload", tags=["upload"])


async def ingestion_generator(
    filename: str,
    content: bytes,
    collection: str,
    chunk_size: int,
    chunk_overlap: int,
    datentyp: str,
    fachbereich: str,
):
    def send(event: str, data: dict):
        return f"data: {json.dumps({'event': event, **data})}\n\n"

    try:
        yield send("status", {"message": "Datei wird geparst..."})
        await asyncio.sleep(0)

        text = parse_file(filename, content)
        yield send("status", {"message": f"Text extrahiert ({len(text)} Zeichen). Chunking..."})
        await asyncio.sleep(0)

        metadata = {
            "collection": collection,
            "source_file": filename,
            "fachbereich": fachbereich or "",
            "datentyp": datentyp,
        }
        chunks = chunk_text(text, chunk_size=chunk_size, chunk_overlap=chunk_overlap, metadata=metadata)
        yield send("status", {"message": f"{len(chunks)} Chunks erstellt. Embeddings werden berechnet..."})
        await asyncio.sleep(0)

        texts = [c["text"] for c in chunks]
        embeddings = embed_texts(texts)
        yield send("status", {"message": f"Embeddings fertig. Indexierung in ChromaDB..."})
        await asyncio.sleep(0)

        add_chunks(collection, chunks, embeddings, filename)
        yield send("done", {"message": f"Erfolgreich indexiert: {len(chunks)} Chunks aus '{filename}'", "chunks": len(chunks)})

    except Exception as e:
        yield send("error", {"message": str(e)})


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    collection: str = Form(...),
    chunk_size: int = Form(500),
    chunk_overlap: int = Form(50),
    datentyp: str = Form("real"),
    fachbereich: str = Form(""),
):
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Datei zu groß (max {settings.max_upload_size_mb} MB)")

    os.makedirs(settings.upload_dir, exist_ok=True)
    save_path = os.path.join(settings.upload_dir, file.filename)
    with open(save_path, "wb") as f:
        f.write(content)

    return StreamingResponse(
        ingestion_generator(file.filename, content, collection, chunk_size, chunk_overlap, datentyp, fachbereich),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
