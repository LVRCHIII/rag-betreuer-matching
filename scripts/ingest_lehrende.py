"""Saubere Ingestion der BHT-Lehrenden-Datenbasis (XLSX) in eine Collection.

Baut pro Lehrendem GENAU EINEN kompakten Chunk aus den Kernfeldern
(Name, Professur, Fachbereich, Forschungsgebiete, Module, Studiengänge,
kurz reale betreute Themen). Die langen synthetischen Themen-Listen werden
bewusst weggelassen – sie überdecken sonst die echten Profile und führen
zu schlechten Treffern.

Wichtig: e5-Embeddings haben ein 512-Token-Limit. Darum kompakte Chunks
(< ~1500 Zeichen), damit die Forschungsgebiete nicht abgeschnitten werden.

Aufruf (aus der Projektwurzel, mit aktivem venv):
    python scripts/ingest_lehrende.py "/Pfad/zur/Datenbasis.xlsx" [collection] [workspace]

Beispiel:
    python scripts/ingest_lehrende.py "~/Downloads/V001_Datenbasis.xlsx" lehrende g02
"""
import os
import re
import sys

import pandas as pd

from backend.ingestion.embedder import embed_texts
from backend.retrieval.vectorstore import add_chunks
from backend.workspaces import to_internal


def clean(v) -> str:
    if v is None:
        return ""
    s = re.sub(r"<[^>]+>", " ", str(v))
    s = re.sub(r"\s+", " ", s).strip()
    return "" if s.lower() in ("nan", "n/a", "") else s


def trim(s: str, n: int) -> str:
    return s[:n].rsplit(" ", 1)[0] + "…" if len(s) > n else s


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = os.path.expanduser(sys.argv[1])
    display_collection = sys.argv[2] if len(sys.argv) > 2 else "lehrende"
    workspace = sys.argv[3] if len(sys.argv) > 3 else "g02"
    internal = to_internal(workspace, display_collection)

    dfs = pd.read_excel(src, sheet_name=None)
    chunks = []
    idx = 0
    for sheet, df in dfs.items():
        if sheet.lower().startswith("grund"):  # reines Schema-Sheet überspringen
            continue
        df.columns = [str(c).strip() for c in df.columns]

        def col(row, name):
            for c in df.columns:
                if c.lower().startswith(name.lower()):
                    return clean(row.get(c, ""))
            return ""

        for _, row in df.iterrows():
            name = col(row, "Name")
            if not name or len(name) < 3:
                continue
            fb = col(row, "Fachbereich")
            prof = col(row, "Professur")
            fg = trim(col(row, "Forschungsgebiete"), 400)
            mod = trim(col(row, "Module"), 300)
            stg = trim(col(row, "Studiengänge"), 200)
            themen = trim(col(row, "Vergangene betreute"), 300)
            parts = [f"Betreuer/in: {name}"]
            if prof:
                parts.append(f"Professur: {prof}")
            if fb:
                parts.append(f"Fachbereich: {fb}")
            if fg:
                parts.append(f"Forschungsgebiete: {fg}")
            if mod:
                parts.append(f"Module: {mod}")
            if stg:
                parts.append(f"Studiengänge: {stg}")
            if themen:
                parts.append(f"Bisher betreute Themen (Beispiele): {themen}")
            chunks.append({
                "text": ". ".join(parts),
                "metadata": {
                    "chunk_index": idx,
                    "source_file": "BHT_Lehrendenprofile.xlsx",
                    "datentyp": "real",
                    "fachbereich": fb,
                    "lehrende": name,
                },
            })
            idx += 1

    print(f"{len(chunks)} Lehrenden-Chunks gebaut.")
    texts = [c["text"] for c in chunks]
    batch = 64
    embeddings = []
    for i in range(0, len(texts), batch):
        embeddings.extend(embed_texts(texts[i:i + batch]))  # is_query=False -> "passage: "
    add_chunks(internal, chunks, embeddings, "BHT_Lehrendenprofile.xlsx")
    print(f"Indexiert in Collection '{internal}': {len(chunks)} Chunks")


if __name__ == "__main__":
    main()
