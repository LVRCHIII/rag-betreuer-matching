"""LLM-Anreicherung gescrapter Professoren-Profile.

Das lokale Ollama-Modell extrahiert Forschungsschwerpunkte und Themen aus dem
Text der Homepage/Laborseite. Es darf NUR Informationen übernehmen, die im
Quelltext stehen — keine Ergänzungen aus Modellwissen.
"""

import json
from typing import Optional

import httpx

from backend.config import settings
from backend.scraper.bht_scraper import ProfessorProfile

EXTRACTION_PROMPT = """Du extrahierst Fakten aus dem Text einer Hochschul-Webseite über eine Professorin oder einen Professor.

Person: {name}
Position laut BHT-Verzeichnis: {position}

Extrahiere AUSSCHLIESSLICH Informationen, die wörtlich oder sinngemäß im folgenden Seitentext stehen. Erfinde nichts, ergänze nichts aus eigenem Wissen. Wenn zu einem Feld nichts im Text steht, gib eine leere Liste bzw. einen leeren String zurück.

Antworte als JSON-Objekt mit genau diesen Feldern:
{{"forschungsschwerpunkte": ["..."], "themen_abschlussarbeiten": ["..."], "lehrgebiete": ["..."], "projekte_labore": ["..."], "zusammenfassung": "1-2 Sätze, nur aus dem Text belegbar"}}

Seitentext:
---
{page_text}
---"""


async def enrich_profile(
    profile: ProfessorProfile,
    llm_model: Optional[str] = None,
) -> dict:
    """Extrahiert strukturierte Infos aus profile.homepage_text via Ollama (JSON-Modus)."""
    if not profile.homepage_text:
        return {}

    model = llm_model or settings.llm_model
    prompt = EXTRACTION_PROMPT.format(
        name=profile.name,
        position=profile.position or "unbekannt",
        page_text=profile.homepage_text,
    )

    async with httpx.AsyncClient(timeout=300) as client:
        res = await client.post(
            f"{settings.ollama_base_url}/api/chat",
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "format": "json",
                "options": {"temperature": 0},
            },
        )
        res.raise_for_status()
        content = res.json().get("message", {}).get("content", "")

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return {}

    cleaned = {}
    for key in ("forschungsschwerpunkte", "themen_abschlussarbeiten", "lehrgebiete", "projekte_labore"):
        values = data.get(key)
        if isinstance(values, list):
            values = [str(v).strip() for v in values if str(v).strip()]
            if values:
                cleaned[key] = values
    summary = data.get("zusammenfassung")
    if isinstance(summary, str) and summary.strip():
        cleaned["zusammenfassung"] = summary.strip()
    return cleaned


FIELD_LABELS = {
    "forschungsschwerpunkte": "Forschungsschwerpunkte",
    "themen_abschlussarbeiten": "Themen für Abschlussarbeiten",
    "lehrgebiete": "Lehrgebiete",
    "projekte_labore": "Projekte und Labore",
    "zusammenfassung": "Zusammenfassung",
}


def enrichment_to_text(enrichment: dict, source_url: str, scraped_at: str) -> str:
    """Formatiert die LLM-Extraktion als gekennzeichneten Textblock für den Chunk."""
    if not enrichment:
        return ""
    lines = [f"[KI-extrahiert von {source_url}, abgerufen am {scraped_at}]"]
    for key, label in FIELD_LABELS.items():
        value = enrichment.get(key)
        if not value:
            continue
        if isinstance(value, list):
            lines.append(f"{label}: {'; '.join(value)}")
        else:
            lines.append(f"{label}: {value}")
    return "\n".join(lines)
