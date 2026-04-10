"""
relation_scorer.py — Confidence scoring for entity↔provider relationships.

Determines the type and confidence score of a relationship based on the
quality of evidence available in SECOP II data.

Algorithm ladder (highest-wins):
  exact_match_nit      → 100  Both NITs present and valid
  exact_match_name     → 90   Exact name match (entity_resolution: exact_nit)
  name_plus_dept       → 80   Name + departamento verified
  fuzzy_match_name     → 50   Levenshtein ≤ 2 (entity_resolution: fuzzy_name)
  pattern_repetition   → 40   ≥3 co-occurring contracts, no NIT (inferred)
  pattern_weak         → 35   <3 contracts, no NIT (inferred)

This module has zero side effects and is fully testeable in isolation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

# -----------------------------------------------------------------
# Type aliases
# -----------------------------------------------------------------

AlgorithmType = Literal[
    "exact_match_nit",
    "exact_match_name",
    "name_plus_dept",
    "fuzzy_match_name",
    "pattern_repetition",
    "pattern_weak",
]

CONFIDENCE_BY_ALGORITHM: dict[AlgorithmType, int] = {
    "exact_match_nit": 100,
    "exact_match_name": 90,
    "name_plus_dept": 80,
    "fuzzy_match_name": 50,
    "pattern_repetition": 40,
    "pattern_weak": 35,
}

# Human-readable explanations (Spanish only — UI layer handles translation)
EXPLANATION_BY_ALGORITHM: dict[AlgorithmType, str] = {
    "exact_match_nit": "NITs verificados en registros oficiales SECOP II",
    "exact_match_name": "Nombre idéntico al registrado en SECOP II",
    "name_plus_dept": "Nombre verificado en el mismo departamento según SECOP II",
    "fuzzy_match_name": "Nombre similar al registrado (pequeña diferencia ortográfica)",
    "pattern_repetition": "Patrón repetido en SECOP II. Sin NIT del proveedor — verificar fuente original.",
    "pattern_weak": "Relación inferida por co-ocurrencia. Sin verificación directa de NIT.",
}


# -----------------------------------------------------------------
# Score dataclass
# -----------------------------------------------------------------

@dataclass(frozen=True)
class RelationScore:
    algorithm: AlgorithmType
    confidence: int          # 0–100
    explanation: str         # Human-readable rationale (Spanish)

    @property
    def confidence_band(self) -> Literal["high", "medium", "low"]:
        if self.confidence >= 80:
            return "high"
        if self.confidence >= 60:
            return "medium"
        return "low"

    @property
    def confidence_label_es(self) -> str:
        labels = {"high": "Alta confianza", "medium": "Confianza media", "low": "Relación inferida"}
        return labels[self.confidence_band]


# -----------------------------------------------------------------
# Scorer function
# -----------------------------------------------------------------

def score_contract_relation(
    entity_nit: str | None,
    provider_nit: str | None,
    entity_name: str,
    provider_name: str,
    contract_count: int,
    departamento: str,
    match_confidence: str,
) -> RelationScore:
    """
    Determine confidence score for an entity↔provider relationship.

    Parameters
    ----------
    entity_nit:
        Cleaned NIT of the public entity (9-digit zero-padded string, or None).
    provider_nit:
        Cleaned NIT of the provider, if available (rarely present in SECOP exports).
    entity_name:
        Name of the public entity (as appears in SECOP).
    provider_name:
        Name of the provider/contractor.
    contract_count:
        Number of contracts in this entity↔provider pair.
    departamento:
        Departamento associated with this relationship (mode across contracts).
    match_confidence:
        Result from entity_resolution: "exact_nit" | "fuzzy_name" | "no_match".

    Returns
    -------
    RelationScore with algorithm, confidence (0–100), and explanation.
    """
    # Guard: names must not be empty for any meaningful scoring
    if not entity_name or not provider_name:
        return _make_score("pattern_weak")

    # --- Ladder starts from highest-confidence ---

    # 1. Both NITs present and long enough to be valid Colombian NITs
    entity_nit_valid = bool(entity_nit and len(entity_nit.strip()) >= 6)
    provider_nit_valid = bool(provider_nit and len(provider_nit.strip()) >= 6)

    if entity_nit_valid and provider_nit_valid:
        return _make_score("exact_match_nit")

    # 2. Entity resolution says exact NIT (entity side verified, provider by name)
    if match_confidence == "exact_nit":
        # If departamento is also present, bump to name_plus_dept for transparency
        if departamento and departamento.strip():
            explanation = (
                f"Nombre y departamento ({departamento.strip()}) "
                f"verificados en SECOP II"
            )
            return RelationScore(
                algorithm="name_plus_dept",
                confidence=CONFIDENCE_BY_ALGORITHM["name_plus_dept"],
                explanation=explanation,
            )
        return _make_score("exact_match_name")

    # 3. Fuzzy name match from entity resolution
    if match_confidence == "fuzzy_name":
        if departamento and departamento.strip():
            explanation = (
                f"Nombre similar al registrado, en departamento {departamento.strip()} (SECOP II)"
            )
            return RelationScore(
                algorithm="name_plus_dept",
                confidence=CONFIDENCE_BY_ALGORITHM["name_plus_dept"] - 10,  # 70
                explanation=explanation,
            )
        return _make_score("fuzzy_match_name")

    # 4. Pattern repetition: co-occurrence ≥ 3 contracts → inferred but documented
    if contract_count >= 3:
        explanation = (
            f"Patrón repetido: {contract_count} contratos con esta pareja "
            f"en SECOP II. Sin NIT de proveedor — verificar fuente original."
        )
        return RelationScore(
            algorithm="pattern_repetition",
            confidence=CONFIDENCE_BY_ALGORITHM["pattern_repetition"],
            explanation=explanation,
        )

    # 5. Weak: single or dual occurrence without NIT → low confidence
    return _make_score("pattern_weak")


def _make_score(algorithm: AlgorithmType) -> RelationScore:
    """Helper to build a RelationScore from algorithm key only."""
    return RelationScore(
        algorithm=algorithm,
        confidence=CONFIDENCE_BY_ALGORITHM[algorithm],
        explanation=EXPLANATION_BY_ALGORITHM[algorithm],
    )


# -----------------------------------------------------------------
# Batch scorer for DataFrames
# -----------------------------------------------------------------

def score_edge_row(row: dict) -> RelationScore:
    """
    Score a single aggregated edge row (output of edge_builder groupby).
    Convenience wrapper for use in DataFrame.apply().
    """
    return score_contract_relation(
        entity_nit=str(row.get("nit_entidad") or ""),
        provider_nit=str(row.get("nit_proveedor") or ""),
        entity_name=str(row.get("nombre_entidad") or ""),
        provider_name=str(row.get("proveedor_adjudicado") or ""),
        contract_count=int(row.get("contract_count") or 0),
        departamento=str(row.get("departamento_mode") or ""),
        match_confidence=str(row.get("match_confidence") or "no_match"),
    )
