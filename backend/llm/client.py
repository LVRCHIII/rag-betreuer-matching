import httpx
import json
from typing import AsyncIterator, List, Dict, Any
from backend.config import settings


async def stream_ollama(
    messages: List[Dict[str, str]],
    model: str = None,
) -> AsyncIterator[str]:
    model = model or settings.llm_model
    url = f"{settings.ollama_base_url}/api/chat"
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        # Niedrige Temperature: das Modell soll sich strikt an den Kontext halten
        # und nicht aus seinem Trainingswissen Personen erfinden (RAG-Faktentreue).
        "options": {"temperature": 0.15},
    }
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", url, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    content = data.get("message", {}).get("content", "")
                    if content:
                        yield content
                    if data.get("done"):
                        break
                except json.JSONDecodeError:
                    continue


async def stream_openai(
    messages: List[Dict[str, str]],
    model: str = None,
) -> AsyncIterator[str]:
    from openai import AsyncOpenAI
    model = model or settings.llm_model
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    stream = await client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


async def stream_llm(
    messages: List[Dict[str, str]],
    model: str = None,
    backend: str = None,
) -> AsyncIterator[str]:
    b = backend or settings.llm_backend
    if b == "openai":
        async for token in stream_openai(messages, model):
            yield token
    else:
        async for token in stream_ollama(messages, model):
            yield token


async def list_ollama_models() -> List[str]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(f"{settings.ollama_base_url}/api/tags")
            res.raise_for_status()
            data = res.json()
            return [m["name"] for m in data.get("models", [])]
    except Exception:
        return []
