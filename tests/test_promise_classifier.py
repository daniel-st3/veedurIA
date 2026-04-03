"""
Tests for src/processing/promise_classifier.py

Mocks BERTopic and sentence-transformers — zero real model loading.
"""

from __future__ import annotations

import pandas as pd
import pytest

from src.processing.promise_classifier import (
    VALID_DOMAINS,
    _predict_with_keywords,
    classify_promises,
)


# ---------------------------------------------------------------------------
# 1. Domain validity
# ---------------------------------------------------------------------------

class TestValidDomains:
    def test_valid_domains_non_empty(self):
        assert len(VALID_DOMAINS) == 9

    def test_otro_in_valid_domains(self):
        assert "otro" in VALID_DOMAINS

    def test_all_9_expected_domains_present(self):
        expected = {
            "educacion", "salud", "seguridad", "economia",
            "infraestructura", "medio_ambiente", "justicia", "social", "otro",
        }
        assert expected == VALID_DOMAINS


# ---------------------------------------------------------------------------
# 2. Keyword fallback
# ---------------------------------------------------------------------------

class TestKeywordFallback:
    def test_education_keyword_detected(self):
        texts = ["Garantizaremos acceso a la educación pública y universidades."]
        domains, confs = _predict_with_keywords(texts)
        assert domains[0] == "educacion"

    def test_health_keyword_detected(self):
        texts = ["Crearemos hospitales en zonas rurales para mejorar la salud."]
        domains, confs = _predict_with_keywords(texts)
        assert domains[0] == "salud"

    def test_unrecognized_text_returns_otro(self):
        texts = ["Texto completamente genérico sin palabras clave específicas xyzzy."]
        domains, confs = _predict_with_keywords(texts)
        assert domains[0] == "otro"

    def test_confidence_in_range(self):
        texts = ["Educación gratuita para todos.", "Texto sin tema claro."]
        domains, confs = _predict_with_keywords(texts)
        for c in confs:
            assert 0.0 <= c <= 1.0

    def test_returns_correct_length(self):
        texts = ["Texto A", "Texto B", "Texto C"]
        domains, confs = _predict_with_keywords(texts)
        assert len(domains) == 3
        assert len(confs) == 3


# ---------------------------------------------------------------------------
# 3. classify_promises integration (keyword fallback path)
# ---------------------------------------------------------------------------

class TestClassifyPromises:
    def _make_df(self):
        return pd.DataFrame({
            "promise_id":        ["p_1", "p_2", "p_3"],
            "promise_text_clean": [
                "Garantizaremos educación gratuita en universidades públicas.",
                "Crearemos hospitales en municipios rurales.",
                "Texto genérico sin palabras clave.",
            ],
            "domain":             ["", "", ""],
            "domain_confidence":  [0.0, 0.0, 0.0],
        })

    def test_classify_fills_domain_column(self):
        df = classify_promises(self._make_df())
        assert (df["domain"] != "").all()

    def test_classified_domains_are_valid(self):
        df = classify_promises(self._make_df())
        for d in df["domain"]:
            assert d in VALID_DOMAINS

    def test_empty_df_returns_empty_df(self):
        result = classify_promises(pd.DataFrame())
        assert result.empty
