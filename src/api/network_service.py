"""
network_service.py — Assembles FastAPI-ready payloads from the network graph.

All public functions return plain dicts (FastAPI serializes to JSON automatically).
No business logic lives here — this layer only selects, filters, and shapes data
from graph_builder.

Functions:
  get_overview_payload(lang, limit, department, min_confidence)
  get_search_payload(query, lang, min_confidence)
  get_expand_payload(node_id, lang, min_confidence)
  get_node_detail_payload(node_id, lang)
  get_version_payload()
  record_error_report(report_body)
"""

from __future__ import annotations

import json
import os
from datetime import datetime, UTC
from typing import Any

from src.processing.graph_builder import (
    build_network_graph,
    current_cache_key,
    get_stored_version,
    DATA_PROCESSED,
)
from src.utils.logger import get_logger

log = get_logger(__name__)

MAX_NODES = 260
EXPAND_LIMIT = 24
ERROR_REPORTS_PATH = os.path.join(DATA_PROCESSED, "error_reports.jsonl")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_graph(lang: str = "es") -> dict[str, Any]:
    return build_network_graph(current_cache_key(), lang)


def _build_meta(
    graph: dict[str, Any],
    lang: str,
    department_filter: str | None,
    min_confidence: int,
    source: str = "live",
) -> dict[str, Any]:
    return {
        "lang": lang,
        "version": graph.get("version", "unknown"),
        "total_nodes": len(graph.get("nodes", [])),
        "total_edges": len(graph.get("edges", [])),
        "total_value": graph.get("total_value", 0.0),
        "department_filter": department_filter,
        "built_at": graph.get("built_at", ""),
        "source": graph.get("source", source),
        "confidence_filter": min_confidence,
        "partial": graph.get("partial", False),
    }


def _filter_edges(edges: list[dict], min_confidence: int) -> list[dict]:
    return [e for e in edges if e.get("confidence", 0) >= min_confidence]


def _filter_by_dept(edges: list[dict], department: str | None) -> list[dict]:
    if not department:
        return edges
    dept_upper = department.upper().strip()
    return [e for e in edges if dept_upper in (e.get("departamento") or "").upper()]


def _prune_to_max(nodes: list[dict], edges: list[dict], max_n: int) -> tuple[list[dict], list[dict]]:
    """Ensure total node count ≤ max_n, dropping lowest-degree non-hub nodes first."""
    if len(nodes) <= max_n:
        return nodes, edges
    # Keep all hubs
    hubs = [n for n in nodes if n.get("is_hub")]
    non_hubs = sorted(
        [n for n in nodes if not n.get("is_hub")],
        key=lambda n: n.get("degree", 0),
        reverse=True,
    )
    allowed_non_hubs = max_n - len(hubs)
    kept = hubs + non_hubs[:max(0, allowed_non_hubs)]
    kept_ids = {n["id"] for n in kept}
    pruned_edges = [e for e in edges if e["source"] in kept_ids and e["target"] in kept_ids]
    return kept, pruned_edges


def _nodes_by_id(nodes: list[dict]) -> dict[str, dict]:
    return {n["id"]: n for n in nodes}


