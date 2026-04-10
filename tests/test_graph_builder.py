"""
Integration tests for src/processing/graph_builder.py and node/edge builders.

These tests use synthetic DataFrames (no real Parquet files needed).
They verify structure, field presence, and stability guarantees.
"""

import pandas as pd
import pytest

from src.processing.node_builder import (
    build_nodes,
    compute_herfindahl,
    make_node_id,
    herfindahl_label,
)
from src.processing.edge_builder import build_edges_with_evidence, make_edge_id
from src.processing.graph_builder import apply_clustering


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def minimal_edge_agg() -> pd.DataFrame:
    """Minimal synthetic edge aggregation DataFrame."""
    return pd.DataFrame([
        {
            "nombre_entidad": "MINISTERIO DE DEFENSA NACIONAL",
            "nit_entidad": "899999090",
            "proveedor_adjudicado": "INDUSTRIA MILITAR S.A.",
            "total_monto": 4_200_000_000.0,
            "contract_count": 12,
            "date_min": "2022-01-15",
            "date_max": "2024-06-30",
            "risk_mean": 0.62,
            "risk_max": 0.88,
            "departamento_mode": "BOGOTA D.C.",
            "modalidad_mode": "Contratación directa",
            "secop_urls": ["https://www.datos.gov.co/resource/jbjy-vk9h.json"],
            "match_confidence": "exact_nit",
        },
        {
            "nombre_entidad": "MINISTERIO DE DEFENSA NACIONAL",
            "nit_entidad": "899999090",
            "proveedor_adjudicado": "LOGISTICA NACIONAL SAS",
            "total_monto": 800_000_000.0,
            "contract_count": 5,
            "date_min": "2023-03-01",
            "date_max": "2024-01-15",
            "risk_mean": 0.40,
            "risk_max": 0.55,
            "departamento_mode": "CUNDINAMARCA",
            "modalidad_mode": "Licitación pública",
            "secop_urls": [],
            "match_confidence": "exact_nit",
        },
        {
            "nombre_entidad": "INVIAS",
            "nit_entidad": "800116ww",
            "proveedor_adjudicado": "CONSTRUCTORA ANDINA S.A.",
            "total_monto": 9_500_000_000.0,
            "contract_count": 7,
            "date_min": "2021-07-01",
            "date_max": "2023-12-31",
            "risk_mean": 0.71,
            "risk_max": 0.94,
            "departamento_mode": "ANTIOQUIA",
            "modalidad_mode": "Selección abreviada",
            "secop_urls": ["https://example.com/contract/1"],
            "match_confidence": "fuzzy_name",
        },
    ])


# ---------------------------------------------------------------------------
# node_builder tests
# ---------------------------------------------------------------------------

class TestNodeBuilder:
    def test_returns_list(self, minimal_edge_agg):
        nodes = build_nodes(minimal_edge_agg)
        assert isinstance(nodes, list)

    def test_correct_node_count(self, minimal_edge_agg):
        nodes = build_nodes(minimal_edge_agg)
        entity_labels = {"MINISTERIO DE DEFENSA NACIONAL", "INVIAS"}
        provider_labels = {"INDUSTRIA MILITAR S.A.", "LOGISTICA NACIONAL SAS", "CONSTRUCTORA ANDINA S.A."}
        all_labels = entity_labels | provider_labels
        node_labels = {n["label"] for n in nodes}
        assert entity_labels.issubset(node_labels)
        assert provider_labels.issubset(node_labels)

    def test_required_fields_present(self, minimal_edge_agg):
        nodes = build_nodes(minimal_edge_agg)
        required = {"id", "label", "type", "typeLabel", "degree", "total_value",
                    "total_value_label", "herfindahl", "connection_count"}
        for node in nodes:
            assert required.issubset(node.keys()), f"Missing fields in node {node.get('label')}"

    def test_entity_has_herfindahl(self, minimal_edge_agg):
        nodes = build_nodes(minimal_edge_agg)
        entities = [n for n in nodes if n["type"] == "entity"]
        for e in entities:
            assert e["herfindahl"] is not None
            assert 0.0 <= e["herfindahl"] <= 1.0

    def test_provider_herfindahl_is_none(self, minimal_edge_agg):
        nodes = build_nodes(minimal_edge_agg)
        providers = [n for n in nodes if n["type"] == "provider"]
        for p in providers:
            assert p["herfindahl"] is None

    def test_node_ids_are_stable(self, minimal_edge_agg):
        """Same label always produces the same node ID."""
        id1 = make_node_id("MINISTERIO DE DEFENSA NACIONAL")
        id2 = make_node_id("MINISTERIO DE DEFENSA NACIONAL")
        id3 = make_node_id("ministerio de defensa nacional")  # lowercase
        assert id1 == id2 == id3

    def test_node_id_length(self):
        assert len(make_node_id("TEST ENTITY")) == 12

    def test_entity_degree_matches_provider_count(self, minimal_edge_agg):
        nodes = build_nodes(minimal_edge_agg)
        ministerio = next(n for n in nodes if n["label"] == "MINISTERIO DE DEFENSA NACIONAL")
        # Should have 2 providers
        assert ministerio["degree"] == 2


# ---------------------------------------------------------------------------
# edge_builder tests
# ---------------------------------------------------------------------------

