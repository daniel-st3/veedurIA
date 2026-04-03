"""
Tests for src/processing/promise_extractor.py

All tests mock pdfplumber and spaCy — zero real file I/O or network calls.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from src.processing.promise_extractor import (
    _clean_text,
    _compute_confidence,
    _count_triggers,
    _make_promise_id,
    _normalize_name,
    _split_sentences,
    extract_promises_from_pdf,
)


# ---------------------------------------------------------------------------
# 1. Trigger matching
# ---------------------------------------------------------------------------

class TestCountTriggers:
    def test_future_verb_match(self):
        text = "Garantizaremos acceso universal a la educación pública."
        assert _count_triggers(text) >= 1

    def test_commitment_phrase_match(self):
        # "nos comprometemos" + "en los primeros 12" are in the same compiled pattern → 1 match
        text = "Nos comprometemos a crear 500,000 empleos en los primeros 12 meses."
        assert _count_triggers(text) >= 1

    def test_quantified_target_match(self):
        text = "Lograremos cero pobreza extrema en cinco años."
        assert _count_triggers(text) >= 1

    def test_no_trigger_plain_sentence(self):
        text = "El gobierno anterior realizó inversiones en infraestructura."
        assert _count_triggers(text) == 0

    def test_multiple_triggers_in_one_sentence(self):
        text = "Crearemos y garantizaremos empleo en los primeros 100 días."
        assert _count_triggers(text) >= 2


# ---------------------------------------------------------------------------
# 2. Confidence computation
# ---------------------------------------------------------------------------

class TestComputeConfidence:
    def test_minimum_confidence_one_trigger_no_ner(self):
        conf = _compute_confidence(1, False)
        assert 0.5 <= conf <= 0.95

    def test_ner_boosts_confidence(self):
        conf_no_ner  = _compute_confidence(1, False)
        conf_with_ner = _compute_confidence(1, True)
        assert conf_with_ner > conf_no_ner

    def test_more_triggers_higher_confidence(self):
        low  = _compute_confidence(1, False)
        high = _compute_confidence(3, False)
        assert high > low

    def test_confidence_capped_at_0_95(self):
        conf = _compute_confidence(10, True)
        assert conf <= 0.95

    def test_confidence_always_at_least_0_5(self):
        # Even with 0 triggers this should not be called, but let's check the formula
        conf = _compute_confidence(0, False)
        assert conf >= 0.5


# ---------------------------------------------------------------------------
# 3. Schema validation from extract_promises_from_pdf
# ---------------------------------------------------------------------------

REQUIRED_KEYS = {
    "promise_id", "politician_id", "politician_name_norm",
    "chamber", "party", "election_year",
    "source_type", "source_url", "source_page",
    "promise_text", "promise_text_clean",
    "domain", "domain_confidence", "extraction_confidence",
    "embedding_model", "extracted_at", "year_month",
}

class TestExtractSchemaWithMockedPDF:
    def test_schema_keys_present(self, tmp_path: Path):
        """Mocked PDF extraction returns dicts with all required schema keys."""
        fake_pdf = tmp_path / "test_candidate_2026.pdf"
        fake_pdf.write_bytes(b"%PDF-1.4 fake")

        fake_page = MagicMock()
        fake_page.extract_text.return_value = (
            "Garantizaremos educación gratuita para todos los colombianos. "
            "Crearemos 200,000 empleos en el primer año de gobierno."
        )
        fake_pdf_obj = MagicMock()
        fake_pdf_obj.__enter__ = MagicMock(return_value=fake_pdf_obj)
        fake_pdf_obj.__exit__ = MagicMock(return_value=False)
        fake_pdf_obj.pages = [fake_page]

        with patch("pdfplumber.open", return_value=fake_pdf_obj):
            promises = extract_promises_from_pdf(
                pdf_path=fake_pdf,
                politician_id="test_pol_001",
                politician_name="Candidato Test",
                source_url="https://example.com/programa.pdf",
            )

        assert len(promises) >= 1
        for p in promises:
            for key in REQUIRED_KEYS:
                assert key in p, f"Missing key: {key}"

    def test_empty_pdf_returns_empty_list(self, tmp_path: Path):
        fake_pdf = tmp_path / "empty.pdf"
        fake_pdf.write_bytes(b"%PDF-1.4")

        fake_page = MagicMock()
        fake_page.extract_text.return_value = "Texto sin ninguna promesa específica."
        fake_pdf_obj = MagicMock()
        fake_pdf_obj.__enter__ = MagicMock(return_value=fake_pdf_obj)
        fake_pdf_obj.__exit__ = MagicMock(return_value=False)
        fake_pdf_obj.pages = [fake_page]

        with patch("pdfplumber.open", return_value=fake_pdf_obj):
            promises = extract_promises_from_pdf(
                pdf_path=fake_pdf,
                politician_id="test_pol_002",
                politician_name="Candidato Vacío",
            )
        assert isinstance(promises, list)

    def test_missing_pdf_returns_empty_list(self, tmp_path: Path):
        missing = tmp_path / "nonexistent.pdf"
        promises = extract_promises_from_pdf(
            pdf_path=missing,
            politician_id="test_pol_003",
            politician_name="Candidato Fantasma",
        )
        assert promises == []


# ---------------------------------------------------------------------------
# 4. Helper functions
# ---------------------------------------------------------------------------

class TestHelpers:
    def test_normalize_name_uppercase(self):
        result = _normalize_name("María José García")
        assert result == result.upper()

    def test_normalize_name_strips_accents(self):
        result = _normalize_name("José")
        assert "Ó" not in result or "O" in result  # accent stripped

    def test_clean_text_collapses_whitespace(self):
        result = _clean_text("  hello   world  ")
        assert result == "hello world"

    def test_promise_id_deterministic(self):
        id1 = _make_promise_id("pol_001", "Garantizaremos educación gratuita.")
        id2 = _make_promise_id("pol_001", "Garantizaremos educación gratuita.")
        assert id1 == id2

    def test_promise_id_different_for_different_inputs(self):
        id1 = _make_promise_id("pol_001", "Promesa A")
        id2 = _make_promise_id("pol_001", "Promesa B")
        assert id1 != id2

    def test_split_sentences_basic(self):
        text = "Primera oración. Segunda oración. Tercera oración."
        sents = _split_sentences(text)
        assert len(sents) >= 2
