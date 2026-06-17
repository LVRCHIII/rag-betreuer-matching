"""Launcher für die gebündelte Desktop-App (Windows .exe / macOS .app).

Dieser Entrypoint wird von PyInstaller eingefroren. Er:
  1. legt einen beschreibbaren Daten-/Konfig-Ordner im Benutzerprofil an,
  2. stellt .env + data-Verzeichnisse sicher,
  3. zeigt einen freundlichen Hinweis, falls Ollama nicht läuft,
  4. startet das FastAPI-Backend (das auch das Frontend ausliefert) und
  5. öffnet den Standardbrowser auf der App.

Im Repo-Betrieb funktioniert er ebenso (`python launcher.py`).
"""
import os
import sys
import socket
import threading
import time
import webbrowser


APP_NAME = "BetreuerMatching"
DEFAULT_PORT = 8000


def resource_path(rel: str) -> str:
    """Pfad zu gebündelten Ressourcen (PyInstaller _MEIPASS) bzw. Repo."""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, rel)


def user_data_dir() -> str:
    """Beschreibbarer Ordner für Daten + Konfiguration, plattformabhängig."""
    if sys.platform.startswith("win"):
        base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
        return os.path.join(base, APP_NAME)
    if sys.platform == "darwin":
        return os.path.join(os.path.expanduser("~"), "Library", "Application Support", APP_NAME)
    return os.path.join(os.path.expanduser("~"), ".betreuer-matching")


DEFAULT_ENV = """\
LLM_BACKEND=ollama
LLM_MODEL=llama3
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=intfloat/multilingual-e5-small
VECTOR_DB_BACKEND=chroma
CHROMA_PERSIST_DIR=./data/chroma
UPLOAD_DIR=./data/uploads
MAX_UPLOAD_SIZE_MB=100
HOST=127.0.0.1
PORT=8000
CORS_ORIGINS=http://localhost:8000
"""
# Hinweis: EMBEDDING_MODEL wird bei der gebündelten App über eine Umgebungsvariable
# auf das mitgelieferte Modell gesetzt (siehe main()), daher hier nicht in .env.


def prepare_data_dir() -> str:
    data_dir = user_data_dir()
    os.makedirs(os.path.join(data_dir, "data", "uploads"), exist_ok=True)
    os.makedirs(os.path.join(data_dir, "data", "chroma"), exist_ok=True)
    env_file = os.path.join(data_dir, ".env")
    if not os.path.exists(env_file):
        with open(env_file, "w", encoding="utf-8") as f:
            f.write(DEFAULT_ENV)
    # HF-Cache (Embedding-Modell) ebenfalls im App-Ordner halten – bleibt erhalten
    os.environ.setdefault("HF_HOME", os.path.join(data_dir, "models"))
    return data_dir


def port_in_use(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def find_free_port(host: str, start: int) -> int:
    port = start
    while port_in_use(host, port) and port < start + 30:
        port += 1
    return port


def ollama_running(base_url: str = "http://localhost:11434") -> bool:
    try:
        import httpx

        httpx.get(f"{base_url}/api/tags", timeout=2.0)
        return True
    except Exception:
        return False


def open_browser_when_ready(url: str) -> None:
    import httpx

    for _ in range(90):
        try:
            r = httpx.get(f"{url}/api/health", timeout=1.0)
            if r.status_code == 200:
                webbrowser.open(url)
                return
        except Exception:
            time.sleep(1.0)


def main() -> None:
    print("=" * 50)
    print("  BHT Betreuer-Matching wird gestartet ...")
    print("=" * 50)

    data_dir = prepare_data_dir()
    os.environ["RAG_DATA_DIR"] = data_dir

    if getattr(sys, "frozen", False):
        # Gebündeltes Frontend an das Backend übergeben
        os.environ["RAG_FRONTEND_DIR"] = resource_path("frontend_dist")
        # Gebündeltes Embedding-Modell nutzen → erster Upload funktioniert offline
        model_dir = resource_path(os.path.join("model", "multilingual-e5-small"))
        if os.path.isdir(model_dir):
            os.environ["EMBEDDING_MODEL"] = model_dir
            os.environ["HF_HUB_OFFLINE"] = "1"
            os.environ["TRANSFORMERS_OFFLINE"] = "1"

    host = "127.0.0.1"
    port = find_free_port(host, int(os.environ.get("PORT", DEFAULT_PORT)))
    os.environ["PORT"] = str(port)
    url = f"http://localhost:{port}"

    if not ollama_running():
        print()
        print("  [!] Ollama scheint nicht zu laufen.")
        print("      Die KI-Antworten brauchen Ollama. Bitte installieren von")
        print("      https://ollama.com und einmalig ein Modell laden:")
        print("          ollama pull llama3")
        print()

    print(f"  App-Adresse:   {url}")
    print(f"  Datenordner:   {data_dir}")
    print("  (Dieses Fenster offen lassen. Zum Beenden schließen.)")
    print("=" * 50)

    threading.Thread(target=open_browser_when_ready, args=(url,), daemon=True).start()

    import uvicorn
    from backend.main import app

    uvicorn.run(app, host=host, port=port, log_level="warning")


if __name__ == "__main__":
    main()
