"""
Congressional action scraper for VeedurIA PromesóMetro.

Fetches legislative actions from two public Colombian sources:
  1. SUIN-Juriscol  — laws (leyes), decrees (decretos)
  2. Gaceta del Congreso — debates, bills (proyectos de ley)

Writes an `actions.parquet` file for use by coherence_scorer.py.
Uses domain keyword labeling to pre-classify each action.

Ethics note:
    Only public official documents are fetched. No personal data is stored.
    Operates at the institutional / document level.

Usage:
    from src.ingestion.congreso_client import fetch_actions, build_actions_df

    records = fetch_actions(since_date="2025-01-01")
    df      = build_actions_df(records)

CLI:
    python -m src.ingestion.congreso_client --since=2025-01-01
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from bs4 import BeautifulSoup

from src.utils.logger import get_logger, log_etl_event
from src.utils.rate_limiter import get_scraper_limiter

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
LAST_RUN_PATH = PROJECT_ROOT / "data" / "processed" / "last_run.json"
ACTIONS_DIR   = PROJECT_ROOT / "data" / "processed" / "promises"
RAW_DIR       = PROJECT_ROOT / "data" / "raw" / "congreso"

# Rate limiter — same as Cuentas Claras: 0.2 req/s, burst=1
_limiter = get_scraper_limiter()

# SUIN-Juriscol base — public REST-style search
SUIN_SEARCH_URL = "https://www.suin-juriscol.gov.co/viewDocument.asp"
SUIN_LAW_URL    = "https://www.suin-juriscol.gov.co/viewDocument.asp?id="

# Gaceta del Congreso public search
GACETA_SEARCH_URL = "https://www.imprenta.gov.co/gacetap/gaceta.nivel_3"

RETRY_BACKOFF: list[int] = [10, 30, 60]

# ---------------------------------------------------------------------------
# Domain keyword map — 9 domains
# Used to pre-label both actions AND promises.
# Populated here; imported by promise_extractor and promise_classifier.
# ---------------------------------------------------------------------------

DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "educacion": [
        "educaci", "escuela", "colegio", "universidad", "docente", "maestro",
        "estudiante", "aprendizaje", "sena", "becas", "alfabetizaci",
    ],
    "salud": [
        "salud", "hospital", "eps", "medicamento", "vacuna", "enfermedad",
        "médico", "clínica", "atención primaria", "urgencias", "nutrici",
    ],
    "seguridad": [
        "seguridad", "policía", "crimen", "delito", "homicidio", "violencia",
        "fuerzas militares", "ejercito", "fuerza aérea", "armada", "orden público",
    ],
    "economia": [
        "economía", "empleo", "trabajo", "empresa", "impuesto", "tributari",
        "inversión", "pib", "inflación", "exportaci", "comercio", "aranceles",
    ],
    "infraestructura": [
        "infraestructura", "carretera", "vía", "puente", "aeropuerto",
        "acueducto", "alcantarillado", "vivienda", "urbanismo", "transporte",
    ],
    "medio_ambiente": [
        "medio ambiente", "cambio climático", "páramo", "biodiversidad",
        "agua", "minería", "deforestación", "emisiones", "energía renovable",
        "solar", "eólica",
    ],
    "justicia": [
        "justicia", "tribunal", "corte", "juzgado", "fiscalía", "procuraduría",
        "contraloría", "impunidad", "pena", "prisión", "reforma judicial",
    ],
    "social": [
        "pobreza", "desigualdad", "familia", "mujer", "género", "niñez",
        "adulto mayor", "discapacidad", "subsidio", "protección social",
        "reparaci", "víctimas",
    ],
    "otro": [],  # fallback — never used as a keyword target
}


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def fetch_actions(
    since_date: str = "2025-01-01",
    max_laws: int = 200,
    max_gaceta: int = 100,
) -> list[dict]:
    """
    Fetch legislative actions from SUIN-Juriscol and Gaceta del Congreso.

    Args:
        since_date: ISO date string (YYYY-MM-DD). Only fetch after this date.
        max_laws:   Max laws to fetch from SUIN.
        max_gaceta: Max gaceta entries to fetch.

    Returns:
        List of raw action record dicts.
    """
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    all_records: list[dict] = []

    logger.info("Fetching laws from SUIN-Juriscol since %s", since_date)
    laws = _fetch_suin_laws(since_date=since_date, limit=max_laws)
    all_records.extend(laws)
    log_etl_event("suin_fetch_complete", count=len(laws))

    logger.info("Fetching Gaceta entries since %s", since_date)
    gacetas = _fetch_gaceta_entries(since_date=since_date, limit=max_gaceta)
    all_records.extend(gacetas)
    log_etl_event("gaceta_fetch_complete", count=len(gacetas))

    logger.info("Total actions fetched: %d", len(all_records))
    return all_records


def build_actions_df(records: list[dict]) -> pd.DataFrame:
    """
    Normalize raw action records into the canonical actions schema.

    Returns:
        DataFrame with columns matching actions.parquet schema.
        Writes to data/processed/promises/actions.parquet.
    """
    if not records:
        logger.warning("No action records provided — returning empty DataFrame.")
        return pd.DataFrame(columns=_ACTIONS_SCHEMA)

    rows = []
    for rec in records:
        text_clean = _clean_text(rec.get("action_text_summary", ""))
        domain, domain_conf = _infer_domain(text_clean)
        rows.append({
            "action_id":           rec.get("action_id") or _make_id(rec),
            "politician_id":       rec.get("politician_id", ""),
            "action_type":         rec.get("action_type", "ley"),
            "action_title":        rec.get("action_title", "")[:500],
            "action_text_summary": rec.get("action_text_summary", "")[:2000],
            "action_text_clean":   text_clean[:2000],
            "action_date":         rec.get("action_date", ""),
            "source_url":          rec.get("source_url", ""),
            "source_system":       rec.get("source_system", ""),
            "domain_hint":         domain,
            "domain_confidence":   domain_conf,
            "year_month":          _to_year_month(rec.get("action_date", "")),
            "fetched_at":          datetime.now(timezone.utc).isoformat(),
        })

    df = pd.DataFrame(rows)

    ACTIONS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = ACTIONS_DIR / "actions.parquet"
    df.to_parquet(out_path, engine="pyarrow", compression="snappy", index=False)
    logger.info("Wrote actions.parquet: %d rows → %s", len(df), out_path)

    return df


# ---------------------------------------------------------------------------
# SUIN-Juriscol scraper
# ---------------------------------------------------------------------------

def _fetch_suin_laws(since_date: str, limit: int) -> list[dict]:
    """
    Fetch laws/decrees from SUIN-Juriscol public search.

    SUIN does not have a JSON API; we scrape the HTML search results.
    We search for laws passed after `since_date` using the category filter.
    """
    records: list[dict] = []
    since_year = since_date[:4]

    # SUIN search form params — scrape the first result page
    search_params = {
        "categoria":  "LEYES",
        "anio":       since_year,
        "resultados": min(limit, 50),
    }

    try:
        _limiter.acquire()
        resp = _get_with_retry(SUIN_SEARCH_URL, params=search_params)
        if resp is None:
            logger.error("SUIN search request failed after retries.")
            return records

        soup = BeautifulSoup(resp.text, "html.parser")
        # SUIN displays results in table rows — find links to individual laws
        law_links = _extract_suin_links(soup)
        logger.info("SUIN: found %d law links on search page.", len(law_links))

        for link_info in law_links[:limit]:
            _limiter.acquire()
            rec = _scrape_suin_document(link_info)
            if rec:
                rec["action_date"] = _parse_suin_date(rec.get("raw_date", ""), since_date)
                if rec["action_date"] < since_date:
                    continue
                records.append(rec)

    except Exception as exc:
        logger.error("SUIN fetch error: %s", exc)

    return records


def _extract_suin_links(soup: BeautifulSoup) -> list[dict]:
    """Extract law document links from SUIN search result page."""
    links: list[dict] = []
    # SUIN result links typically have href containing viewDocument.asp?id=
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        if "viewDocument" in href or "id=" in href:
            doc_id = _extract_param(href, "id")
            if doc_id:
                links.append({
                    "doc_id": doc_id,
                    "title":  a_tag.get_text(strip=True)[:300],
                    "url":    f"https://www.suin-juriscol.gov.co{href}" if href.startswith("/") else href,
                })
    return links


def _scrape_suin_document(link_info: dict) -> dict | None:
    """Scrape a single SUIN law document page."""
    url = link_info.get("url", "")
    if not url:
        return None

    resp = _get_with_retry(url)
    if resp is None:
        return None

    soup = BeautifulSoup(resp.text, "html.parser")

    # Extract document body text (summary)
    body_text = ""
    for tag in soup.find_all(["p", "div"], class_=re.compile(r"(artículo|contenido|body|texto)", re.I)):
        body_text += " " + tag.get_text(separator=" ", strip=True)
    if not body_text.strip():
        # Fallback: get all paragraph text
        body_text = " ".join(p.get_text(strip=True) for p in soup.find_all("p"))

    # Extract date
    raw_date = ""
    date_pattern = re.search(r"(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})", soup.get_text())
    if date_pattern:
        raw_date = date_pattern.group(0)

    return {
        "action_id":           f"suin_{link_info['doc_id']}",
        "action_type":         "ley",
        "action_title":        link_info.get("title", "")[:500],
        "action_text_summary": body_text.strip()[:2000],
        "raw_date":            raw_date,
        "source_url":          url,
        "source_system":       "suin_juriscol",
        "politician_id":       "",  # Laws are not attributed to a single politician
    }


# ---------------------------------------------------------------------------
# Gaceta del Congreso scraper
# ---------------------------------------------------------------------------

def _fetch_gaceta_entries(since_date: str, limit: int) -> list[dict]:
    """
    Fetch debate / bill entries from Gaceta del Congreso public portal.

    The Imprenta Nacional portal allows free text search by date range.
    """
    records: list[dict] = []

    search_params = {
        "p_opcion":       "buscar",
        "p_fecha_ini":    since_date,
        "p_fecha_fin":    datetime.now(timezone.utc).date().isoformat(),
        "p_cantidad":     min(limit, 50),
    }

    try:
        _limiter.acquire()
        resp = _get_with_retry(GACETA_SEARCH_URL, params=search_params)
        if resp is None:
            logger.error("Gaceta search request failed after retries.")
            return records

        soup = BeautifulSoup(resp.text, "html.parser")
        entries = _extract_gaceta_entries(soup, since_date, limit)
        records.extend(entries)
        logger.info("Gaceta: extracted %d entries.", len(entries))

    except Exception as exc:
        logger.error("Gaceta fetch error: %s", exc)

    return records


def _extract_gaceta_entries(
    soup: BeautifulSoup,
    since_date: str,
    limit: int,
) -> list[dict]:
    """Parse Gaceta search result rows into action records."""
    entries: list[dict] = []

    rows = soup.find_all("tr")
    for row in rows[:limit]:
        cells = row.find_all("td")
        if len(cells) < 3:
            continue

        title_cell = cells[0].get_text(strip=True)
        date_cell  = cells[1].get_text(strip=True) if len(cells) > 1 else ""
        link_tag   = row.find("a", href=True)
        url        = link_tag["href"] if link_tag else ""
        if url and url.startswith("/"):
            url = "https://www.imprenta.gov.co" + url

        parsed_date = _parse_colombian_date(date_cell)
        if parsed_date < since_date:
            continue

        # Extract summary text from the gaceta page (best-effort)
        summary = title_cell[:500]
        if url:
            _limiter.acquire()
            detail_resp = _get_with_retry(url)
            if detail_resp:
                detail_soup = BeautifulSoup(detail_resp.text, "html.parser")
                paragraphs = detail_soup.find_all("p")
                summary = " ".join(p.get_text(strip=True) for p in paragraphs[:10])[:2000]

        entries.append({
            "action_id":           f"gaceta_{hashlib.md5(url.encode()).hexdigest()[:12]}",
            "action_type":         _classify_gaceta_type(title_cell),
            "action_title":        title_cell[:500],
            "action_text_summary": summary,
            "action_date":         parsed_date,
            "source_url":          url,
            "source_system":       "gaceta_congreso",
            "politician_id":       "",
        })

    return entries


# ---------------------------------------------------------------------------
# Domain inference
# ---------------------------------------------------------------------------

def infer_domain(text: str) -> tuple[str, float]:
    """
    Infer domain label from text using keyword matching.

    Returns:
        (domain, confidence) — confidence 0.3–0.95.
    """
    return _infer_domain(text)


def _infer_domain(text: str) -> tuple[str, float]:
    text_lower = _normalize_for_match(text)
    best_domain = "otro"
    best_score  = 0

    for domain, keywords in DOMAIN_KEYWORDS.items():
        if domain == "otro":
            continue
        hits = sum(1 for kw in keywords if kw in text_lower)
        if hits > best_score:
            best_score  = hits
            best_domain = domain

    if best_score == 0:
        return "otro", 0.3
    confidence = min(0.95, 0.4 + best_score * 0.08)
    return best_domain, round(confidence, 3)


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _get_with_retry(
    url: str,
    params: dict | None = None,
    timeout: int = 45,
) -> requests.Response | None:
    """GET with retry on 5xx / network error. Returns None after all retries fail."""
    headers = {
        "User-Agent": "VeedurIA/1.0 (https://github.com/veeduria; civic-transparency-bot)",
        "Accept-Language": "es-CO,es;q=0.9",
    }
    last_exc: Exception | None = None

    for attempt, backoff in enumerate([0] + RETRY_BACKOFF, start=0):
        if backoff:
            logger.info("Retry %d for %s — waiting %ds", attempt, url[:80], backoff)
            time.sleep(backoff)
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=timeout)
            if resp.status_code == 200:
                return resp
            if 400 <= resp.status_code < 500:
                logger.error("HTTP %d for %s — not retrying.", resp.status_code, url[:80])
                return None
            logger.warning("HTTP %d for %s — retrying.", resp.status_code, url[:80])
        except requests.RequestException as exc:
            last_exc = exc
            logger.warning("Request error: %s — retrying.", exc)

    logger.error("All retries exhausted for %s. Last error: %s", url[:80], last_exc)
    return None


# ---------------------------------------------------------------------------
# Date parsing helpers
# ---------------------------------------------------------------------------

_MONTHS_ES = {
    "enero": "01", "febrero": "02", "marzo": "03", "abril": "04",
    "mayo": "05", "junio": "06", "julio": "07", "agosto": "08",
    "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12",
}


def _parse_colombian_date(raw: str, fallback: str = "1900-01-01") -> str:
    """Parse Colombian date strings like '15 de marzo de 2025' → '2025-03-15'."""
    raw = raw.lower().strip()
    m = re.search(r"(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})", raw)
    if m:
        day, month_name, year = m.groups()
        month = _MONTHS_ES.get(month_name, "01")
        return f"{year}-{month}-{int(day):02d}"
    # Try YYYY-MM-DD format directly
    m2 = re.match(r"(\d{4}-\d{2}-\d{2})", raw)
    if m2:
        return m2.group(1)
    return fallback


def _parse_suin_date(raw: str, fallback: str) -> str:
    return _parse_colombian_date(raw, fallback=fallback)


def _to_year_month(date_str: str) -> str:
    try:
        return date_str[:7]  # "YYYY-MM"
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Text normalization helpers
# ---------------------------------------------------------------------------

def _normalize_for_match(text: str) -> str:
    """Lowercase + strip accents for keyword matching."""
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _clean_text(text: str) -> str:
    """Basic text cleanup: collapse whitespace, strip leading/trailing."""
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _make_id(rec: dict) -> str:
    """Generate a deterministic action_id from URL + title."""
    seed = (rec.get("source_url", "") + rec.get("action_title", "")).encode()
    return hashlib.md5(seed).hexdigest()[:16]


def _extract_param(url: str, param: str) -> str:
    """Extract a query parameter value from a URL string."""
    m = re.search(rf"[?&]{param}=([^&]+)", url)
    return m.group(1) if m else ""


def _classify_gaceta_type(title: str) -> str:
    """Classify gaceta entry type from title keywords."""
    title_l = title.lower()
    if "proyecto de ley" in title_l:
        return "proyecto_ley"
    if "debate" in title_l:
        return "debate"
    if "decreto" in title_l:
        return "decreto"
    return "gaceta"


# ---------------------------------------------------------------------------
# Schema constant for empty DataFrame
# ---------------------------------------------------------------------------

_ACTIONS_SCHEMA = [
    "action_id", "politician_id", "action_type", "action_title",
    "action_text_summary", "action_text_clean", "action_date", "source_url",
    "source_system", "domain_hint", "domain_confidence", "year_month", "fetched_at",
]


# ---------------------------------------------------------------------------
# last_run.json helpers
# ---------------------------------------------------------------------------

def get_last_run_date(key: str = "promises_actions") -> str:
    """Read last successful run date for actions ingestion."""
    if LAST_RUN_PATH.exists():
        try:
            with open(LAST_RUN_PATH, encoding="utf-8") as f:
                data = json.load(f)
            return data.get(key, {}).get("last_updated_at", "2025-01-01")[:10]
        except (json.JSONDecodeError, OSError):
            pass
    return "2025-01-01"


def update_last_run(key: str = "promises_actions") -> None:
    """Update last_run.json after a successful actions fetch."""
    data: dict[str, Any] = {}
    if LAST_RUN_PATH.exists():
        try:
            with open(LAST_RUN_PATH, encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            pass

    data.setdefault(key, {})["last_updated_at"] = datetime.now(timezone.utc).isoformat()
    LAST_RUN_PATH.parent.mkdir(parents=True, exist_ok=True)
    LAST_RUN_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    logger.info("Updated last_run.json key=%s", key)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch legislative actions for PromesóMetro.")
    parser.add_argument(
        "--since",
        type=str,
        default=None,
        help="Fetch actions after this ISO date (YYYY-MM-DD). Defaults to last_run.json value.",
    )
    parser.add_argument("--max_laws",   type=int, default=200)
    parser.add_argument("--max_gaceta", type=int, default=100)
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    since = args.since or get_last_run_date()
    logger.info("Starting congreso_client with since=%s", since)

    records = fetch_actions(
        since_date=since,
        max_laws=args.max_laws,
        max_gaceta=args.max_gaceta,
    )
    df = build_actions_df(records)
    update_last_run()
    print(f"Done. {len(df)} action rows written to actions.parquet.")
