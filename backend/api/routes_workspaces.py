from fastapi import APIRouter

from backend.workspaces import WORKSPACES, DEFAULT_WORKSPACE

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


@router.get("")
def get_workspaces():
    return {
        "default": DEFAULT_WORKSPACE,
        "workspaces": [
            {
                "id": ws.id,
                "label": ws.label,
                "subtitle": ws.subtitle,
                "accent": ws.accent,
                "chat_title": ws.chat_title,
                "chat_intro": ws.chat_intro,
                "assistant_name": ws.assistant_name,
                "placeholder": ws.placeholder,
                "suggestions": ws.suggestions,
            }
            for ws in WORKSPACES.values()
        ],
    }
