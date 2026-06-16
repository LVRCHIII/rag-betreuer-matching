"""BHT-Scraper-Endpoint: hält eine Collection mit Professoren-Profilen aktuell.

Pipeline: Verzeichnis scrapen → Profilseiten laden → Homepages per LLM
anreichern → ein Chunk pro Person mit stabiler ID upserten → verschwundene
Profile löschen. Jeder Chunk trägt Quellen-Metadaten (URL, Abrufdatum,
KI-Kennzeichnung) für die Transparenz im Chat.
"""

import asyncio
import json
import os
import time
from datetime import date, datetime
from typing import Optional

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.ingestion.embedder import embed_texts
from backend.retrieval.vectorstore import upsert_chunks, get_ids_by_metadata, delete_ids
from backend.scraper.bht_scraper import (
    ProfessorProfile,
    fetch_professor_list,
    fetch_profile_details,
    fetch_homepage_text,
    polite_delay,
    DIRECTORY_URL,
)
from backend.scraper.enricher import enrich_profile, enrichment_to_text

router = APIRouter(prefix="/api/scraper", tags=["scraper"])

STATE_PATH = "./data/scraper_state.json"
DEFAULT_COLLECTION = "bht_professoren"


class ScraperRequest(BaseModel):
    collection: str = DEFAULT_COLLECTION
    limit: Optional[int] = None
    enrich: bool = True
    llm_model: Optional[str] = None


def load_state() -> dict:
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_state(state: dict) -> None:
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def build_chunk(profile: ProfessorProfile, scraped_at: str, collection: str) -> tuple[str, str, dict]:
    """Baut (id, text, metadata) für einen Professor — ein Chunk pro Person."""
    lines = [profile.name]
    if profile.position:
        lines.append(f"Position: {profile.position}")
    if profile.fachbereich:
        lines.append(f"Fachbereich: {profile.fachbereich}")
    if profile.ort:
        lines.append(f"Ort: {profile.ort}")
    if profile.sprechzeiten:
        lines.append(f"Sprechzeiten: {profile.sprechzeiten}")
    if profile.email:
        lines.append(f"E-Mail: {profile.email}")
    if profile.telefon:
        lines.append(f"Telefon: {profile.telefon}")
    lines.append(f"Profil: {profile.profile_url} (abgerufen am {scraped_at})")

    enrichment_block = enrichment_to_text(profile.enrichment, profile.homepage_url, scraped_at)
    if enrichment_block:
        lines.append("")
        lines.append(enrichment_block)

    metadata = {
        "collection": collection,
        "source_file": f"BHT-Website: {profile.name}",
        "source_url": profile.profile_url,
        "homepage_url": profile.homepage_url or "",
        "scraped_at": scraped_at,
        "fachbereich": profile.fachbereich or "",
        "lehrende": profile.name,
        "datentyp": "real",
        "quelle": "bht_scraper",
        "llm_enriched": "ja" if profile.enrichment else "nein",
        "chunk_index": 0,
    }
    return f"bht_prof_{profile.detail_id}", "\n".join(lines), metadata


async def scraper_generator(req: ScraperRequest):
    def sse(event: str, data: dict):
        return f"data: {json.dumps({'event': event, **data})}\n\n"

    started = time.time()
    scraped_at = date.today().isoformat()
    errors = []

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            yield sse("status", {"message": f"Lade Professuren-Verzeichnis ({DIRECTORY_URL})..."})
            profiles = await fetch_professor_list(client)
            if req.limit:
                profiles = profiles[: req.limit]
            total = len(profiles)
            yield sse("status", {"message": f"{total} Professor:innen gefunden. Lade Profilseiten...", "total": total})

            enriched_count = 0
            for i, profile in enumerate(profiles):
                yield sse("progress", {"current": i + 1, "total": total, "name": profile.name, "phase": "profil"})
                try:
                    await fetch_profile_details(client, profile)
                    await polite_delay()

                    if req.enrich and profile.homepage_url:
                        yield sse("progress", {"current": i + 1, "total": total, "name": profile.name, "phase": "ki"})
                        try:
                            profile.homepage_text = await fetch_homepage_text(client, profile.homepage_url)
                            await polite_delay()
                            profile.enrichment = await enrich_profile(profile, req.llm_model)
                            if profile.enrichment:
                                enriched_count += 1
                        except Exception as e:
                            errors.append(f"{profile.name} (Anreicherung): {e}")
                except Exception as e:
                    errors.append(f"{profile.name}: {e}")

        yield sse("status", {"message": "Berechne Embeddings..."})
        ids, documents, metadatas = [], [], []
        for profile in profiles:
            chunk_id, text, metadata = build_chunk(profile, scraped_at, req.collection)
            ids.append(chunk_id)
            documents.append(text)
            metadatas.append(metadata)

        embeddings = await asyncio.to_thread(embed_texts, documents)

        yield sse("status", {"message": f"Indexiere {len(ids)} Profile in '{req.collection}'..."})
        await asyncio.to_thread(upsert_chunks, req.collection, ids, documents, metadatas, embeddings)

        # Profile entfernen, die nicht mehr im Verzeichnis stehen (nur bei vollem Lauf)
        removed = 0
        if not req.limit:
            existing = await asyncio.to_thread(get_ids_by_metadata, req.collection, {"quelle": "bht_scraper"})
            stale = [eid for eid in existing if eid not in set(ids)]
            if stale:
                await asyncio.to_thread(delete_ids, req.collection, stale)
                removed = len(stale)

        stats = {
            "professors": len(ids),
            "enriched": enriched_count,
            "removed": removed,
            "errors": len(errors),
            "duration_s": round(time.time() - started, 1),
        }
        state = load_state()
        state.update({
            "last_run": datetime.now().isoformat(timespec="seconds"),
            "collection": req.collection,
            "enrich": req.enrich,
            "stats": stats,
            "error_details": errors[:20],
        })
        save_state(state)

        yield sse("done", {
            "message": f"Fertig: {len(ids)} Profile indexiert, {enriched_count} per KI angereichert, {removed} entfernt.",
            **stats,
        })
    except Exception as e:
        yield sse("error", {"message": str(e)})


@router.post("/run")
async def run_scraper(req: ScraperRequest):
    return StreamingResponse(
        scraper_generator(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/status")
async def scraper_status():
    return load_state()
