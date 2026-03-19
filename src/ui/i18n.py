"""
ES/EN translation dictionary loader for VeedurIA.

Reads JSON translation files from the i18n/ directory and caches them
using st.cache_data for efficient reuse across Streamlit reruns.

Usage:
    from src.ui.i18n import load_translations, t

    translations = load_translations("es")
    label = t("kpi_total_contracts")  # → "Contratos analizados"
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import streamlit as st

from src.utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

I18N_DIR = Path(__file__).resolve().parent.parent.parent / "i18n"
SUPPORTED_LANGUAGES = ("es", "en")
DEFAULT_LANGUAGE = "es"


# ---------------------------------------------------------------------------
# Translation loading
# ---------------------------------------------------------------------------

@st.cache_data(ttl=0)
def load_translations(lang: str) -> dict[str, str]:
    """
    Load translations for the given language code.

    Args:
        lang: Language code — "es" or "en".

    Returns:
        Dict mapping translation keys to translated strings.

    Raises:
        FileNotFoundError: If the language file does not exist.
    """
    if lang not in SUPPORTED_LANGUAGES:
        raise FileNotFoundError(
            f"Unsupported language '{lang}'. Supported: {SUPPORTED_LANGUAGES}"
        )

    path = I18N_DIR / f"{lang}.json"
    if not path.exists():
        raise FileNotFoundError(f"Translation file not found: {path}")

    with open(path, "r", encoding="utf-8") as f:
        translations = json.load(f)

    logger.info("Loaded %d translation keys for '%s'", len(translations), lang)
    return translations


def get_lang() -> str:
    """Get the current language from session state, defaulting to 'es'."""
    return st.session_state.get("lang", DEFAULT_LANGUAGE)


def t(key: str, **kwargs: Any) -> str:
    """
    Translate a key using the current session language.

    Args:
        key:     Translation key (e.g. "kpi_total_contracts").
        **kwargs: Format parameters (e.g. score=85, n=3).

    Returns:
        Translated string, or the key itself if not found.
    """
    lang = get_lang()
    translations = load_translations(lang)
    text = translations.get(key, key)
    if kwargs:
        try:
            text = text.format(**kwargs)
        except (KeyError, IndexError):
            pass  # Return unformatted if params don't match
    return text
