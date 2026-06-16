"""Scraper für das öffentliche Professuren-Verzeichnis der BHT (bht-berlin.de).

Quellen:
- Verzeichnis: https://www.bht-berlin.de/339 (Professuren, robots.txt erlaubt Crawling)
- Profilseiten: https://www.bht-berlin.de/people/detail/<id>
"""

import asyncio
import re
from dataclasses import dataclass, field
from typing import List, Optional

import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://www.bht-berlin.de"
DIRECTORY_URL = f"{BASE_URL}/339"
USER_AGENT = "RAG-Betreuer-Matching/1.0 (BHT Gruppe 02; Studienprojekt)"
REQUEST_DELAY_S = 0.8
MAX_PAGE_CHARS = 6000


@dataclass
class ProfessorProfile:
    detail_id: str
    name: str
    profile_url: str
    position: str = ""
    fachbereich: str = ""
    ort: str = ""
    sprechzeiten: str = ""
    email: str = ""
    telefon: str = ""
    homepage_url: str = ""
    homepage_text: str = ""
    enrichment: dict = field(default_factory=dict)


def decode_mailto_token(token: str, vector: int = 3) -> str:
    """Dekodiert TYPO3-verschleierte E-Mail-Adressen.

    TYPO3 verschiebt Zeichen um `vector` innerhalb fester ASCII-Bereiche
    (mit Umbruch am Bereichsende); Zeichen außerhalb bleiben unverändert.
    """
    ranges = [(0x2B, 0x3A), (0x40, 0x5A), (0x61, 0x7A)]

    def decode_char(c: str) -> str:
        n = ord(c)
        for start, end in ranges:
            if start <= n <= end:
                n -= vector
                if n < start:
                    n += end - start + 1
                return chr(n)
        return c

    decoded = "".join(decode_char(c) for c in token)
    return decoded.removeprefix("mailto:")


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


async def _get(client: httpx.AsyncClient, url: str) -> str:
    res = await client.get(url, headers={"User-Agent": USER_AGENT}, follow_redirects=True)
    res.raise_for_status()
    return res.text


async def fetch_professor_list(client: httpx.AsyncClient) -> List[ProfessorProfile]:
    """Liest das Professuren-Verzeichnis und liefert Grunddaten pro Person."""
    html = await _get(client, DIRECTORY_URL)
    soup = BeautifulSoup(html, "html.parser")

    profiles: dict[str, ProfessorProfile] = {}
    for link in soup.select('a[href*="/people/detail/"]'):
        match = re.search(r"/people/detail/(\d+)", link.get("href", ""))
        name = _clean(link.get_text())
        if not match or not name:
            continue
        detail_id = match.group(1)
        if detail_id in profiles:
            continue
        profile = ProfessorProfile(
            detail_id=detail_id,
            name=name,
            profile_url=f"{BASE_URL}/people/detail/{detail_id}",
        )
        row = link.find_parent("tr")
        if row:
            for a in row.select("a[href]"):
                href = a.get("href", "").strip()
                if href.startswith("http") and "/people/detail/" not in href and "bht-berlin.de/people" not in href:
                    profile.homepage_url = href
                    break
        profiles[detail_id] = profile

    return list(profiles.values())


async def fetch_profile_details(client: httpx.AsyncClient, profile: ProfessorProfile) -> ProfessorProfile:
    """Lädt die Profilseite und füllt Position, Fachbereich und Kontaktdaten."""
    html = await _get(client, profile.profile_url)
    soup = BeautifulSoup(html, "html.parser")
    container = soup.select_one("div.tx-hdb") or soup

    heading = container.find("h2")
    if heading:
        profile.name = _clean(heading.get_text())

    info_item = container.select_one("ul li")
    if info_item:
        fb_link = info_item.find("a")
        if fb_link:
            profile.fachbereich = _clean(fb_link.get_text())
        profile.position = _clean(info_item.get_text()).removesuffix(profile.fachbereich).strip().rstrip(",").strip()

    for row in container.select("table tr"):
        cells = row.find_all("td")
        if len(cells) < 2:
            continue
        key = _clean(cells[0].get_text()).rstrip(":").lower()
        value = _clean(cells[1].get_text())
        if key == "ort":
            profile.ort = value
        elif key == "sprechzeiten":
            profile.sprechzeiten = value
        elif key == "telefon":
            profile.telefon = value
        elif key == "e-mail":
            if "[at]" in value or "@" in value:
                profile.email = value.replace("[at]", "@").replace(" ", "")
            else:
                mail_link = cells[1].find("a", attrs={"data-mailto-token": True})
                if mail_link:
                    vector = int(mail_link.get("data-mailto-vector", 3))
                    profile.email = decode_mailto_token(mail_link["data-mailto-token"], vector)
        elif key == "homepage" and not profile.homepage_url:
            page_link = cells[1].find("a", href=True)
            if page_link:
                profile.homepage_url = page_link["href"].strip()

    return profile


async def fetch_homepage_text(client: httpx.AsyncClient, url: str) -> str:
    """Lädt eine Homepage/Laborseite und extrahiert den sichtbaren Text (gekürzt)."""
    if not url.startswith(("http://", "https://")):
        url = f"{BASE_URL}{url}" if url.startswith("/") else f"https://{url}"
    html = await _get(client, url)
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer", "noscript"]):
        tag.decompose()
    text = re.sub(r"\n{3,}", "\n\n", soup.get_text(separator="\n"))
    text = "\n".join(line.strip() for line in text.splitlines() if line.strip())
    return text[:MAX_PAGE_CHARS]


async def polite_delay():
    await asyncio.sleep(REQUEST_DELAY_S)
