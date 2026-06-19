"""Metriken der drei Test-Ebenen.

Ebene A/C kommen ohne LLM-Judge aus (schnell). Ebene B nutzt RAGAS mit
lokalem Ollama-Modell als Bewerter ("LLM as a Judge").
"""
import re
from typing import List, Dict, Any, Optional

# ---------------------------------------------------------------------------
# Ebene A – Retrieval-/Matching-Genauigkeit
# ---------------------------------------------------------------------------
def _norm(name: str) -> str:
    return re.sub(r"\b(prof\.?|dr\.?|in|rer\.?|nat\.?|habil\.?)\b", "",
                  (name or "").lower()).strip()


def same_person(a: str, b: str) -> bool:
    a, b = _norm(a), _norm(b)
    if not a or not b:
        return False
    if a == b:
        return True
    # Nachnamen-Vergleich als Fallback (Titel/Vornamen-Varianten)
    return a.split()[-1] == b.split()[-1] and len(a.split()[-1]) >= 3


def matching_metrics(expected: str, sources: List[Dict[str, Any]], ks=(1, 3, 5)) -> Dict[str, Any]:
    names = [s.get("lehrende", "") for s in sources]
    rank = None
    for i, n in enumerate(names, 1):
        if same_person(n, expected):
            rank = i
            break
    res = {f"hit@{k}": bool(rank and rank <= k) for k in ks}
    res["reciprocal_rank"] = round(1.0 / rank, 4) if rank else 0.0
    res["rank"] = rank
    return res


# ---------------------------------------------------------------------------
# Ebene C – Robustheit & Compliance
# ---------------------------------------------------------------------------
_FALLBACK = [
    "leider niemanden", "niemanden empfehlen", "keine auskunft", "keine passende",
    "keine informationen", "nicht beantworten", "kann ich dir dazu", "keine empfehlung",
    "nicht weiterhelfen", "keine geeigneten", "auf basis der aktuellen datenbasis",
]
_GERMAN_HINTS = [" der ", " die ", " und ", " ich ", " für ", " eine ", " nicht ", " du ", " mit "]


def looks_german(text: str) -> bool:
    low = f" {text.lower()} "
    return sum(low.count(w) for w in _GERMAN_HINTS) >= 2 or len(text.strip()) < 40


def has_citation(text: str) -> bool:
    return bool(re.search(r"\[\d+\]", text or ""))


def declines(text: str) -> bool:
    low = (text or "").lower()
    return any(m in low for m in _FALLBACK)


def names_a_professor(text: str, sources: List[Dict[str, Any]]) -> bool:
    low = (text or "").lower()
    for s in sources:
        n = _norm(s.get("lehrende", ""))
        if n and n.split()[-1] in low:
            return True
    return False


def robustness_metrics(text: str, sources: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Für unpassende Anfragen ist 'gut' = das System lehnt ehrlich ab bzw.
    empfiehlt niemanden, statt zu halluzinieren."""
    declined = declines(text)
    recommended = names_a_professor(text, sources)
    return {
        "declined": declined,
        "recommended_someone": recommended,
        "fallback_ok": declined or not recommended,
        "german": looks_german(text),
    }


# ---------------------------------------------------------------------------
# Ebene B – RAGAS (Faithfulness, Answer Relevancy, Context Recall)
# ---------------------------------------------------------------------------
class _LocalEmbeddings:
    """LangChain-Embeddings-Interface auf Basis des lokalen sentence-transformers-Modells."""

    def embed_documents(self, texts):
        from backend.ingestion.embedder import embed_texts
        return embed_texts(texts)

    def embed_query(self, text):
        from backend.ingestion.embedder import embed_texts
        return embed_texts([text])[0]


def _build_metrics(llm, embeddings, with_faithfulness: bool, with_recall: bool):
    from ragas.metrics import AnswerRelevancy, Faithfulness
    metrics = [AnswerRelevancy(llm=llm, embeddings=embeddings)]
    if with_faithfulness:
        metrics.append(Faithfulness(llm=llm))
    if with_recall:
        try:
            from ragas.metrics import LLMContextRecall
            metrics.append(LLMContextRecall(llm=llm))
        except Exception:
            pass
    return metrics


def _score(value) -> Optional[float]:
    import math
    try:
        f = float(value)
        return None if math.isnan(f) else round(f, 4)
    except (TypeError, ValueError):
        return None


def ragas_evaluate(question: str, answer: str, contexts: List[str],
                   reference: Optional[str], llm_model: str,
                   ollama_base_url: str = None) -> Dict[str, Optional[float]]:
    """Bewertet ein einzelnes Frage-Antwort-Paar mit RAGAS (blockierend).

    Als Bewerter-LLM dient ein lokales Ollama-Modell; für die Ähnlichkeits-
    metriken werden dieselben lokalen e5-Embeddings wie im System genutzt.
    """
    from langchain_community.chat_models import ChatOllama
    from ragas import evaluate
    from ragas.dataset_schema import SingleTurnSample, EvaluationDataset
    from ragas.llms import LangchainLLMWrapper
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from backend.config import settings

    base = ollama_base_url or settings.ollama_base_url
    llm = LangchainLLMWrapper(ChatOllama(model=llm_model, temperature=0, base_url=base))
    embeddings = LangchainEmbeddingsWrapper(_LocalEmbeddings())

    has_contexts = bool(contexts)
    has_reference = bool(reference)
    metrics = _build_metrics(llm, embeddings, has_contexts, has_contexts and has_reference)

    sample = SingleTurnSample(
        user_input=question,
        response=answer,
        retrieved_contexts=contexts if has_contexts else [""],
        reference=reference,
    )
    result = evaluate(dataset=EvaluationDataset(samples=[sample]),
                      metrics=metrics, show_progress=False)
    row = result.to_pandas().iloc[0]
    out = {
        "answer_relevancy": _score(row.get("answer_relevancy")),
        "faithfulness": _score(row.get("faithfulness")) if has_contexts else None,
        "context_recall": _score(row.get("context_recall")),
    }
    vals = [v for v in out.values() if v is not None]
    out["overall"] = round(sum(vals) / len(vals), 4) if vals else None
    return out
