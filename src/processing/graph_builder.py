"""
graph_builder.py — Orchestrates SECOP Parquet → NetworkGraph construction.

Responsibilities:
  1. Load all backfill Parquet files (incremental history)
  2. Normalize and aggregate entity↔provider edges
  3. Delegate node/edge building to node_builder / edge_builder
  4. Apply clustering for high-degree nodes (> config threshold)
  5. Cache result in-process with hourly invalidation
  6. Persist graph metadata to data/processed/network_graph_meta.json

Cache key = datetime.utcnow().strftime("%Y-%m-%d-%H")  (hourly TTL, no restart needed)
"""

from __future__ import annotations

import glob
import hashlib
import json
import os
from datetime import datetime, UTC
from functools import lru_cache
from typing import Any

import pandas as pd

from src.processing.node_builder import build_nodes, make_node_id
from src.processing.edge_builder import build_edges_with_evidence, make_edge_id
from src.utils.logger import get_logger

log = get_logger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_HERE = os.path.dirname(os.path.abspath(__file__))
DATA_PROCESSED = os.path.normpath(os.path.join(_HERE, "../../data/processed"))
META_PATH = os.path.join(DATA_PROCESSED, "network_graph_meta.json")

REQUIRED_COLS = [
    "nombre_entidad",
    "nit_entidad",
    "proveedor_adjudicado",
    "valor_contrato",
    "fecha_firma",
    "modalidad_de_contratacion",
    "departamento",
    "secop_url",
    "risk_score",
]

CLUSTER_THRESHOLD = 100   # nodes with more connections than this get clustered


# ---------------------------------------------------------------------------
# Empty graph sentinel
# ---------------------------------------------------------------------------

def _empty_graph(reason: str = "no data") -> dict[str, Any]:
    return {
        "nodes": [],
        "edges": [],
        "version": "empty",
        "built_at": datetime.now(UTC).isoformat(),
        "entity_count": 0,
        "provider_count": 0,
        "edge_count": 0,
        "total_value": 0.0,
        "source": "empty",
        "empty_reason": reason,
    }


# ---------------------------------------------------------------------------
# Core builder (cached)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=2)
def build_network_graph(cache_key: str, lang: str = "es") -> dict[str, Any]:
    """
    Build (or return cached) full network graph for the given cache_key.

    Parameters
    ----------
    cache_key:
        Typically datetime.utcnow().strftime("%Y-%m-%d-%H") for hourly TTL.
        Pass any unique string to bust the cache.
    lang:
        Language for display labels ("es" | "en").
    """
    log.info("graph_builder: building graph (key=%s, lang=%s)", cache_key, lang)

    # 1. Discover Parquet files
    parquet_files = sorted(
        glob.glob(os.path.join(DATA_PROCESSED, "secop_contratos_backfill_*.parquet"))
    )
    # Also include the scored contracts file if present
    scored_path = os.path.join(DATA_PROCESSED, "scored_contracts.parquet")
    if os.path.exists(scored_path) and scored_path not in parquet_files:
        parquet_files.append(scored_path)

    if not parquet_files:
        log.warning("graph_builder: no Parquet files found in %s", DATA_PROCESSED)
        return _empty_graph("no parquet files")

    # 2. Load only needed columns
    dfs: list[pd.DataFrame] = []
    for path in parquet_files:
        try:
            df_cols = pd.read_parquet(path, engine="pyarrow").columns.tolist()
            cols_to_read = [c for c in REQUIRED_COLS if c in df_cols]
            if not cols_to_read:
                continue
            dfs.append(pd.read_parquet(path, columns=cols_to_read, engine="pyarrow"))
        except Exception as exc:  # noqa: BLE001
            log.warning("graph_builder: skipping %s — %s", path, exc)

    if not dfs:
        return _empty_graph("could not read parquet columns")

    df = pd.concat(dfs, ignore_index=True)
    log.info("graph_builder: loaded %d rows from %d files", len(df), len(dfs))

    # 3. Normalize
    df["valor_num"] = (
        pd.to_numeric(
            df.get("valor_contrato", pd.Series(dtype=float))
            .astype(str)
            .str.replace(r"[^\d.]", "", regex=True),
            errors="coerce",
        ).fillna(0.0)
    )
    df = df[
        df["nombre_entidad"].notna()
        & (df["nombre_entidad"].astype(str).str.strip() != "")
    ]
    df = df[
        df["proveedor_adjudicado"].notna()
        & (df["proveedor_adjudicado"].astype(str).str.strip() != "")
    ]

    # 4. Aggregate edges
    group_cols = ["nombre_entidad", "nit_entidad", "proveedor_adjudicado"]
    # Ensure nit_entidad exists
    if "nit_entidad" not in df.columns:
        df["nit_entidad"] = None
    if "risk_score" not in df.columns:
        df["risk_score"] = 0.0

    def _safe_mode(s: pd.Series) -> str:
        mode = s.dropna()
        if mode.empty:
            return ""
        return str(mode.mode().iloc[0])

    def _safe_urls(s: pd.Series) -> list[str]:
        return list(s.dropna().unique()[:3])

    edge_agg = (
        df.groupby(group_cols, as_index=False)
        .agg(
            total_monto=("valor_num", "sum"),
            contract_count=("valor_num", "count"),
            date_min=("fecha_firma", "min"),
            date_max=("fecha_firma", "max"),
            risk_mean=("risk_score", "mean"),
            risk_max=("risk_score", "max"),
            departamento_mode=("departamento", _safe_mode),
            modalidad_mode=("modalidad_de_contratacion", _safe_mode),
            secop_urls=("secop_url", _safe_urls),
        )
    )

    # 5. Build nodes and edges
    nodes = build_nodes(edge_agg, lang=lang)
    edges = build_edges_with_evidence(edge_agg, lang=lang)

    # 6. Clustering for high-degree nodes
    cluster_nodes, cluster_edges = apply_clustering(
        nodes, edges, threshold=CLUSTER_THRESHOLD
    )
    nodes = nodes + cluster_nodes
    edges = edges + cluster_edges

    # 7. Persist metadata
    entity_count = sum(1 for n in nodes if n.get("type") == "entity")
    provider_count = sum(1 for n in nodes if n.get("type") == "provider")
    total_value = float(edge_agg["total_monto"].sum())

    risk_edge_count = sum(1 for e in edges if e.get("risk_max", 0) >= 0.70)

    meta = {
        "version": cache_key,
        "built_at": datetime.now(UTC).isoformat(),
        "entity_count": entity_count,
        "provider_count": provider_count,
        "edge_count": len(edges),
        "risk_edge_count": risk_edge_count,
        "total_value": total_value,
    }
    try:
        os.makedirs(os.path.dirname(META_PATH), exist_ok=True)
        with open(META_PATH, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)
    except OSError as exc:
        log.warning("graph_builder: could not write meta — %s", exc)

    log.info(
        "graph_builder: done — %d nodes (%d entities, %d providers), %d edges (%d risk)",
        len(nodes), entity_count, provider_count, len(edges), risk_edge_count,
    )

    return {
        "nodes": nodes,
        "edges": edges,
        "version": cache_key,
        "built_at": meta["built_at"],
        "entity_count": entity_count,
        "provider_count": provider_count,
        "edge_count": len(edges),
        "risk_edge_count": risk_edge_count,
        "total_value": total_value,
        "source": "live",
    }


