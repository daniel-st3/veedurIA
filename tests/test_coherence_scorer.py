"""
Tests for src/processing/coherence_scorer.py

All tests use synthetic DataFrames and mock encode_texts — zero real network calls.
"""

from __future__ import annotations

from unittest.mock import patch

import numpy as np
import pandas as pd
import pytest

from src.processing.coherence_scorer import (
    SIMILARITY_FULFILLED,
    SIMILARITY_IN_PROGRESS,
    SIMILARITY_MIN_CANDIDATE,
    STATUS_FULFILLED,
    STATUS_IN_PROGRESS,
    STATUS_NO_ACTION,
    _add_politician_aggregate,
    assign_status,
    score_coherence,
)


# ---------------------------------------------------------------------------
# 1. assign_status — threshold boundary tests
# ---------------------------------------------------------------------------

class TestAssignStatus:
    def test_exactly_fulfilled_threshold(self):
        status, conf = assign_status(SIMILARITY_FULFILLED)
        assert status == STATUS_FULFILLED

    def test_above_fulfilled(self):
        status, conf = assign_status(0.95)
        assert status == STATUS_FULFILLED
        assert 0.0 <= conf <= 1.0

    def test_just_below_fulfilled(self):
        status, conf = assign_status(SIMILARITY_FULFILLED - 0.001)
        assert status == STATUS_IN_PROGRESS

    def test_exactly_in_progress_threshold(self):
        status, conf = assign_status(SIMILARITY_IN_PROGRESS)
        assert status == STATUS_IN_PROGRESS

    def test_just_below_in_progress(self):
        status, conf = assign_status(SIMILARITY_IN_PROGRESS - 0.001)
        assert status == STATUS_NO_ACTION

    def test_zero_similarity(self):
        status, conf = assign_status(0.0)
        assert status == STATUS_NO_ACTION

    def test_perfect_similarity(self):
        status, conf = assign_status(1.0)
        assert status == STATUS_FULFILLED
        assert conf <= 1.0

    def test_confidence_is_float_between_0_and_1(self):
        for sim in [0.0, 0.3, 0.45, 0.72, 0.9, 1.0]:
            _, conf = assign_status(sim)
            assert 0.0 <= conf <= 1.0, f"conf={conf} out of bounds for sim={sim}"


# ---------------------------------------------------------------------------
# 2. score_coherence — integration with mocked embeddings
# ---------------------------------------------------------------------------

def _make_promises(n=3) -> pd.DataFrame:
    return pd.DataFrame({
        "promise_id":            [f"p_{i}" for i in range(n)],
        "politician_id":         ["pol_001"] * n,
        "promise_text_clean":    [f"Promesa {i} de gobierno" for i in range(n)],
        "domain":                ["educacion", "salud", "economia"][:n],
        "extraction_confidence": [0.8] * n,
        "election_year":         [2026] * n,
    })


def _make_actions(n=5) -> pd.DataFrame:
    return pd.DataFrame({
        "action_id":           [f"a_{i}" for i in range(n)],
        "action_text_clean":   [f"Ley de acción {i}" for i in range(n)],
        "domain_hint":         ["educacion", "salud", "economia", "otro", ""][:n],
        "action_date":         ["2025-01-01"] * n,
    })


class TestScoreCoherence:
    def test_returns_dataframe_with_schema(self):
        df_p = _make_promises(3)
        df_a = _make_actions(5)

        # Mock embeddings: 3×4 and 5×4 (small dim for test)
        p_embs = np.random.rand(3, 4).astype(np.float32)
        a_embs = np.random.rand(5, 4).astype(np.float32)
        # L2 normalize
        p_embs /= np.linalg.norm(p_embs, axis=1, keepdims=True)
        a_embs /= np.linalg.norm(a_embs, axis=1, keepdims=True)

        with patch("src.processing.coherence_scorer.encode_texts") as mock_enc:
            mock_enc.side_effect = [p_embs, a_embs]
            df_c = score_coherence(df_p, df_a)

        assert isinstance(df_c, pd.DataFrame)
        required = {
            "promise_id", "action_id", "politician_id",
            "status", "similarity_score", "politician_coherence_score",
        }
        for col in required:
            assert col in df_c.columns

    def test_no_actions_all_no_action_status(self):
        df_p = _make_promises(2)
        df_a = pd.DataFrame()

        p_embs = np.random.rand(2, 4).astype(np.float32)
        with patch("src.processing.coherence_scorer.encode_texts", return_value=p_embs):
            df_c = score_coherence(df_p, df_a)

        assert all(df_c["status"] == STATUS_NO_ACTION)

    def test_empty_promises_returns_empty_df(self):
        df_c = score_coherence(pd.DataFrame(), pd.DataFrame())
        assert df_c.empty

    def test_similarity_score_in_range(self):
        df_p = _make_promises(2)
        df_a = _make_actions(3)

        p_embs = np.eye(4)[:2].astype(np.float32)
        a_embs = np.eye(4)[:3].astype(np.float32)

        with patch("src.processing.coherence_scorer.encode_texts") as mock_enc:
            mock_enc.side_effect = [p_embs, a_embs]
            df_c = score_coherence(df_p, df_a)

        for val in df_c["similarity_score"]:
            assert 0.0 <= float(val) <= 1.0


# ---------------------------------------------------------------------------
# 3. Politician aggregate score
# ---------------------------------------------------------------------------

class TestPoliticianAggregate:
    def _base_coherence_df(self) -> pd.DataFrame:
        return pd.DataFrame({
            "coherence_id":              ["c_1", "c_2", "c_3", "c_4"],
            "promise_id":                ["p_1", "p_2", "p_3", "p_4"],
            "action_id":                 ["a_1", "NONE", "a_3", "a_4"],
            "politician_id":             ["pol_001"] * 4,
            "domain":                    ["educacion", "salud", "educacion", "economia"],
            "similarity_score":          [0.8, 0.0, 0.75, 0.5],
            "status":                    [STATUS_FULFILLED, STATUS_NO_ACTION,
                                          STATUS_FULFILLED, STATUS_IN_PROGRESS],
            "status_confidence":         [0.9, 1.0, 0.9, 0.5],
            "politician_coherence_score": [0.0] * 4,
            "evidence_snippet":          ["", "", "", ""],
            "election_year":             [2026] * 4,
            "scored_at":                 ["2026-01-01T00:00:00+00:00"] * 4,
        })

    def test_aggregate_excludes_none_matches(self):
        df = self._base_coherence_df()
        result = _add_politician_aggregate(df)
        # promise p_2 (NONE) should be excluded; aggregate should be > 0
        score = float(result["politician_coherence_score"].iloc[0])
        assert score > 0.0

    def test_aggregate_in_range_0_to_1(self):
        df = self._base_coherence_df()
        result = _add_politician_aggregate(df)
        scores = result["politician_coherence_score"].astype(float)
        assert (scores >= 0.0).all() and (scores <= 1.0).all()

    def test_all_none_matches_gives_zero_aggregate(self):
        df = self._base_coherence_df()
        df["action_id"] = "NONE"
        df["similarity_score"] = 0.0
        result = _add_politician_aggregate(df)
        assert float(result["politician_coherence_score"].iloc[0]) == 0.0
