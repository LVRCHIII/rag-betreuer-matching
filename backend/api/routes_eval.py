import asyncio
import json
import math
from typing import List, Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.config import settings
from backend.ingestion.embedder import embed_texts

router = APIRouter(prefix="/api/eval", tags=["eval"])


class EvalEntry(BaseModel):
    id: str
    question: str
    answer: str
    contexts: List[str] = []
    ground_truth: Optional[str] = None


class EvalRequest(BaseModel):
    entries: List[EvalEntry]
    llm_model: Optional[str] = None


class _LocalEmbeddings:
    """Langchain-Embeddings-Interface auf Basis des lokalen sentence-transformers-Modells."""

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return embed_texts(texts)

    def embed_query(self, text: str) -> List[float]:
        return embed_texts([text])[0]

    async def aembed_documents(self, texts: List[str]) -> List[List[float]]:
        return await asyncio.to_thread(self.embed_documents, texts)

    async def aembed_query(self, text: str) -> List[float]:
        return await asyncio.to_thread(self.embed_query, text)


def _build_metrics(llm_model: str, with_faithfulness: bool):
    from langchain_community.chat_models import ChatOllama
    from ragas.llms import LangchainLLMWrapper
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from ragas.metrics import AnswerRelevancy, Faithfulness

    llm = LangchainLLMWrapper(
        ChatOllama(model=llm_model, temperature=0, base_url=settings.ollama_base_url)
    )
    embeddings = LangchainEmbeddingsWrapper(_LocalEmbeddings())

    metrics = [AnswerRelevancy(llm=llm, embeddings=embeddings)]
    if with_faithfulness:
        metrics.append(Faithfulness(llm=llm))
    return metrics


def _score(value) -> Optional[float]:
    try:
        f = float(value)
        return None if math.isnan(f) else round(f, 4)
    except (TypeError, ValueError):
        return None


def _evaluate_entry(entry: EvalEntry, llm_model: str) -> dict:
    """Bewertet ein einzelnes Frage-Antwort-Paar mit RAGAS (blockierend)."""
    from ragas import evaluate
    from ragas.dataset_schema import SingleTurnSample, EvaluationDataset

    has_contexts = bool(entry.contexts)
    metrics = _build_metrics(llm_model, with_faithfulness=has_contexts)

    sample = SingleTurnSample(
        user_input=entry.question,
        response=entry.answer,
        retrieved_contexts=entry.contexts if has_contexts else [""],
        reference=entry.ground_truth,
    )
    result = evaluate(dataset=EvaluationDataset(samples=[sample]), metrics=metrics, show_progress=False)
    row = result.to_pandas().iloc[0]

    relevancy = _score(row.get("answer_relevancy"))
    faithfulness = _score(row.get("faithfulness")) if has_contexts else None
    scores = [s for s in (relevancy, faithfulness) if s is not None]

    return {
        "id": entry.id,
        "question": entry.question,
        "answer_relevancy": relevancy,
        "faithfulness": faithfulness,
        "overall_score": round(sum(scores) / len(scores), 4) if scores else None,
    }


async def eval_generator(req: EvalRequest):
    def sse(event: str, data: dict):
        return f"data: {json.dumps({'event': event, **data})}\n\n"

    llm_model = req.llm_model or settings.llm_model
    total = len(req.entries)
    yield sse("status", {"message": f"Starte RAGAS-Evaluation ({total} Paare, Judge: {llm_model})...", "total": total})

    results = []
    for i, entry in enumerate(req.entries):
        yield sse("progress", {"current": i + 1, "total": total, "id": entry.id})
        try:
            result = await asyncio.to_thread(_evaluate_entry, entry, llm_model)
        except Exception as e:
            result = {
                "id": entry.id,
                "question": entry.question,
                "answer_relevancy": None,
                "faithfulness": None,
                "overall_score": None,
                "error": str(e),
            }
        results.append(result)
        yield sse("result", {"result": result})

    overall = [r["overall_score"] for r in results if r["overall_score"] is not None]
    yield sse("done", {
        "results": results,
        "average_score": round(sum(overall) / len(overall), 4) if overall else None,
    })


@router.post("")
async def run_eval(req: EvalRequest):
    return StreamingResponse(
        eval_generator(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
