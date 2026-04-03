"""
Promise extractor for VeedurIA PromesóMetro.

Two-pass extraction from candidate government program PDFs:
  1. Regex pass: PROMISE_TRIGGERS — verbal future forms + commitment phrases.
  2. spaCy NER pass: es_core_news_lg — confirms named entity presence (optional).

Produces promises.parquet for use by coherence_scorer.py.

Ethics note:
    Extracts campaign commitments from publicly available government programs.
    No personal data is stored beyond what the candidate made public.

Usage:
    from src.processing.promise_extractor import extract_promises_from_pdf

    promises = extract_promises_from_pdf(
        pdf_path=Path("data/raw/programas/cand_001_2026.pdf"),
        politician_id="cand_001",
        politician_name="Candidato Ejemplo",
        source_url="https://...",
    )

CLI:
    python -m src.processing.promise_extractor --election_year=2026
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from src.utils.logger import get_logger, log_etl_event

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PROJECT_ROOT   = Path(__file__).resolve().parent.parent.parent
PROGRAMAS_DIR  = PROJECT_ROOT / "data" / "raw" / "programas"
PROMISES_DIR   = PROJECT_ROOT / "data" / "processed" / "promises"
MANIFEST_FILE  = PROGRAMAS_DIR / "manifest.json"

MIN_SENTENCE_LEN = 20   # characters — reject shorter sentences
MAX_SENTENCE_LEN = 600  # characters — reject unusually long chunks

# ---------------------------------------------------------------------------
# Promise trigger patterns
# ---------------------------------------------------------------------------

# Verbal future forms and commitment phrases in Colombian Spanish
PROMISE_TRIGGERS: list[re.Pattern] = [
    # 1st-person plural future
    re.compile(r"\b(garantizaremos|crearemos|construiremos|implementaremos|"
               r"promoveremos|desarrollaremos|fortaleceremos|invertiremos|"
               r"reduciremos|eliminaremos|ampliaremos|mejoraremos|aseguraremos|"
               r"brindaremos|impulsaremos|estableceremos|diseñaremos|"
               r"financiaremos|priorizaremos|lograremos)\b", re.IGNORECASE),
    # Explicit commitment phrases
    re.compile(r"\b(nos comprometemos|me comprometo|mi gobierno|nuestro gobierno|"
               r"desde el gobierno|al llegar al gobierno|en los primeros\s+\d+|"
               r"en el primer año|en los primeros \w+\s+años|"
               r"propuesta\s+\d*|propuestas\s+\d*)\b", re.IGNORECASE),
    # Quantified targets
    re.compile(r"\b(cero\s+\w+|100\s*%\s+de|el\s+\d+\s*%\s+de|"
               r"\d+\s+(millones|mil|nuevos|nuevas)\s+\w+)\b", re.IGNORECASE),
    # Imperative policy forms
    re.compile(r"\b(será\s+gratuita?|será\s+universal|será\s+obligatori[ao]|"
               r"será\s+prioritari[ao]|se\s+garantizará|se\s+creará|"
               r"se\s+implementará|se\s+construirá|se\s+ampliará)\b", re.IGNORECASE),
]

# ---------------------------------------------------------------------------
# Sentence splitter
# ---------------------------------------------------------------------------

_SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑÜ])")


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences. Simple regex — good enough for policy PDFs."""
    # Normalize whitespace first
    text = re.sub(r"\s+", " ", text).strip()
    return _SENT_SPLIT_RE.split(text)


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def extract_promises_from_pdf(
    pdf_path: Path,
    politician_id: str,
    politician_name: str,
    source_url: str = "",
    election_year: int = 2026,
    chamber: str = "presidente",
    party: str = "",
) -> list[dict]:
    """
    Extract promise sentences from a PDF government program.

    Args:
        pdf_path:       Path to the PDF file.
        politician_id:  Unique candidate identifier.
        politician_name: Display name.
        source_url:     Original URL of the PDF.
        election_year:  Electoral year.
        chamber:        'presidente' | 'senado' | 'camara'
        party:          Party name.

    Returns:
        List of promise dicts matching promises.parquet schema.
    """
    try:
        import pdfplumber  # lazy import — not required for tests
    except ImportError:
        logger.error("pdfplumber not installed. Run: pip install pdfplumber")
        return []

    if not pdf_path.exists():
        logger.warning("PDF not found: %s", pdf_path)
        return []

    logger.info("Extracting promises from %s", pdf_path.name)

    full_text = ""
    page_map: list[tuple[int, str]] = []  # (page_num, text)

    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                page_text = page.extract_text() or ""
                page_map.append((page_num, page_text))
                full_text += f"\n{page_text}"
    except Exception as exc:
        logger.error("Error reading PDF %s: %s", pdf_path.name, exc)
        return []

    # Build sentence → page lookup
    sentence_pages: dict[str, int] = {}
    for page_num, page_text in page_map:
        for sent in _split_sentences(page_text):
            sentence_pages[sent.strip()] = page_num

    promises: list[dict] = []
    name_norm = _normalize_name(politician_name)

    for sent in _split_sentences(full_text):
        sent = sent.strip()
        if len(sent) < MIN_SENTENCE_LEN or len(sent) > MAX_SENTENCE_LEN:
            continue

        trigger_count = _count_triggers(sent)
        if trigger_count == 0:
            continue

        ner_confirmed = _ner_confirm(sent)
        confidence = _compute_confidence(trigger_count, ner_confirmed)

        page_num = sentence_pages.get(sent, 0)
        promise_id = _make_promise_id(politician_id, sent)

        promises.append({
            "promise_id":            promise_id,
            "politician_id":         politician_id,
            "politician_name_norm":  name_norm,
            "chamber":               chamber,
            "party":                 party,
            "election_year":         election_year,
            "source_type":           "programa_gobierno",
            "source_url":            source_url,
            "source_page":           page_num,
            "promise_text":          sent,
            "promise_text_clean":    _clean_text(sent),
            "domain":                "",      # filled by promise_classifier
            "domain_confidence":     0.0,
            "extraction_confidence": confidence,
            "embedding_model":       "",      # filled by coherence_scorer
            "extracted_at":          datetime.now(timezone.utc).isoformat(),
            "year_month":            f"{election_year}-01",
        })

    logger.info(
        "Extracted %d promises from %s (politician=%s)",
        len(promises), pdf_path.name, politician_id,
    )
    log_etl_event("promise_extraction_complete", politician_id=politician_id, count=len(promises))
    return promises


