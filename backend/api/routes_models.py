from fastapi import APIRouter
from backend.llm.client import list_ollama_models

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
async def get_models():
    models = await list_ollama_models()
    return {"models": models}
