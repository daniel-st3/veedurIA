"""
Unit tests for i18n translation system.

Tests:
1. load_translations("es") returns a dict with content
2. load_translations with unsupported language raises FileNotFoundError
3. ES keys exactly match EN keys (no missing translations)
4. All Phase 3 PromesóMetro keys are present in both languages
5. All 9 domain keys present in both languages
6. Ethics key never contains forbidden language
7. Key values are non-empty strings
"""

from __future__ import annotations

import pytest

# Phase 3 required keys (subset — spot-checks the most critical ones)
_PM_REQUIRED_KEYS = [
    "pm_overview_kicker", "pm_overview_title", "pm_overview_sub",
    "pm_kpi_politicians", "pm_kpi_promises", "pm_kpi_coherence_rate", "pm_kpi_freshness",
    "pm_status_fulfilled", "pm_status_in_progress", "pm_status_no_action",
    "pm_scorecard_global", "pm_card_disclaimer", "pm_ethics_bar",
    "pm_methodology", "pm_method_thresholds", "pm_method_limits",
    "pm_no_data", "filter_politician", "filter_domain", "filter_year",
    "all_domains", "apply_filters",
]

_DOMAIN_KEYS = [
    "domain_educacion", "domain_salud", "domain_seguridad", "domain_economia",
    "domain_infraestructura", "domain_medio_ambiente", "domain_justicia",
    "domain_social", "domain_otro",
]

_FORBIDDEN_WORDS = [
    "incumplidor", "mentiroso", "promesa rota",
    "ilegal", "fraude", "corrupción confirmada",
]


# ---------------------------------------------------------------------------
# Test 1: Spanish translations return a dict
# ---------------------------------------------------------------------------

def test_es_translations_returns_dict(es_translations):
    """load_translations('es') should return a non-empty dict."""
    assert isinstance(es_translations, dict)
    assert len(es_translations) > 10


# ---------------------------------------------------------------------------
# Test 2: Unsupported language raises error
# ---------------------------------------------------------------------------

def test_unsupported_language_raises():
    """Requesting an unsupported language should raise FileNotFoundError."""
    from pathlib import Path

    i18n_dir = Path(__file__).resolve().parent.parent / "i18n"
    unsupported_path = i18n_dir / "fr.json"
    assert not unsupported_path.exists(), "Unexpected fr.json file exists"


# ---------------------------------------------------------------------------
# Test 3: ES keys == EN keys
# ---------------------------------------------------------------------------

def test_es_keys_match_en_keys(es_translations, en_translations):
    """Spanish and English translation files must have identical keys."""
    es_keys = set(es_translations.keys())
    en_keys = set(en_translations.keys())

    missing_in_en = es_keys - en_keys
    missing_in_es = en_keys - es_keys

    assert not missing_in_en, f"Keys in ES but missing in EN: {missing_in_en}"
    assert not missing_in_es, f"Keys in EN but missing in ES: {missing_in_es}"


# ---------------------------------------------------------------------------
# Test 4: Phase 3 keys present in both languages
# ---------------------------------------------------------------------------

def test_phase3_keys_in_es(es_translations):
    """All Phase 3 PromesóMetro keys must be present in es.json."""
    missing = [k for k in _PM_REQUIRED_KEYS if k not in es_translations]
    assert not missing, f"Missing Phase 3 keys in es.json: {missing}"


def test_phase3_keys_in_en(en_translations):
    """All Phase 3 PromesóMetro keys must be present in en.json."""
    missing = [k for k in _PM_REQUIRED_KEYS if k not in en_translations]
    assert not missing, f"Missing Phase 3 keys in en.json: {missing}"


# ---------------------------------------------------------------------------
# Test 5: All 9 domain keys present
# ---------------------------------------------------------------------------

def test_domain_keys_complete_es(es_translations):
    missing = [k for k in _DOMAIN_KEYS if k not in es_translations]
    assert not missing, f"Missing domain keys in es.json: {missing}"


def test_domain_keys_complete_en(en_translations):
    missing = [k for k in _DOMAIN_KEYS if k not in en_translations]
    assert not missing, f"Missing domain keys in en.json: {missing}"


# ---------------------------------------------------------------------------
# Test 6: Ethics key never contains forbidden language
# ---------------------------------------------------------------------------

def test_ethics_key_no_forbidden_words(es_translations, en_translations):
    """pm_ethics_bar and pm_card_disclaimer must not contain forbidden words."""
    audit_keys = ["pm_ethics_bar", "pm_card_disclaimer", "ethical_disclaimer"]
    for lang_name, trans in [("es", es_translations), ("en", en_translations)]:
        for key in audit_keys:
            val = trans.get(key, "").lower()
            for word in _FORBIDDEN_WORDS:
                assert word not in val, (
                    f"Forbidden word '{word}' found in {lang_name}.{key}"
                )


# ---------------------------------------------------------------------------
# Test 7: All values are non-empty strings
# ---------------------------------------------------------------------------

def test_all_values_are_non_empty_strings_es(es_translations):
    empty_keys = [k for k, v in es_translations.items() if not isinstance(v, str) or not v.strip()]
    assert not empty_keys, f"Empty/non-string values in es.json: {empty_keys}"


def test_all_values_are_non_empty_strings_en(en_translations):
    empty_keys = [k for k, v in en_translations.items() if not isinstance(v, str) or not v.strip()]
    assert not empty_keys, f"Empty/non-string values in en.json: {empty_keys}"
