from typing import List
from functools import lru_cache
from sentence_transformers import SentenceTransformer
from backend.config import settings


@lru_cache(maxsize=1)
def get_model(model_name: str) -> SentenceTransformer:
    return SentenceTransformer(model_name)


def embed_texts(texts: List[str], model_name: str = None) -> List[List[float]]:
    name = model_name or settings.embedding_model
    model = get_model(name)
    embeddings = model.encode(texts, show_progress_bar=False, normalize_embeddings=True)
    return embeddings.tolist()
