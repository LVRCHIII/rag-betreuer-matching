#!/bin/bash
# Build-Skript: erzeugt die macOS .dmg (komplett gebündelt).
# Auf dem MacBook im aktivierten venv aus dem Projektstamm ausführen:
#     bash installer/macos/build_dmg.sh
#
# Voraussetzungen (einmalig):
#     pip install -r build-requirements.txt
#     brew install create-dmg
#     (Node.js für den Frontend-Build)
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

APP_NAME="Betreuer-Matching"
DMG_NAME="BetreuerMatching-Installer.dmg"
DIST_APP="dist/${APP_NAME}.app"
OUT_DIR="installer/output"

echo "==> [1/4] Embedding-Modell + Icon vorbereiten"
python installer/download_model.py
[ -f installer/macos/app.icns ] || python installer/make_icon.py

echo "==> [2/4] Frontend bauen"
( cd frontend && npm install && npm run build )

echo "==> [3/4] App einfrieren (PyInstaller -> .app)"
rm -rf "dist/${APP_NAME}.app" "dist/BetreuerMatching"
pyinstaller installer/launcher.spec --noconfirm --distpath "$ROOT/dist" --workpath "$ROOT/build/pyi"

if [ ! -d "$DIST_APP" ]; then
  echo "[FEHLER] $DIST_APP wurde nicht erzeugt."
  exit 1
fi

echo "==> [4/4] .dmg bauen (create-dmg)"
mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR/$DMG_NAME"

if ! command -v create-dmg >/dev/null 2>&1; then
  echo "[FEHLER] create-dmg nicht gefunden. Installieren mit: brew install create-dmg"
  exit 1
fi

create-dmg \
  --volname "BHT Betreuer-Matching" \
  --window-pos 200 120 \
  --window-size 640 400 \
  --icon-size 110 \
  --icon "${APP_NAME}.app" 160 190 \
  --hide-extension "${APP_NAME}.app" \
  --app-drop-link 480 190 \
  --no-internet-enable \
  "$OUT_DIR/$DMG_NAME" \
  "$DIST_APP"

echo ""
echo "FERTIG. DMG liegt unter: $OUT_DIR/$DMG_NAME"
echo "Hinweis: Nutzer brauchen zusätzlich Ollama (https://ollama.com) + 'ollama pull llama3'."
