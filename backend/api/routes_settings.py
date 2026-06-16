import json
import os
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from backend.config import settings, PROJECT_ROOT
from backend.workspaces import WORKSPACES, DEFAULT_WORKSPACE, resolve_id

router = APIRouter(prefix="/api/settings", tags=["settings"])

SETTINGS_FILE = os.path.join(PROJECT_ROOT, "data", "settings.json")


def _default_store() -> dict:
    """Neues, bereichs-fähiges Settings-Format.

    {
      "shared":     { llm_model, llm_backend, embedding_model },   # geteilt
      "workspaces": { "<id>": { system_prompt } }                  # pro Bereich
    }
    """
    return {
        "shared": {
            "llm_model": settings.llm_model,
            "llm_backend": settings.llm_backend,
            "embedding_model": settings.embedding_model,
        },
        "workspaces": {
            wid: {"system_prompt": ws.default_prompt} for wid, ws in WORKSPACES.items()
        },
    }


def _save_store(data: dict) -> None:
    os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _load_store() -> dict:
    if not os.path.exists(SETTINGS_FILE):
        return _default_store()
    with open(SETTINGS_FILE) as f:
        data = json.load(f)

    # Migration vom alten flachen Format ({system_prompt, llm_model, ...})
    if "workspaces" not in data:
        old = data
        store = _default_store()
        for key in ("llm_model", "llm_backend", "embedding_model"):
            if old.get(key):
                store["shared"][key] = old[key]
        if old.get("system_prompt"):
            store["workspaces"][DEFAULT_WORKSPACE]["system_prompt"] = old["system_prompt"]
        _save_store(store)
        return store

    # Sicherstellen, dass alle bekannten Bereiche vorhanden sind
    changed = False
    data.setdefault("shared", _default_store()["shared"])
    data.setdefault("workspaces", {})
    for wid, ws in WORKSPACES.items():
        if wid not in data["workspaces"]:
            data["workspaces"][wid] = {"system_prompt": ws.default_prompt}
            changed = True
    if changed:
        _save_store(data)
    return data


def get_effective_settings(workspace_id: str) -> dict:
    """Zusammengeführte Settings für einen Bereich (Prompt + geteilte Modelle)."""
    store = _load_store()
    wid = resolve_id(workspace_id)
    shared = store["shared"]
    ws = store["workspaces"].get(wid, {})
    return {
        "system_prompt": ws.get("system_prompt", ""),
        "llm_model": shared.get("llm_model"),
        "llm_backend": shared.get("llm_backend"),
        "embedding_model": shared.get("embedding_model"),
    }


class AppSettings(BaseModel):
    system_prompt: Optional[str] = None
    llm_model: Optional[str] = None
    llm_backend: Optional[str] = None
    embedding_model: Optional[str] = None


@router.get("")
def get_settings(workspace: str = DEFAULT_WORKSPACE):
    return get_effective_settings(workspace)


@router.post("")
def update_settings(body: AppSettings, workspace: str = DEFAULT_WORKSPACE):
    store = _load_store()
    wid = resolve_id(workspace)
    # System-Prompt ist bereichsspezifisch
    if body.system_prompt is not None:
        store["workspaces"].setdefault(wid, {})["system_prompt"] = body.system_prompt
    # Modelle sind geteilt
    if body.llm_model is not None:
        store["shared"]["llm_model"] = body.llm_model
    if body.llm_backend is not None:
        store["shared"]["llm_backend"] = body.llm_backend
    if body.embedding_model is not None:
        store["shared"]["embedding_model"] = body.embedding_model
    _save_store(store)
    return get_effective_settings(wid)
