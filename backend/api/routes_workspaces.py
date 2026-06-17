from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from backend.workspaces import (
    WORKSPACES,
    DEFAULT_WORKSPACE,
    EDITABLE_FIELDS,
    load_overrides,
    save_overrides,
    workspace_public,
)

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


class WorkspaceTexts(BaseModel):
    label: Optional[str] = None
    subtitle: Optional[str] = None
    chat_title: Optional[str] = None
    chat_intro: Optional[str] = None
    assistant_name: Optional[str] = None
    placeholder: Optional[str] = None
    suggestions: Optional[List[str]] = None


@router.get("")
def get_workspaces():
    overrides = load_overrides()
    return {
        "default": DEFAULT_WORKSPACE,
        "workspaces": [workspace_public(ws, overrides) for ws in WORKSPACES.values()],
    }


@router.put("/{workspace_id}")
def update_workspace(workspace_id: str, body: WorkspaceTexts):
    """Editierbare Texte eines Bereichs überschreiben (persistent)."""
    if workspace_id not in WORKSPACES:
        raise HTTPException(status_code=404, detail="Unbekannter Bereich")

    overrides = load_overrides()
    ws_ov = overrides.get(workspace_id, {})

    data = {k: v for k, v in body.model_dump().items() if v is not None and k in EDITABLE_FIELDS}
    if "suggestions" in data:
        data["suggestions"] = [s.strip() for s in data["suggestions"] if s and s.strip()]

    ws_ov.update(data)
    overrides[workspace_id] = ws_ov
    save_overrides(overrides)
    return workspace_public(WORKSPACES[workspace_id], overrides)


@router.delete("/{workspace_id}")
def reset_workspace(workspace_id: str):
    """Alle Text-Overrides eines Bereichs entfernen → zurück auf Defaults."""
    if workspace_id not in WORKSPACES:
        raise HTTPException(status_code=404, detail="Unbekannter Bereich")

    overrides = load_overrides()
    overrides.pop(workspace_id, None)
    save_overrides(overrides)
    return workspace_public(WORKSPACES[workspace_id], overrides)
