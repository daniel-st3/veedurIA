"""
node_builder.py — Builds NetworkNode dicts from aggregated edge DataFrames.

Takes the output of the edge aggregation groupby and computes per-node metrics:
  - degree (distinct connections)
  - total_value (sum of all contract values)
  - herfindahl index (for entities only)
  - mean/max risk scores
  - stable node IDs via MD5

All output is plain dicts (JSON-serializable, no dataclasses needed for FastAPI).
"""

from __future__ import annotations

import hashlib
from typing import Any

import pandas as pd

from src.utils.logger import get_logger

log = get_logger(__name__)

# -----------------------------------------------------------------
# Node ID generation
# -----------------------------------------------------------------

def make_node_id(label: str) -> str:
    """
    Stable, deterministic node ID from display label.
    Uses MD5 (not security-sensitive, just for stable short IDs).
    """
    return hashlib.md5(label.upper().strip().encode("utf-8")).hexdigest()[:12]


# -----------------------------------------------------------------
# Herfindahl-Hirschman Index
# -----------------------------------------------------------------

def compute_herfindahl(provider_values: list[float], entity_total: float) -> float:
    """
    HHI = sum of (provider_share)^2.
    Range: 0 (perfectly dispersed) → 1 (single supplier monopoly).

    Returns 0.0 if entity_total is zero or list is empty.
    """
    if not provider_values or entity_total <= 0:
        return 0.0
    return sum((v / entity_total) ** 2 for v in provider_values)


def herfindahl_label(hhi: float) -> str:
    if hhi >= 0.7:
        return f"Concentración crítica ({hhi:.2f})"
    if hhi >= 0.4:
        return f"Alta concentración ({hhi:.2f})"
    if hhi >= 0.2:
        return f"Concentración moderada ({hhi:.2f})"
    return f"Gasto disperso ({hhi:.2f})"


# -----------------------------------------------------------------
# Main builder
# -----------------------------------------------------------------

def build_nodes(edge_agg: pd.DataFrame, lang: str = "es") -> list[dict[str, Any]]:
    """
    Build node dicts from the aggregated edge DataFrame.

    Parameters
    ----------
    edge_agg:
        DataFrame with columns:
          nombre_entidad, nit_entidad, proveedor_adjudicado,
          total_monto, contract_count, risk_mean, risk_max,
          departamento_mode
    lang:
        Language for labels ("es" | "en").

    Returns
    -------
    List of node dicts (JSON-serializable).
    """
    nodes: dict[str, dict[str, Any]] = {}

    # --- Entity nodes ---
    entity_groups = edge_agg.groupby("nombre_entidad")
    for entity_name, group in entity_groups:
        node_id = make_node_id(str(entity_name))
        entity_total = float(group["total_monto"].sum())
        provider_values = group["total_monto"].tolist()
        hhi = compute_herfindahl(provider_values, entity_total)
        degree = len(group)

        nit = (
            group["nit_entidad"].dropna().iloc[0]
            if not group["nit_entidad"].dropna().empty
            else None
        )
        department = (
            group["departamento_mode"].mode().iloc[0]
            if not group["departamento_mode"].empty
            else None
        )

        nodes[node_id] = {
            "id": node_id,
            "label": str(entity_name),
            "type": "entity",
            "typeLabel": "Entidad pública" if lang == "es" else "Public entity",
            "degree": degree,
            "total_value": entity_total,
            "total_value_label": _format_cop(entity_total, lang),
            "mean_risk": float(group["risk_mean"].mean()) if "risk_mean" in group else 0.0,
            "max_risk": float(group["risk_max"].max()) if "risk_max" in group else 0.0,
            "herfindahl": round(hhi, 4),
            "herfindahl_label": herfindahl_label(hhi),
            "is_hub": False,  # will be set by network_service based on ranking
            "department": str(department) if department else None,
            "nit": str(nit) if nit else None,
            "connection_count": degree,
            "cluster_id": None,
        }

    # --- Provider nodes ---
    provider_groups = edge_agg.groupby("proveedor_adjudicado")
    for provider_name, group in provider_groups:
        node_id = make_node_id(str(provider_name))
        provider_total = float(group["total_monto"].sum())
        degree = len(group)

        nodes[node_id] = {
            "id": node_id,
            "label": str(provider_name),
            "type": "provider",
            "typeLabel": "Proveedor" if lang == "es" else "Provider",
            "degree": degree,
            "total_value": provider_total,
            "total_value_label": _format_cop(provider_total, lang),
            "mean_risk": float(group["risk_mean"].mean()) if "risk_mean" in group else 0.0,
            "max_risk": float(group["risk_max"].max()) if "risk_max" in group else 0.0,
            "herfindahl": None,
            "herfindahl_label": "",
            "is_hub": False,
            "department": None,
            "nit": None,
            "connection_count": degree,
            "cluster_id": None,
        }

    log.debug("node_builder: built %d entity + %d provider nodes",
              sum(1 for n in nodes.values() if n["type"] == "entity"),
              sum(1 for n in nodes.values() if n["type"] == "provider"))

    return list(nodes.values())


# -----------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------

def _format_cop(value: float, lang: str = "es") -> str:
    """Compact COP formatting: 1_200_000_000 → '$1.2B COP'."""
    if value >= 1e12:
        return f"${value / 1e12:.1f}{'B' if lang == 'en' else 'B'} COP"
    if value >= 1e9:
        return f"${value / 1e9:.1f}MM COP"
    if value >= 1e6:
        return f"${value / 1e6:.0f}M COP"
    return f"${value:,.0f} COP"
