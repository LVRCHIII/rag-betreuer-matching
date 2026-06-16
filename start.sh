#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Venv aktivieren
if [ ! -d ".venv" ]; then
  echo "Erstelle virtualenv (Python 3.11)..."
  python3.11 -m venv .venv
  .venv/bin/pip install -r requirements.txt
fi

source .venv/bin/activate

# .env sicherstellen
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo ".env aus .env.example erstellt – bitte anpassen!"
fi

# data-Verzeichnisse
mkdir -p data/uploads data/chroma

echo ""
echo "=== BHT Betreuer-Matching Backend ==="
echo "URL: http://localhost:8000"
echo "Docs: http://localhost:8000/docs"
echo ""

uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
