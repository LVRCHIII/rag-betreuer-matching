import html
import io
import re
from pathlib import Path
from typing import List, Dict, Any

_HTML_TAG_RE = re.compile(r"<[^>]+>")


def strip_html(text: str) -> str:
    """Entfernt HTML-Markup aus Zellwerten (z.B. HISinONE-Exporte)."""
    text = _HTML_TAG_RE.sub(" ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def parse_pdf(content: bytes) -> str:
    import pdfplumber
    text_parts = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
    return "\n\n".join(text_parts)


def parse_xlsx(content: bytes) -> str:
    import pandas as pd
    dfs = pd.read_excel(io.BytesIO(content), sheet_name=None)
    parts = []
    for sheet_name, df in dfs.items():
        df = df.fillna("").astype(str)
        df = df.map(strip_html)
        for _, row in df.iterrows():
            row_text = " | ".join(
                f"{col}: {val}" for col, val in row.items() if val
            )
            if row_text.strip():
                parts.append(row_text)
    return "\n\n".join(parts)


def parse_docx(content: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(content))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def parse_txt(content: bytes) -> str:
    return content.decode("utf-8", errors="replace")


def parse_csv(content: bytes) -> str:
    import pandas as pd
    df = pd.read_csv(io.BytesIO(content))
    return df.to_string(index=False)


PARSERS = {
    ".pdf": parse_pdf,
    ".xlsx": parse_xlsx,
    ".xls": parse_xlsx,
    ".docx": parse_docx,
    ".txt": parse_txt,
    ".csv": parse_csv,
}


def parse_file(filename: str, content: bytes) -> str:
    ext = Path(filename).suffix.lower()
    parser = PARSERS.get(ext)
    if not parser:
        raise ValueError(f"Nicht unterstütztes Dateiformat: {ext}")
    return parser(content)
