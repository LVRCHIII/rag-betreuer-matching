"""Automatisiertes Benchmark für das RAG Betreuer-Matching.

Drei Test-Ebenen (siehe README.md):
  A – Matching-Genauigkeit (objektiv, Retrieval-Trefferquote, skaliert auf Hunderte)
  B – Antwortqualität (RAGAS: Faithfulness, Answer Relevancy, Context Recall, Stichprobe)
  C – Robustheit & Compliance (Fallback, Sprache, Quellen)

Erzeugt einen Excel-Report, ein Markdown-Summary und JSON-Rohdaten für den Anhang.
"""