class TestEdgeBuilder:
    def test_returns_list(self, minimal_edge_agg):
        edges = build_edges_with_evidence(minimal_edge_agg)
        assert isinstance(edges, list)
        assert len(edges) == 3

    def test_required_fields_present(self, minimal_edge_agg):
        edges = build_edges_with_evidence(minimal_edge_agg)
        required = {"id", "source", "target", "type", "typeLabel", "typeDescription",
                    "confidence", "confidenceBand", "total_monto", "contract_count",
                    "evidence", "detectedAt"}
        for edge in edges:
            assert required.issubset(edge.keys()), f"Missing fields in edge {edge.get('id')}"

    def test_evidence_has_required_fields(self, minimal_edge_agg):
        edges = build_edges_with_evidence(minimal_edge_agg)
        for edge in edges:
            assert len(edge["evidence"]) >= 1
            ev = edge["evidence"][0]
            assert "sourceType" in ev
            assert "sourceUrl" in ev
            assert "confidence" in ev
            assert 0 <= ev["confidence"] <= 100

    def test_confidence_in_valid_range(self, minimal_edge_agg):
        edges = build_edges_with_evidence(minimal_edge_agg)
        for edge in edges:
            assert 0 <= edge["confidence"] <= 100

    def test_edge_type_is_contrato_proveedor(self, minimal_edge_agg):
        edges = build_edges_with_evidence(minimal_edge_agg)
        for edge in edges:
            assert edge["type"] == "contrato-proveedor"

    def test_source_is_entity_target_is_provider(self, minimal_edge_agg):
        """source should be entity node ID, target should be provider node ID."""
        edges = build_edges_with_evidence(minimal_edge_agg)
        entity_id = make_node_id("MINISTERIO DE DEFENSA NACIONAL")
        provider_id = make_node_id("INDUSTRIA MILITAR S.A.")
        matching = [e for e in edges if e["source"] == entity_id and e["target"] == provider_id]
        assert len(matching) == 1

    def test_type_description_is_string(self, minimal_edge_agg):
        edges = build_edges_with_evidence(minimal_edge_agg)
        for edge in edges:
            assert isinstance(edge["typeDescription"], str)
            assert len(edge["typeDescription"]) > 10


# ---------------------------------------------------------------------------
# Herfindahl tests
# ---------------------------------------------------------------------------

class TestHerfindahl:
    def test_monopoly_returns_one(self):
        hhi = compute_herfindahl([1_000_000.0], 1_000_000.0)
        assert hhi == pytest.approx(1.0)

    def test_equal_distribution_two_providers(self):
        hhi = compute_herfindahl([500.0, 500.0], 1000.0)
        assert hhi == pytest.approx(0.5)

    def test_zero_total_returns_zero(self):
        hhi = compute_herfindahl([], 0.0)
        assert hhi == 0.0

    def test_hhi_decreases_with_more_equal_providers(self):
        hhi_2 = compute_herfindahl([500.0, 500.0], 1000.0)
        hhi_4 = compute_herfindahl([250.0, 250.0, 250.0, 250.0], 1000.0)
        assert hhi_4 < hhi_2

    def test_herfindahl_label_critical(self):
        label = herfindahl_label(0.75)
        assert "crítica" in label.lower() or "concentración" in label.lower()

    def test_herfindahl_label_dispersed(self):
        label = herfindahl_label(0.10)
        assert "disperso" in label.lower()


# ---------------------------------------------------------------------------
# apply_clustering tests
# ---------------------------------------------------------------------------

class TestClustering:
    def _make_node(self, nid: str, degree: int, ntype: str = "entity") -> dict:
        return {"id": nid, "label": f"Node {nid}", "type": ntype,
                "degree": degree, "is_hub": False,
                "total_value": 1e9, "total_value_label": "$1B COP"}

    def _make_edge(self, src: str, tgt: str, dept: str = "BOGOTA") -> dict:
        return {"id": f"edge_{src}_{tgt}", "source": src, "target": tgt,
                "departamento": dept, "total_monto": 1e8, "contract_count": 3,
                "confidence": 80}

    def test_no_clustering_below_threshold(self):
        nodes = [self._make_node("A", 50)]
        edges = [self._make_edge("A", f"P{i}") for i in range(50)]
        cluster_nodes, cluster_edges = apply_clustering(nodes, edges, threshold=100)
        assert cluster_nodes == []
        assert cluster_edges == []

    def test_clustering_above_threshold(self):
        hub = self._make_node("HUB", 150)
        nodes = [hub] + [self._make_node(f"P{i}", 1, "provider") for i in range(150)]
        edges = [self._make_edge("HUB", f"P{i}", dept="ANTIOQUIA") for i in range(150)]
        cluster_nodes, cluster_edges = apply_clustering(nodes, edges, threshold=100)
        assert len(cluster_nodes) >= 1
        assert len(cluster_edges) >= 1
        # All cluster nodes should have is_cluster = True
        for cn in cluster_nodes:
            assert cn.get("is_cluster") is True

    def test_same_cache_key_produces_stable_graph(self, minimal_edge_agg):
        """build_nodes always produces same node IDs for same input."""
        nodes_1 = build_nodes(minimal_edge_agg)
        nodes_2 = build_nodes(minimal_edge_agg)
        ids_1 = {n["id"] for n in nodes_1}
        ids_2 = {n["id"] for n in nodes_2}
        assert ids_1 == ids_2