def _edges_touching(node_id: str, edges: list[dict]) -> list[dict]:
    return [e for e in edges if e["source"] == node_id or e["target"] == node_id]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_overview_payload(
    lang: str = "es",
    limit: int = 48,
    department: str | None = None,
    min_confidence: int = 40,
) -> dict[str, Any]:
    """
    Return the top `limit` entity hubs with their connected providers.
    Never exceeds MAX_NODES total.
    """
    graph = _get_graph(lang)
    all_nodes = graph.get("nodes", [])
    all_edges = graph.get("edges", [])

    # Filter edges by confidence and department
    edges = _filter_edges(all_edges, min_confidence)
    if department:
        edges = _filter_by_dept(edges, department)

    # Find entity nodes that appear in remaining edges
    active_entity_ids = {e["source"] for e in edges}
    entity_nodes = [
        n for n in all_nodes
        if n.get("type") == "entity" and n["id"] in active_entity_ids
    ]

    # Sort entities by total_value desc, take top limit
    entity_nodes.sort(key=lambda n: n.get("total_value", 0), reverse=True)
    top_entities = entity_nodes[:limit]
    for n in top_entities:
        n = dict(n)  # don't mutate cached objects
    top_entity_ids = {n["id"] for n in top_entities}

    # Mark as hub
    node_by_id = _nodes_by_id(all_nodes)
    hub_nodes = []
    for n in top_entities:
        node_copy = dict(n)
        node_copy["is_hub"] = True
        hub_nodes.append(node_copy)

    # Edges that connect to top entities
    hub_edges = [e for e in edges if e["source"] in top_entity_ids]

    # Collect provider nodes that appear in those edges
    provider_ids = {e["target"] for e in hub_edges}
    provider_nodes = [n for n in all_nodes if n["id"] in provider_ids]

    # Combine and prune
    combined_nodes = hub_nodes + provider_nodes
    combined_nodes, hub_edges = _prune_to_max(combined_nodes, hub_edges, MAX_NODES)

    return {
        "meta": _build_meta(graph, lang, department, min_confidence),
        "nodes": combined_nodes,
        "edges": hub_edges,
    }


def get_search_payload(
    query: str,
    lang: str = "es",
    min_confidence: int = 40,
) -> dict[str, Any]:
    """
    Return ego-network centered on the best matching node for `query`.
    Searches both entity and provider names via substring match.
    """
    if not query or not query.strip():
        return get_overview_payload(lang=lang, min_confidence=min_confidence)

    graph = _get_graph(lang)
    all_nodes = graph.get("nodes", [])
    all_edges = graph.get("edges", [])

    q = query.upper().strip()

    # Find matching nodes (substring, both types)
    matches = [n for n in all_nodes if q in n.get("label", "").upper()]
    if not matches:
        return {
            "meta": {**_build_meta(graph, lang, None, min_confidence), "query": query, "found": False},
            "nodes": [],
            "edges": [],
        }

    # Take best match by total_value
    best = max(matches, key=lambda n: n.get("total_value", 0))
    best_copy = dict(best)
    best_copy["is_hub"] = True

    # Ego-network: best node + all its neighbors
    ego_edges = _filter_edges(_edges_touching(best["id"], all_edges), min_confidence)
    neighbor_ids = {
        e["target"] if e["source"] == best["id"] else e["source"]
        for e in ego_edges
    }
    neighbor_nodes = [n for n in all_nodes if n["id"] in neighbor_ids]

    combined_nodes = [best_copy] + neighbor_nodes
    combined_nodes, ego_edges = _prune_to_max(combined_nodes, ego_edges, MAX_NODES)

    return {
        "meta": {
            **_build_meta(graph, lang, None, min_confidence),
            "query": query,
            "found": True,
            "match_label": best["label"],
            "match_type": best["type"],
        },
        "nodes": combined_nodes,
        "edges": ego_edges,
    }


def get_expand_payload(
    node_id: str,
    lang: str = "es",
    min_confidence: int = 40,
) -> dict[str, Any]:
    """
    Return next-level neighbors of node_id, capped at EXPAND_LIMIT new nodes.
    """
    graph = _get_graph(lang)
    all_nodes = graph.get("nodes", [])
    all_edges = graph.get("edges", [])

    node_by_id = _nodes_by_id(all_nodes)
    if node_id not in node_by_id:
        return {"meta": _build_meta(graph, lang, None, min_confidence), "nodes": [], "edges": []}

    node = node_by_id[node_id]
    touching = _filter_edges(_edges_touching(node_id, all_edges), min_confidence)

    neighbor_ids = {
        e["target"] if e["source"] == node_id else e["source"]
        for e in touching
    }
    # Cap at EXPAND_LIMIT
    neighbor_ids = set(list(neighbor_ids)[:EXPAND_LIMIT])
    neighbor_nodes = [node_by_id[nid] for nid in neighbor_ids if nid in node_by_id]
    expansion_edges = [
        e for e in touching
        if (e["target"] in neighbor_ids or e["source"] in neighbor_ids)
    ]

    return {
        "meta": {
            **_build_meta(graph, lang, None, min_confidence),
            "expanded_node": node_id,
            "new_neighbors": len(neighbor_nodes),
        },
        "nodes": [dict(node)] + neighbor_nodes,
        "edges": expansion_edges,
    }