# ---------------------------------------------------------------------------
# Clustering
# ---------------------------------------------------------------------------

def apply_clustering(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    threshold: int = 100,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    For nodes with degree > threshold, group their connections into
    'cluster nodes' by departamento. Reduces canvas density.

    Returns (cluster_nodes, cluster_edges) to be appended to main lists.
    """
    heavy_ids = {n["id"] for n in nodes if n.get("degree", 0) > threshold}
    if not heavy_ids:
        return [], []

    cluster_nodes: list[dict[str, Any]] = []
    cluster_edges: list[dict[str, Any]] = []

    for hub_id in heavy_ids:
        hub_edges = [e for e in edges if e["source"] == hub_id]
        by_dept: dict[str, list[dict]] = {}
        for edge in hub_edges:
            dept = edge.get("departamento") or "Sin departamento"
            by_dept.setdefault(dept, []).append(edge)

        for dept, dept_edges in by_dept.items():
            cluster_id = f"cluster_{hub_id}_{hashlib.md5(dept.encode()).hexdigest()[:6]}"
            total = sum(e.get("total_monto", 0) for e in dept_edges)
            total_contracts = sum(e.get("contract_count", 0) for e in dept_edges)

            cluster_nodes.append({
                "id": cluster_id,
                "label": f"Grupo {dept} ({len(dept_edges)} proveedores)",
                "type": "cluster",
                "typeLabel": "Grupo por departamento",
                "degree": len(dept_edges),
                "total_value": total,
                "total_value_label": f"${total / 1e9:.1f}MM COP" if total >= 1e9 else f"${total:,.0f} COP",
                "mean_risk": 0.0,
                "max_risk": 0.0,
                "herfindahl": None,
                "herfindahl_label": "",
                "is_hub": False,
                "department": dept,
                "nit": None,
                "connection_count": len(dept_edges),
                "cluster_id": cluster_id,
                "is_cluster": True,
                "cluster_hub_id": hub_id,
                "cluster_dept": dept,
            })

            cluster_edges.append({
                "id": make_edge_id(hub_id, cluster_id, "cluster-group"),
                "source": hub_id,
                "target": cluster_id,
                "type": "cluster-group",
                "typeLabel": f"Grupo {dept}",
                "typeDescription": f"{len(dept_edges)} proveedores agrupados en {dept}",
                "confidence": 100,
                "confidenceBand": "high",
                "confidenceLabel": "Grupo calculado",
                "total_monto": total,
                "total_monto_label": f"${total / 1e9:.1f}MM COP",
                "contract_count": total_contracts,
                "modalidad": "",
                "departamento": dept,
                "date_range": {"from": "", "to": ""},
                "risk_mean": 0.0,
                "risk_max": 0.0,
                "evidence": [],
                "detectedAt": datetime.now(UTC).isoformat(),
            })

    log.info("apply_clustering: created %d cluster nodes for %d heavy hubs",
             len(cluster_nodes), len(heavy_ids))
    return cluster_nodes, cluster_edges


# ---------------------------------------------------------------------------
# Helper: read stored version
# ---------------------------------------------------------------------------

def get_stored_version() -> dict[str, Any]:
    """Read the persisted graph metadata without triggering a build."""
    if not os.path.exists(META_PATH):
        return {"version": "none", "built_at": None}
    try:
        with open(META_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return {"version": "none", "built_at": None}


# ---------------------------------------------------------------------------
# Cache key helper
# ---------------------------------------------------------------------------

def current_cache_key() -> str:
    """Return the cache key for the current hour."""
    return datetime.now(UTC).strftime("%Y-%m-%d-%H")