def extract_all_programas(
    election_year: int = 2026,
    force_reextract: bool = False,
) -> pd.DataFrame:
    """
    Extract promises from all PDFs listed in data/raw/programas/manifest.json.

    Returns:
        DataFrame written to data/processed/promises/promises.parquet.
    """
    if not MANIFEST_FILE.exists():
        logger.warning("No manifest found at %s — run programa_scraper first.", MANIFEST_FILE)
        return pd.DataFrame(columns=_PROMISES_SCHEMA)

    with open(MANIFEST_FILE, encoding="utf-8") as f:
        manifest: list[dict] = json.load(f)

    # Load candidates reference to get metadata
    candidates_path = PROJECT_ROOT / "data" / "reference" / "candidates_2026.json"
    candidates: dict[str, dict] = {}
    if candidates_path.exists():
        with open(candidates_path, encoding="utf-8") as f:
            for c in json.load(f):
                candidates[c["politician_id"]] = c

    all_promises: list[dict] = []

    for entry in manifest:
        if entry.get("http_status") != 200:
            logger.info("Skipping %s (http_status=%s)", entry.get("politician_id"), entry.get("http_status"))
            continue

        pid   = entry["politician_id"]
        fpath = Path(entry["local_path"])
        cand  = candidates.get(pid, {})

        promises = extract_promises_from_pdf(
            pdf_path=fpath,
            politician_id=pid,
            politician_name=cand.get("name", pid),
            source_url=entry.get("source_url", ""),
            election_year=cand.get("election_year", election_year),
            chamber=cand.get("chamber", "presidente"),
            party=cand.get("party", ""),
        )
        all_promises.extend(promises)

    if not all_promises:
        logger.warning("No promises extracted from any PDF.")
        return pd.DataFrame(columns=_PROMISES_SCHEMA)

    df = pd.DataFrame(all_promises)
    PROMISES_DIR.mkdir(parents=True, exist_ok=True)
    out_path = PROMISES_DIR / "promises.parquet"
    df.to_parquet(out_path, engine="pyarrow", compression="snappy", index=False)
    logger.info("Wrote promises.parquet: %d rows → %s", len(df), out_path)
    return df


