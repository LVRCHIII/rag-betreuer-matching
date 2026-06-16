from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.api.routes_chat import router as chat_router
from backend.api.routes_collections import router as collections_router
from backend.api.routes_upload import router as upload_router
from backend.api.routes_settings import router as settings_router
from backend.api.routes_models import router as models_router
from backend.api.routes_eval import router as eval_router
from backend.api.routes_scraper import router as scraper_router

app = FastAPI(
    title="RAG Betreuer-Matching API",
    description="BHT Betreuer-Matching System – Gruppe 02",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(collections_router)
app.include_router(upload_router)
app.include_router(settings_router)
app.include_router(models_router)
app.include_router(eval_router)
app.include_router(scraper_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
