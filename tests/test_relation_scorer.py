"""
Unit tests for src/processing/relation_scorer.py

These tests verify the confidence scoring ladder in isolation.
No I/O, no DataFrame dependencies — pure function tests.
"""

import pytest

from src.processing.relation_scorer import (
    RelationScore,
    score_contract_relation,
    CONFIDENCE_BY_ALGORITHM,
)


# ---------------------------------------------------------------------------
# Exact NIT path (highest confidence)
# ---------------------------------------------------------------------------

def test_exact_nit_returns_100():
    score = score_contract_relation(
        entity_nit="900123456",
        provider_nit="800987654",
        entity_name="MINISTERIO DE DEFENSA",
        provider_name="EMPRESA XYZ S.A.S.",
        contract_count=5,
        departamento="BOGOTA D.C.",
        match_confidence="exact_nit",
    )
    assert score.confidence == 100
    assert score.algorithm == "exact_match_nit"
    assert score.confidence_band == "high"


def test_exact_nit_short_provider_nit_does_not_trigger():
    """Short NIT strings (< 6 chars) should NOT trigger exact_match_nit."""
    score = score_contract_relation(
        entity_nit="900123456",
        provider_nit="123",          # too short
        entity_name="ENTIDAD",
        provider_name="PROVEEDOR",
        contract_count=5,
        departamento="ANTIOQUIA",
        match_confidence="exact_nit",
    )
    # Falls through to exact_match_name or name_plus_dept
    assert score.algorithm != "exact_match_nit"
    assert score.confidence < 100


# ---------------------------------------------------------------------------
# Name-based paths
# ---------------------------------------------------------------------------

def test_exact_name_with_department_returns_name_plus_dept():
    score = score_contract_relation(
        entity_nit="900123456",
        provider_nit=None,
        entity_name="INSTITUTO NACIONAL DE VÍAS",
        provider_name="CONSTRUCTORA ABC S.A.",
        contract_count=3,
        departamento="CUNDINAMARCA",
        match_confidence="exact_nit",
    )
    assert score.algorithm == "name_plus_dept"
    assert score.confidence == 80
    assert "CUNDINAMARCA" in score.explanation


def test_exact_name_without_department_returns_exact_match_name():
    score = score_contract_relation(
        entity_nit="900123456",
        provider_nit=None,
        entity_name="ICBF",
        provider_name="EMPRESA SOCIAL S.A.S.",
        contract_count=2,
        departamento="",           # empty departamento
        match_confidence="exact_nit",
    )
    assert score.algorithm == "exact_match_name"
    assert score.confidence == 90


def test_fuzzy_name_with_department():
    score = score_contract_relation(
        entity_nit=None,
        provider_nit=None,
        entity_name="MINISTERIO DE SALUD",
        provider_name="FARMACEUTICA DEL SUR",
        contract_count=4,
        departamento="VALLE DEL CAUCA",
        match_confidence="fuzzy_name",
    )
    # name_plus_dept applies (70 = 80-10 for fuzzy)
    assert score.algorithm == "name_plus_dept"
    assert score.confidence == 70


def test_fuzzy_name_without_department():
    score = score_contract_relation(
        entity_nit=None,
        provider_nit=None,
        entity_name="SENA",
        provider_name="CAPACITACIONES XYZ",
        contract_count=1,
        departamento="",
        match_confidence="fuzzy_name",
    )
    assert score.algorithm == "fuzzy_match_name"
    assert score.confidence == 50
    assert score.confidence_band == "low"


# ---------------------------------------------------------------------------
# Pattern repetition / inferred paths
# ---------------------------------------------------------------------------

def test_pattern_repetition_three_or_more_contracts():
    score = score_contract_relation(
        entity_nit=None,
        provider_nit=None,
        entity_name="ALCALDIA DE BOGOTA",
        provider_name="PROVEEDOR ANONIMO SAS",
        contract_count=3,
        departamento="",
        match_confidence="no_match",
    )
    assert score.algorithm == "pattern_repetition"
    assert score.confidence == 40
    assert score.confidence_band == "low"


def test_pattern_weak_for_one_or_two_contracts():
    score = score_contract_relation(
        entity_nit=None,
        provider_nit=None,
        entity_name="ENTIDAD X",
        provider_name="PROVEEDOR Y",
        contract_count=2,
        departamento="",
        match_confidence="no_match",
    )
    assert score.algorithm == "pattern_weak"
    assert score.confidence == 35


def test_empty_names_return_pattern_weak():
    score = score_contract_relation(
        entity_nit=None,
        provider_nit=None,
        entity_name="",
        provider_name="",
        contract_count=10,
        departamento="BOGOTA",
        match_confidence="exact_nit",
    )
    assert score.algorithm == "pattern_weak"


# ---------------------------------------------------------------------------
# confidence_band property
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("confidence,expected_band", [
    (100, "high"),
    (80,  "high"),
    (79,  "medium"),
    (60,  "medium"),
    (59,  "low"),
    (0,   "low"),
])
def test_confidence_band_thresholds(confidence: int, expected_band: str):
    score = RelationScore(
        algorithm="exact_match_nit",
        confidence=confidence,
        explanation="test",
    )
    assert score.confidence_band == expected_band


# ---------------------------------------------------------------------------
# All algorithms present in CONFIDENCE_MAP
# ---------------------------------------------------------------------------

def test_all_algorithms_have_confidence_scores():
    from src.processing.relation_scorer import AlgorithmType
    # Verify no algorithm is missing from the map
    expected = {"exact_match_nit", "exact_match_name", "name_plus_dept",
                "fuzzy_match_name", "pattern_repetition", "pattern_weak"}
    assert set(CONFIDENCE_BY_ALGORITHM.keys()) == expected


def test_confidence_values_in_valid_range():
    for alg, conf in CONFIDENCE_BY_ALGORITHM.items():
        assert 0 <= conf <= 100, f"{alg} has out-of-range confidence {conf}"
