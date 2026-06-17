# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller-Spec für die gebündelte Desktop-App.

Friert launcher.py + das komplette Backend + das gebaute Frontend ein.
Plattformabhängig: erzeugt unter macOS zusätzlich ein .app-Bundle.

Aufruf (aus dem Projektstamm, venv aktiviert):
    pyinstaller installer/launcher.spec --noconfirm

Voraussetzungen:
    - frontend/dist muss vorher gebaut sein (npm run build)
    - pip install pyinstaller
"""
import os
import sys
from PyInstaller.utils.hooks import collect_all, collect_submodules

PROJECT_ROOT = os.path.abspath(os.getcwd())

datas = [(os.path.join(PROJECT_ROOT, "frontend", "dist"), "frontend_dist")]
binaries = []
hiddenimports = []

# Embedding-Modell mitbündeln (falls vorher heruntergeladen) → Offline-Upload
_model_dir = os.path.join(PROJECT_ROOT, "installer", "model_cache", "multilingual-e5-small")
if os.path.isdir(_model_dir):
    datas += [(_model_dir, os.path.join("model", "multilingual-e5-small"))]
    print(f"[spec] Embedding-Modell wird gebündelt: {_model_dir}")
else:
    print("[spec] WARNUNG: kein gebündeltes Modell gefunden (erster Upload lädt online nach)")

# Schwergewichtige Pakete vollständig einsammeln (Daten + versteckte Importe)
_collect = [
    "chromadb",
    "sentence_transformers",
    "transformers",
    "tokenizers",
    "torch",
    "huggingface_hub",
    "safetensors",
    "onnxruntime",
    "sklearn",
    "scipy",
    "regex",
    "tqdm",
    "numpy",
    "datasets",  # von sentence_transformers eager importiert (model_card)
    "langchain_text_splitters",  # Chunking
    "langchain_core",  # von langchain_text_splitters benötigt
]
for pkg in _collect:
    try:
        d, b, h = collect_all(pkg)
        datas += d
        binaries += b
        hiddenimports += h
    except Exception as exc:  # Paket evtl. nicht installiert – überspringen
        print(f"[spec] collect_all({pkg}) übersprungen: {exc}")

# Server-Submodule, die dynamisch geladen werden
for pkg in ["uvicorn", "backend"]:
    hiddenimports += collect_submodules(pkg)

# Nicht benötigte schwere Pakete ausschließen (Eval-/Dev-Werkzeuge)
excludes = [
    "ragas",
    "langchain",
    "langchain_community",
    "matplotlib",
    "tkinter",
    "IPython",
    "notebook",
    "pytest",
]

block_cipher = None

a = Analysis(
    [os.path.join(PROJECT_ROOT, "launcher.py")],
    pathex=[PROJECT_ROOT],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

_icon_win = os.path.join(PROJECT_ROOT, "installer", "windows", "app.ico")
_icon_mac = os.path.join(PROJECT_ROOT, "installer", "macos", "app.icns")

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="BetreuerMatching",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,  # Konsolenfenster zeigt Start-Hinweise (z.B. Ollama fehlt)
    disable_windowed_traceback=False,
    icon=_icon_win if os.path.exists(_icon_win) else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="BetreuerMatching",
)

# macOS: zusätzlich ein .app-Bundle erzeugen
if sys.platform == "darwin":
    app = BUNDLE(
        coll,
        name="Betreuer-Matching.app",
        icon=_icon_mac if os.path.exists(_icon_mac) else None,
        bundle_identifier="de.bht.betreuer-matching",
        info_plist={
            "CFBundleName": "Betreuer-Matching",
            "CFBundleDisplayName": "BHT Betreuer-Matching",
            "CFBundleShortVersionString": "1.0.0",
            "NSHighResolutionCapable": True,
            "LSBackgroundOnly": False,
        },
    )
