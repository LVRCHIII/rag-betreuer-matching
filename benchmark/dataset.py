"""Erzeugt die Testfragen für das Benchmark – vollständig automatisch aus der
indexierten Wissensbasis (kein manuelles Labeln).

Idee (Known-Item-Retrieval): Jedes Lehrenden-Profil nennt Forschungsgebiete.
Zu einem Forschungsgebiet von Prof. X wird eine Frage gebaut – die korrekte
Antwort ist per Konstruktion Prof. X. So entsteht eine objektive Ground Truth.
"""
import random
import re
from dataclasses import dataclass
from typing import List, Optional

from backend.retrieval.vectorstore import get_collection_chunks
from backend.workspaces import to_internal

# Reihenfolge der Felder, wie sie scripts/ingest_lehrende.py in den Chunk-Text schreibt
LABELS = ["Betreuer/in", "Professur", "Fachbereich", "Forschungsgebiete",
          "Module", "Studiengänge", "Bisher betreute Themen"]


@dataclass
class TestQuestion:
    id: str
    layer: str                 # "A" | "B" | "C"
    question: str
    expected: Optional[str]    # erwarteter Name (A/B) oder None (C)
    reference: Optional[str]   # Referenz-/Ground-Truth-Antwort für RAGAS Context Recall
    fachbereich: str = ""
    kind: str = ""             # "matching" | "fallback" | "fachfremd" | "leer"


def _field(text: str, label: str) -> str:
    """Extrahiert den Wert von 'Label: ...' bis zum nächsten bekannten Label."""
    others = "|".join(re.escape(l) for l in LABELS if l != label)
    m = re.search(rf"{re.escape(label)}:\s*(.+?)(?:\.\s*(?:{others}):|$)", text)
    return m.group(1).strip(" .") if m else ""


def load_profiles(collection: str, workspace: str = "g02") -> List[dict]:
    """Lädt alle Lehrenden-Profile aus der Collection (Name + Felder)."""
    internal = to_internal(workspace, collection)
    data = get_collection_chunks(internal, limit=100000, offset=0)
    profs = []
    for c in data["chunks"]:
        meta = c.get("metadata", {}) or {}
        name = (meta.get("lehrende") or "").strip()
        if not name:
            continue
        text = c.get("text", "")
        profs_entry = {
            "name": name,
            "fachbereich": meta.get("fachbereich", "") or _field(text, "Fachbereich"),
            "professur": _field(text, "Professur"),
            "forschung": _field(text, "Forschungsgebiete"),
            "text": text,
        }
        profs.append(profs_entry)
    return profs


_SPLIT = re.compile(r"\s*[;,/]\s*|\s+und\s+|\s+sowie\s+")


def _topics(p: dict) -> List[str]:
    raw = p["forschung"] or p["professur"]
    items = [t.strip(" .") for t in _SPLIT.split(raw) if len(t.strip()) >= 4]
    skip = ("u.a", "z.b", "etc", "sowie", "insbesondere")
    return [t for t in items if not t.lower().startswith(skip)][:3]


_TEMPLATES = [
    "Ich suche eine:n Betreuer:in für eine Arbeit über {t}.",
    "Wer kann eine Abschlussarbeit zum Thema {t} betreuen?",
    "Ich möchte eine Bachelorarbeit über {t} schreiben – wer kommt als Betreuung infrage?",
    "Welche:r Lehrende:r passt zu einer Masterarbeit im Bereich {t}?",
]


def build_matching_questions(profiles: List[dict], n: int, seed: int = 42) -> List[TestQuestion]:
    rng = random.Random(seed)
    pool = [p for p in profiles if _topics(p)]
    rng.shuffle(pool)
    qs: List[TestQuestion] = []
    for i, p in enumerate(pool):
        if len(qs) >= n:
            break
        topic = rng.choice(_topics(p))
        tmpl = _TEMPLATES[i % len(_TEMPLATES)]
        ref_parts = [f"Als Betreuer:in passt {p['name']}"]
        if p["professur"]:
            ref_parts.append(f" ({p['professur']})")
        if p["fachbereich"]:
            ref_parts.append(f", Fachbereich {p['fachbereich']}")
        if p["forschung"]:
            ref_parts.append(f". Schwerpunkte: {p['forschung']}")
        qs.append(TestQuestion(
            id=f"A{i:04d}", layer="A", question=tmpl.format(t=topic),
            expected=p["name"], reference="".join(ref_parts) + ".",
            fachbereich=p["fachbereich"], kind="matching",
        ))
    return qs


# Bewusst unpassende / fachfremde / leere Anfragen für die Robustheits-Ebene C
_ADVERSARIAL = [
    ("Wie wird das Wetter morgen in Berlin?", "fachfremd"),
    ("Kannst du mir ein Rezept für Schokoladenkuchen geben?", "fachfremd"),
    ("Erzähl mir bitte einen Witz.", "fachfremd"),
    ("Welche Aktien sollte ich diese Woche kaufen?", "fachfremd"),
    ("Wer betreut eine Arbeit über die Besiedlung des Neptun durch Einhörner?", "fachfremd"),
    ("Was ist die Hauptstadt von Australien?", "fachfremd"),
    ("Übersetze diesen Satz ins Japanische.", "fachfremd"),
    ("Wer hat die Fußball-WM 2014 gewonnen?", "fachfremd"),
    ("Schreibe mir ein Gedicht über den Frühling.", "fachfremd"),
    ("Ich suche ein gutes Restaurant in Berlin-Mitte.", "fachfremd"),
    ("asdfghjkl qwertz 12345", "leer"),
    ("...", "leer"),
    ("Hilfe", "leer"),
    ("Betreuer", "leer"),
    ("Ich brauche Unterstützung bei einem Thema, das es an keiner Hochschule gibt: Zeitreise-Ingenieurwesen.", "fachfremd"),
]


def build_robustness_questions() -> List[TestQuestion]:
    return [
        TestQuestion(id=f"C{i:02d}", layer="C", question=q, expected=None,
                     reference=None, kind=kind)
        for i, (q, kind) in enumerate(_ADVERSARIAL)
    ]


def pick_ragas_sample(matching: List[TestQuestion], n: int, seed: int = 7) -> List[str]:
    """Wählt n IDs aus den Matching-Fragen für die teure RAGAS-Bewertung (Ebene B)."""
    rng = random.Random(seed)
    ids = [q.id for q in matching]
    rng.shuffle(ids)
    return set(ids[:n])
