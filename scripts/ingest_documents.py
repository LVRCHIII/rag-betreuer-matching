"""Generische Ingestion: indexiert alle Dateien aus einem Ordner (oder eine
Einzeldatei) in eine Collection – für Modulhandbücher, Abschlussarbeiten etc.

Nutzt dieselbe Pipeline wie der Upload-Endpoint (parse → chunk → embed → ChromaDB),
ein Chunk pro RecursiveCharacterTextSplitter-Stück. Pro Datei wird `source_file`
gesetzt, sodass sich einzelne Dateien später gezielt löschen lassen.

Aufruf (aus der Projektwurzel, mit aktivem venv, PYTHONPATH=Projektwurzel):
    python scripts/ingest_documents.py <ordner_oder_datei> <collection> [workspace] [datentyp]

Beispiel:
    python scripts/ingest_documents.py data/datenbasis/modulhandbuecher modulhandbuecher g02 real
"""
import glob
import os
import sys

from backend.ingestion.parser import parse_file, PARSERS
from backend.ingestion.chunker import chunk_text
from backend.ingestion.embedder import embed_texts
from backend.retrieval.vectorstore import add_chunks, get_or_create_collection
from backend.workspaces import to_internal


def iter_files(src: str):
    if os.path.isfile(src):
        return [src]
    files = []
    for ext in PARSERS:
        files.extend(glob.glob(os.path.join(src, f"*{ext}")))
    return sorted(files)


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src = os.path.expanduser(sys.argv[1])
    display_collection = sys.argv[2]
    workspace = sys.argv[3] if len(sys.argv) > 3 else "g02"
    datentyp = sys.argv[4] if len(sys.argv) > 4 else "real"
    internal = to_internal(workspace, display_collection)

    files = iter_files(src)
    if not files:
        print(f"Keine unterstützten Dateien in {src}")
        sys.exit(1)
    print(f"{len(files)} Datei(en) → Collection '{internal}'")

    total = 0
    for fi, path in enumerate(files, 1):
        fname = os.path.basename(path)
        with open(path, "rb") as f:
            content = f.read()
        try:
            text = parse_file(fname, content)
        except Exception as e:
            print(f"  [{fi}/{len(files)}] {fname}: PARSE-FEHLER {e}")
            continue
        chunks = chunk_text(text, chunk_size=500, chunk_overlap=50, metadata={
            "collection": display_collection,
            "source_file": fname,
            "datentyp": datentyp,
            "fachbereich": "",
        })
        if not chunks:
            print(f"  [{fi}/{len(files)}] {fname}: 0 Chunks (kein Text extrahiert?)")
            continue
        texts = [c["text"] for c in chunks]
        embeddings = []
        for i in range(0, len(texts), 64):
            embeddings.extend(embed_texts(texts[i:i + 64]))
        add_chunks(internal, chunks, embeddings, fname)
        total += len(chunks)
        print(f"  [{fi}/{len(files)}] {fname}: {len(chunks)} Chunks")

    print(f"Fertig: {total} Chunks neu indexiert. Collection '{internal}' hat jetzt "
          f"{get_or_create_collection(internal).count()} Chunks.")


if __name__ == "__main__":
    main()
