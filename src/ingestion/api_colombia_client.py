"""
Client for api-colombia.com — fetches department and city lists for
geographic normalization of SECOP II contract locations.

The api-colombia.com API provides canonical department/city names and codes.
We cache the results at module level to avoid repeated HTTP calls.

Usage:
    from src.ingestion.api_colombia_client import (
        get_canonical_departments,
        get_canonical_cities,
        fuzzy_lookup,
    )

    departments = get_canonical_departments()
    matched = fuzzy_lookup("Bogota D.C", departments)  # → "BOGOTÁ, D.C."
"""

from __future__ import annotations

import unicodedata
from functools import lru_cache
from typing import Any

import requests
from Levenshtein import ratio as levenshtein_ratio

from src.utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

API_BASE_URL = "https://api-colombia.com/api/v1"
REQUEST_TIMEOUT = 15  # seconds


# ---------------------------------------------------------------------------
# Text normalization helpers
# ---------------------------------------------------------------------------

def _normalize_text(text: str) -> str:
    """
    Normalize a location name for matching:
    - Uppercase
    - Strip leading/trailing whitespace
    - Remove accents (NFD decomposition, strip combining marks)
    - Collapse multiple spaces to single
    """
    text = text.strip().upper()
    # Decompose into base + combining chars, then filter out combining marks
    nfkd = unicodedata.normalize("NFKD", text)
    without_accents = "".join(
        ch for ch in nfkd if unicodedata.category(ch) != "Mn"
    )
    # Collapse whitespace
    return " ".join(without_accents.split())


# ---------------------------------------------------------------------------
# API fetchers (cached)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def get_canonical_departments() -> list[dict[str, Any]]:
    """
    Fetch all Colombian departments from api-colombia.com.

    Returns:
        List of dicts with keys: id, name, description, cityCapitalId,
        municipalities, phonePrefix, etc.

    Each entry has its 'name' as returned by the API (canonical).
    Also adds a '_normalized' key with the accent-stripped uppercase name
    for fuzzy matching.
    """
    url = f"{API_BASE_URL}/Department"
    try:
        resp = requests.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        departments = resp.json()
    except requests.RequestException as exc:
        logger.error("Failed to fetch departments from api-colombia.com: %s", exc)
        return _fallback_departments()

    for dept in departments:
        dept["_normalized"] = _normalize_text(dept.get("name", ""))

    logger.info(
        "Fetched %d departments from api-colombia.com", len(departments)
    )
    return departments


@lru_cache(maxsize=1)
def get_canonical_cities() -> list[dict[str, Any]]:
    """
    Fetch all Colombian cities/municipalities from api-colombia.com.

    Returns:
        List of dicts with keys: id, name, departmentId, description, etc.

    Also adds '_normalized' for matching.
    """
    url = f"{API_BASE_URL}/City"
    try:
        resp = requests.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        cities = resp.json()
    except requests.RequestException as exc:
        logger.error("Failed to fetch cities from api-colombia.com: %s", exc)
        return []

    for city in cities:
        city["_normalized"] = _normalize_text(city.get("name", ""))

    logger.info(
        "Fetched %d cities from api-colombia.com", len(cities)
    )
    return cities


# ---------------------------------------------------------------------------
# Fuzzy matching
# ---------------------------------------------------------------------------

def fuzzy_lookup(
    raw_name: str,
    canonical_list: list[dict[str, Any]],
    threshold: float = 0.75,
) -> str | None:
    """
    Match a raw location name against a list of canonical entries using
    Levenshtein similarity.

    Args:
        raw_name:       The raw location string from SECOP II data.
        canonical_list: List of dicts with '_normalized' and 'name' keys
                        (as returned by get_canonical_departments/cities).
        threshold:      Minimum similarity ratio to accept a match (0.0–1.0).
                        Default 0.75 balances recall vs. precision for
                        Colombian location names.

    Returns:
        The canonical 'name' of the best match, or None if no match meets
        the threshold.
    """
    if not raw_name or not canonical_list:
        return None

    normalized_input = _normalize_text(raw_name)

    # Exact match first (fast path)
    for entry in canonical_list:
        if entry["_normalized"] == normalized_input:
            return entry["name"]

    # Fuzzy match
    best_score = 0.0
    best_name: str | None = None
    for entry in canonical_list:
        score = levenshtein_ratio(normalized_input, entry["_normalized"])
        if score > best_score:
            best_score = score
            best_name = entry["name"]

    if best_score >= threshold:
        return best_name

    logger.debug(
        "No fuzzy match for '%s' (best: '%s' at %.2f, threshold: %.2f)",
        raw_name, best_name, best_score, threshold,
    )
    return None


# ---------------------------------------------------------------------------
# Fallback data (when API is unreachable)
# ---------------------------------------------------------------------------

def _fallback_departments() -> list[dict[str, Any]]:
    """
    Hardcoded list of Colombia's 32 departments + Bogotá D.C., used when
    api-colombia.com is unreachable. Names match the official DANE standard.
    """
    names = [
        "Amazonas", "Antioquia", "Arauca", "Atlántico",
        "Bolívar", "Boyacá", "Caldas", "Caquetá",
        "Casanare", "Cauca", "Cesar", "Chocó",
        "Córdoba", "Cundinamarca", "Guainía", "Guaviare",
        "Huila", "La Guajira", "Magdalena", "Meta",
        "Nariño", "Norte de Santander", "Putumayo", "Quindío",
        "Risaralda", "San Andrés y Providencia", "Santander", "Sucre",
        "Tolima", "Valle del Cauca", "Vaupés", "Vichada",
        "Bogotá, D.C.",
    ]
    departments = []
    for i, name in enumerate(names, start=1):
        departments.append({
            "id": i,
            "name": name,
            "_normalized": _normalize_text(name),
        })
    logger.warning(
        "Using fallback department list (%d entries) — api-colombia.com unreachable",
        len(departments),
    )
    return departments
