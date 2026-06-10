import json
import os
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from backend.llm.prompts import DEFAULT_SYSTEM_PROMPT
from backend.config import settings

router = APIRouter(prefix="/api/settings", tags=["settings"])

SETTINGS_FILE = "./data/settings.json"


def load_settings_from_disk() -> dict:
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE) as f:
            return json.load(f)
    return {
        "system_prompt": DEFAULT_SYSTEM_PROMPT,
        "llm_model": settings.llm_model,
        "llm_backend": settings.llm_backend,
        "embedding_model": settings.embedding_model,
    }


def save_settings_to_disk(data: dict) -> None:
    os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


class AppSettings(BaseModel):
    system_prompt: Optional[str] = None
    llm_model: Optional[str] = None
    llm_backend: Optional[str] = None
    embedding_model: Optional[str] = None


@router.get("")
def get_settings():
    return load_settings_from_disk()


@router.post("")
def update_settings(body: AppSettings):
    current = load_settings_from_disk()
    if body.system_prompt is not None:
        current["system_prompt"] = body.system_prompt
    if body.llm_model is not None:
        current["llm_model"] = body.llm_model
    if body.llm_backend is not None:
        current["llm_backend"] = body.llm_backend
    if body.embedding_model is not None:
        current["embedding_model"] = body.embedding_model
    save_settings_to_disk(current)
    return current