def get_node_detail_payload(node_id: str, lang: str = "es") -> dict[str, Any]:
    """
    Return full stats for a single node (for the right panel).
    """
    graph = _get_graph(lang)
    all_nodes = graph.get("nodes", [])
    all_edges = graph.get("edges", [])

    node_by_id = _nodes_by_id(all_nodes)
    if node_id not in node_by_id:
        return {"found": False, "node_id": node_id}

    node = dict(node_by_id[node_id])
    touching = _edges_touching(node_id, all_edges)

    # Top connections by total_monto
    touching_sorted = sorted(touching, key=lambda e: e.get("total_monto", 0), reverse=True)
    top_connections = []
    for edge in touching_sorted[:5]:
        neighbor_id = edge["target"] if edge["source"] == node_id else edge["source"]
        neighbor = node_by_id.get(neighbor_id, {})
        top_connections.append({
            "node_id": neighbor_id,
            "label": neighbor.get("label", ""),
            "type": neighbor.get("type", ""),
            "total_monto": edge.get("total_monto", 0),
            "total_monto_label": edge.get("total_monto_label", ""),
            "contract_count": edge.get("contract_count", 0),
            "confidence": edge.get("confidence", 0),
            "edge_id": edge.get("id", ""),
        })

    # Modality breakdown
    modality_counts: dict[str, int] = {}
    for edge in touching:
        m = edge.get("modalidad") or "Sin modalidad"
        modality_counts[m] = modality_counts.get(m, 0) + edge.get("contract_count", 1)
    total_contracts = max(sum(modality_counts.values()), 1)
    modality_breakdown = [
        {
            "modalidad": m,
            "count": c,
            "share": round(c / total_contracts, 3),
        }
        for m, c in sorted(modality_counts.items(), key=lambda x: x[1], reverse=True)
    ]

    # Date range across all edges
    dates_from = [e["date_range"]["from"] for e in touching if e.get("date_range", {}).get("from")]
    dates_to = [e["date_range"]["to"] for e in touching if e.get("date_range", {}).get("to")]

    # Top contracts from evidence
    top_contracts: list[dict] = []
    for edge in touching_sorted[:10]:
        for ev in edge.get("evidence", []):
            ed = ev.get("extractedData", {})
            if ed.get("contractValue", 0) > 0:
                top_contracts.append({
                    "id": edge.get("id", ""),
                    "value": ed.get("contractValue", 0),
                    "value_label": edge.get("total_monto_label", ""),
                    "date": edge.get("date_range", {}).get("to", ""),
                    "modality": ed.get("modality", ""),
                    "department": ed.get("department", ""),
                    "secop_url": ev.get("sourceUrl", ""),
                    "risk_score": edge.get("risk_max", 0),
                })

    return {
        "found": True,
        **node,
        "top_connections": top_connections,
        "modality_breakdown": modality_breakdown,
        "date_range": {
            "from": min(dates_from) if dates_from else "",
            "to": max(dates_to) if dates_to else "",
        },
        "top_contracts": top_contracts[:5],
    }


def get_version_payload() -> dict[str, Any]:
    """Return current graph version metadata."""
    stored = get_stored_version()
    return {
        "version": stored.get("version", "none"),
        "built_at": stored.get("built_at"),
        "entity_count": stored.get("entity_count", 0),
        "provider_count": stored.get("provider_count", 0),
        "edge_count": stored.get("edge_count", 0),
        "risk_edge_count": stored.get("risk_edge_count", 0),
        "total_value": stored.get("total_value", 0.0),
    }


def record_error_report(report: dict[str, Any]) -> None:
    """Append error report to JSONL file (append-only log)."""
    report["reported_at"] = datetime.now(UTC).isoformat()
    try:
        os.makedirs(os.path.dirname(ERROR_REPORTS_PATH), exist_ok=True)
        with open(ERROR_REPORTS_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(report, ensure_ascii=False) + "\n")
        log.info("network_service: recorded error report for node_id=%s", report.get("node_id"))
    except OSError as exc:
        log.warning("network_service: could not write error report — %s", exc)
