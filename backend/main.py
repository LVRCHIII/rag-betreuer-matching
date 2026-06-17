import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from backend.config import settings
from backend.api.routes_chat import router as chat_router
from backend.api.routes_collections import router as collections_router
from backend.api.routes_upload import router as upload_router
from backend.api.routes_settings import router as settings_router
from backend.api.routes_models import router as models_router
from backend.api.routes_eval import router as eval_router
from backend.api.routes_scraper import router as scraper_router
from backend.api.routes_workspaces import router as workspaces_router

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
app.include_router(workspaces_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# ---- Frontend ausliefern (Single-Origin) ----
# Wenn das gebaute Frontend vorliegt, serviert dasselbe Backend auch die UI.
# Dadurch läuft alles als EIN Prozess auf EINEM Port – kein Proxy, kein CORS,
# keine VITE_API_URL nötig (das Frontend nutzt dann relative /api-URLs).
def _resolve_frontend_dir() -> str | None:
    # In gebündelter Form (PyInstaller) liegt dist neben der Executable;
    # im Repo unter frontend/dist.
    candidates = [
        os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"),
        os.path.join(os.path.dirname(__file__), "frontend_dist"),  # PyInstaller-Bundle
        os.path.join(os.getcwd(), "frontend", "dist"),
    ]
    bundle_dir = os.environ.get("RAG_FRONTEND_DIR")
    if bundle_dir:
        candidates.insert(0, bundle_dir)
    for c in candidates:
        index = os.path.join(c, "index.html")
        if os.path.isfile(index):
            return os.path.abspath(c)
    return None


_FRONTEND_DIR = _resolve_frontend_dir()

if _FRONTEND_DIR:
    _assets_dir = os.path.join(_FRONTEND_DIR, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        # API-Pfade nie vom SPA-Fallback abfangen
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        # Echte Dateien (favicon, manifest, …) direkt ausliefern
        candidate = os.path.join(_FRONTEND_DIR, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        # Alles andere → index.html (Client-Side-Routing)
        return FileResponse(os.path.join(_FRONTEND_DIR, "index.html"))
