"""
edge_builder.py — Builds NetworkEdge dicts with full evidence chains.

Each edge represents an entity↔provider contracting relationship and
includes:
  - type and human-readable description
  - confidence score (via relation_scorer)
  - evidence object with source URL and algorithm used
  - risk statistics

All output is plain dicts (JSON-serializable for FastAPI).
"""

from __future__ import annotations

import hashlib
from datetime import datetime, UTC
from typing import Any

import pandas as pd

from src.processing.node_builder import make_node_id, _format_cop
from src.processing.relation_scorer import score_edge_row, RelationScore
from src.utils.logger import get_logger

log = get_logger(__name__)

SECOP_BASE_URL = "https://www.datos.gov.co/resource/jbjy-vk9h.json"


# -----------------------------------------------------------------
# Edge ID
# -----------------------------------------------------------------

def make_edge_id(entity_id: str, provider_id: str, edge_type: str = "contrato-proveedor") -> str:
    raw = f"{entity_id}::{provider_id}::{edge_type}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()[:16]


# -----------------------------------------------------------------
# Evidence builder
# -----------------------------------------------------------------

def build_evidence(
    row: dict,
    score: RelationScore,
    secop_urls: list[str],
    lang: str = "es",
) -> dict[str, Any]:
    """Build the evidence dict for one edge."""
    best_url = secop_urls[0] if secop_urls else SECOP_BASE_URL
    count = int(row.get("contract_count") or 1)
    doc_label = (
        f"{count} contrato{'s' if count > 1 else ''} en SECOP II"
        if lang == "es"
        else f"{count} contract{'s' if count > 1 else ''} in SECOP II"
    )

    return {
        "sourceType": "SECOP_II",
        "sourceUrl": best_url,
        "sourceDocument": doc_label,
        "sourceDate": str(row.get("date_max") or ""),
        "algorithm": score.algorithm,
        "confidence": score.confidence,
        "confidenceBand": score.confidence_band,
        "confidenceLabel": score.confidence_label_es,
        "explanation": score.explanation,
        "extractedData": {
            "contractValue": float(row.get("total_monto") or 0),
            "entity": str(row.get("nombre_entidad") or ""),
            "contractor": str(row.get("proveedor_adjudicado") or ""),
            "modality": str(row.get("modalidad_mode") or ""),
            "department": str(row.get("departamento_mode") or ""),
        },
    }


# -----------------------------------------------------------------
# Type description (natural language)
# -----------------------------------------------------------------

def build_type_description(row: dict, lang: str, score: RelationScore) -> str:
    monto_label = _format_cop(float(row.get("total_monto") or 0), lang)
    count = int(row.get("contract_count") or 1)
    entity = str(row.get("nombre_entidad") or "")
    provider = str(row.get("proveedor_adjudicado") or "")
    plural_s = "s" if count > 1 else ""
    if lang == "es":
        return (
            f"{provider} recibió {count} contrato{plural_s} "
            f"de {entity} por un total de {monto_label}."
        )
    return (
        f"{provider} received {count} contract{plural_s} "
        f"from {entity} totaling {monto_label}."
    )


# -----------------------------------------------------------------
# Main builder
# -----------------------------------------------------------------

def build_edges_with_evidence(
    edge_agg: pd.DataFrame,
    lang: str = "es",
) -> list[dict[str, Any]]:
    """
    Build edge dicts with evidence from the aggregated DataFrame.

    Parameters
    ----------
    edge_agg:
        DataFrame output from graph_builder groupby.
    lang:
        Language for labels ("es" | "en").

    Returns
    -------
    List of edge dicts (JSON-serializable).
    """
    edges: list[dict[str, Any]] = []
    detected_at = datetime.now(UTC).isoformat()

    for _, row in edge_agg.iterrows():
        row_dict = row.to_dict()
        score = score_edge_row(row_dict)

        entity_id = make_node_id(str(row_dict.get("nombre_entidad") or ""))
        provider_id = make_node_id(str(row_dict.get("proveedor_adjudicado") or ""))
        edge_id = make_edge_id(entity_id, provider_id)

        secop_urls = row_dict.get("secop_urls") or []
        if not isinstance(secop_urls, list):
            secop_urls = []

        evidence = build_evidence(row_dict, score, secop_urls, lang)

        # Date range as dict
        date_min = str(row_dict.get("date_min") or "")[:10]
        date_max = str(row_dict.get("date_max") or "")[:10]

        edges.append({
            "id": edge_id,
            "source": entity_id,
            "target": provider_id,
            "type": "contrato-proveedor",
            "typeLabel": "Contrato público" if lang == "es" else "Public contract",
            "typeDescription": build_type_description(row_dict, lang, score),
            "confidence": score.confidence,
            "confidenceBand": score.confidence_band,
            "confidenceLabel": score.confidence_label_es,
            "total_monto": float(row_dict.get("total_monto") or 0),
            "total_monto_label": _format_cop(float(row_dict.get("total_monto") or 0), lang),
            "contract_count": int(row_dict.get("contract_count") or 0),
            "modalidad": str(row_dict.get("modalidad_mode") or ""),
            "departamento": str(row_dict.get("departamento_mode") or ""),
            "date_range": {"from": date_min, "to": date_max},
            "risk_mean": round(float(row_dict.get("risk_mean") or 0), 3),
            "risk_max": round(float(row_dict.get("risk_max") or 0), 3),
            "evidence": [evidence],
            "detectedAt": detected_at,
        })

    log.debug("edge_builder: built %d edges", len(edges))
    return edges
