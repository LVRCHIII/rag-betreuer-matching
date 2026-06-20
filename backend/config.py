import os
from pydantic_settings import BaseSettings
from typing import List

# Projektwurzel (Verzeichnis über backend/), damit alle relativen Pfade
# unabhängig vom aktuellen Arbeitsverzeichnis funktionieren
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Beschreibbarer Daten-/Konfig-Ordner. In der gebündelten App (PyInstaller) wird
# RAG_DATA_DIR vom Launcher auf einen User-Ordner gesetzt (z.B. %LOCALAPPDATA%),
# weil der Installationsordner (Program Files / .app) schreibgeschützt ist.
# Im Repo-/Dev-Betrieb bleibt es die Projektwurzel.
DATA_ROOT = os.environ.get("RAG_DATA_DIR") or PROJECT_ROOT


def _abs(path: str) -> str:
    return path if os.path.isabs(path) else os.path.join(DATA_ROOT, path)


def data_path(*parts: str) -> str:
    """Pfad innerhalb des beschreibbaren Daten-Ordners."""
    return os.path.join(DATA_ROOT, *parts)


class Settings(BaseSettings):
    # LLM
    llm_backend: str = "ollama"
    llm_model: str = "llama3"
    ollama_base_url: str = "http://localhost:11434"
    openai_api_key: str = ""

    # Embedding
    embedding_model: str = "intfloat/multilingual-e5-small"

    # Vektordatenbank
    vector_db_backend: str = "chroma"
    chroma_persist_dir: str = "./data/chroma"

    # Retrieval: 'hybrid' (BM25 + dense via RRF, empfohlen) oder 'dense'
    retrieval_mode: str = "hybrid"

    # Upload
    upload_dir: str = "./data/uploads"
    max_upload_size_mb: int = 100

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = os.path.join(DATA_ROOT, ".env")
        case_sensitive = False


settings = Settings()
settings.chroma_persist_dir = _abs(settings.chroma_persist_dir)
settings.upload_dir = _abs(settings.upload_dir)
