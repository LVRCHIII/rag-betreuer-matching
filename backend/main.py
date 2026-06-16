import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from backend.config import settings
from backend.api.routes_chat import router as chat_router
from backend.api.routes_collections import router as collections_router
from backend.api.routes_upload import router as upload_router
from backend.api.routes_settings import router as settings_router
from backend.api.routes_models import router as models_router
from backend.api.routes_workspaces import router as workspaces_router
from backend.workspaces import DEFAULT_WORKSPACE, all_prefixes

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
app.include_router(workspaces_router)


@app.on_event("startup")
def _migrate_unprefixed_collections():
    """Bestehende (prefixlose) Collections gehören zu Gruppe 02 → auf g02_ umbenennen.

    Läuft bei jedem Start, ist aber idempotent: bereits zu einem Bereich gehörende
    Collections (g02_, g03_, ...) werden übersprungen.
    """
    from backend.retrieval.vectorstore import get_client

    known = all_prefixes()
    try:
        client = get_client()
        for col in client.list_collections():
            if not col.name.startswith(known):
                try:
                    client.get_collection(col.name).modify(name=f"{DEFAULT_WORKSPACE}_{col.name}")
                except Exception:
                    pass
    except Exception:
        pass


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# Produktionsmodus: gebautes Frontend (frontend/dist) direkt mit ausliefern,
# damit die App als ein einziger Prozess läuft (Windows-Installation).
_frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
if os.path.isdir(_frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(_frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        file_path = os.path.join(_frontend_dist, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(_frontend_dist, "index.html"))
