from pydantic_settings import BaseSettings
from typing import List


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
        env_file = ".env"
        case_sensitive = False


settings = Settings()
