"""System-Prompt-Varianten für den A/B-Test der Robustheit.

`current` = der in den Settings hinterlegte Prompt (unverändert).
`v2`      = derselbe Prompt + ein vorangestellter Geltungsbereichs-/Ablehnungsblock.
            So unterscheidet sich nur EINE Sache → der Effekt ist sauber messbar.
"""

# Vorangestellter Schutzblock gegen unpassende/leere Anfragen ("sinnbefreite Antworten")
GUARD = """WICHTIG – Geltungsbereich und Ablehnung (hat Vorrang vor allem Folgenden):
Du beantwortest AUSSCHLIESSLICH Anfragen zur Suche nach Betreuenden oder Gutachtenden
für Abschlussarbeiten an der BHT.

- Wenn die Anfrage nichts mit einer Betreuendensuche zu tun hat (z. B. Smalltalk,
  Allgemeinwissen, Wetter, Rezepte, Witze, Aktien, Sport, Politik, Übersetzungen,
  andere Hochschulen) ODER unverständlich, sinnlos oder leer ist, dann antworte NUR
  mit einer kurzen, höflichen Ablehnung und einem Hinweis, wofür du da bist. Nenne in
  diesem Fall KEINE Namen, Personen, Fachbereiche oder Forschungsgebiete.
- Wenn der bereitgestellte Kontext nicht zur Anfrage passt oder leer ist, empfiehl
  niemanden und schreibe sinngemäß: „Auf Basis der aktuellen Datenbasis kann ich dazu
  keine Betreuendenempfehlung geben."
- Erfinde niemals Personen, Namen oder Fakten.

Nur wenn es sich um eine echte Betreuendensuche mit passendem Kontext handelt, befolge
die folgenden Anweisungen:

---

"""


def build(variant: str, current_prompt: str) -> str:
    """Gibt den System-Prompt für die gewählte Variante zurück (oder None für 'current',
    damit der in den Settings hinterlegte Prompt unverändert genutzt wird)."""
    if variant == "v2":
        return GUARD + current_prompt
    return None  # 'current' → pipeline nutzt den Settings-Prompt
