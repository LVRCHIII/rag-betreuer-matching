from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter


def chunk_text(
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
    metadata: Dict[str, Any] = None,
) -> List[Dict[str, Any]]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
    )
    chunks = splitter.split_text(text)
    result = []
    for i, chunk in enumerate(chunks):
        meta = dict(metadata or {})
        meta["chunk_index"] = i
        result.append({"text": chunk, "metadata": meta})
    return result