# ---------------------------------------------------------------------------
# Trigger counting
# ---------------------------------------------------------------------------

def _count_triggers(text: str) -> int:
    """Count how many PROMISE_TRIGGERS match in `text`."""
    return sum(1 for pattern in PROMISE_TRIGGERS if pattern.search(text))


# ---------------------------------------------------------------------------
# spaCy NER confirmation (optional — degrades gracefully)
# ---------------------------------------------------------------------------

_NLP = None  # lazy-loaded once
_NLP_FAILED = False


def _ner_confirm(sentence: str) -> bool:
    """
    Check whether spaCy NER detects at least one named entity in the sentence.
    This increases confidence that the sentence is concrete and actionable.
    Returns True if confirmed; False if no entities or spaCy unavailable.
    """
    global _NLP, _NLP_FAILED
    if _NLP_FAILED:
        return False
    if _NLP is None:
        try:
            import spacy
            _NLP = spacy.load("es_core_news_lg")
        except Exception as exc:
            logger.warning("spaCy load failed (%s) — NER confirmation disabled.", exc)
            _NLP_FAILED = True
            return False

    doc = _NLP(sentence[:500])
    return any(ent.label_ in {"ORG", "GPE", "LOC", "PER", "MISC"} for ent in doc.ents)


# ---------------------------------------------------------------------------
# Confidence computation
# ---------------------------------------------------------------------------

def _compute_confidence(trigger_count: int, ner_confirmed: bool) -> float:
    """
    confidence = min(0.95, 0.5 + n_triggers * 0.1 + 0.15 * ner_confirmed)

    Bounds: [0.5 if 0 triggers (shouldn't happen), 0.95 max]
    """
    conf = 0.5 + trigger_count * 0.1 + (0.15 if ner_confirmed else 0.0)
    return round(min(0.95, conf), 3)


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def _normalize_name(name: str) -> str:
    """Uppercase + strip accents for consistent name matching."""
    nfkd = unicodedata.normalize("NFKD", name.upper())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _clean_text(text: str) -> str:
    """Collapse whitespace and strip."""
    return re.sub(r"\s+", " ", text).strip()


def _make_promise_id(politician_id: str, sentence: str) -> str:
    seed = f"{politician_id}::{sentence[:200]}".encode()
    return f"p_{hashlib.md5(seed).hexdigest()[:16]}"


# ---------------------------------------------------------------------------
# Schema constant
# ---------------------------------------------------------------------------

_PROMISES_SCHEMA = [
    "promise_id", "politician_id", "politician_name_norm", "chamber", "party",
    "election_year", "source_type", "source_url", "source_page",
    "promise_text", "promise_text_clean", "domain", "domain_confidence",
    "extraction_confidence", "embedding_model", "extracted_at", "year_month",
]


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract promises from candidate PDFs.")
    parser.add_argument("--election_year", type=int, default=2026)
    parser.add_argument("--force_reextract", action="store_true", default=False)
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    df = extract_all_programas(
        election_year=args.election_year,
        force_reextract=args.force_reextract,
    )
    print(f"Done. {len(df)} promise rows written to promises.parquet.")
