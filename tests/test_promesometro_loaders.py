"""
Tests for src/ui/promesometro_loaders.py

Mocks Streamlit cache, Parquet I/O, and Supabase — zero real network calls.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

# ---------------------------------------------------------------------------
# Mock streamlit before importing the loader
# ---------------------------------------------------------------------------
_st_mock = MagicMock()


def _passthrough_cache(func=None, **kwargs):
    """st.cache_data decorator that just returns the original function."""
    if func is not None:
        return func
    def decorator(f):
        return f
    return decorator


_st_mock.cache_data = _passthrough_cache
_st_mock.cache_resource = _passthrough_cache
sys.modules.setdefault("streamlit", _st_mock)

from src.ui.promesometro_loaders import (
    ACTION_UI_COLUMNS,
    COHERENCE_UI_COLUMNS,
    PROMISE_UI_COLUMNS,
    _prune_columns,
    get_coherence_kpis,
    get_politicians_list,
)


# ---------------------------------------------------------------------------
# 1. Column allowlists
# ---------------------------------------------------------------------------

class TestColumnAllowlists:
    def test_promise_columns_non_empty(self):
        assert len(PROMISE_UI_COLUMNS) >= 5

    def test_coherence_columns_non_empty(self):
        assert len(COHERENCE_UI_COLUMNS) >= 6

    def test_action_columns_non_empty(self):
        assert len(ACTION_UI_COLUMNS) >= 4

    def test_prune_columns_only_keeps_available(self):
        df = pd.DataFrame({"a": [1], "b": [2], "c": [3]})
        result = _prune_columns(df, ["a", "z"])
        assert list(result.columns) == ["a"]


# ---------------------------------------------------------------------------
# 2. get_politicians_list
# ---------------------------------------------------------------------------

class TestGetPoliticiansList:
    def _make_df(self):
        return pd.DataFrame({
            "politician_id":             ["pol_001", "pol_002", "pol_001"],
            "politician_coherence_score": [0.7, 0.5, 0.7],
            "status":                    ["con_accion_registrada"] * 3,
            "similarity_score":          [0.8, 0.5, 0.8],
        })

    def test_returns_list(self):
        result = get_politicians_list(self._make_df())
        assert isinstance(result, list)

    def test_empty_df_returns_empty_list(self):
        result = get_politicians_list(pd.DataFrame())
        assert result == []

    def test_no_duplicates(self):
        result = get_politicians_list(self._make_df())
        assert len(result) == len(set(result))


# ---------------------------------------------------------------------------
# 3. get_coherence_kpis
# ---------------------------------------------------------------------------

class TestGetCoherenceKpis:
    def _make_df(self):
        return pd.DataFrame({
            "politician_id":             ["pol_001", "pol_001", "pol_002"],
            "status":                    ["con_accion_registrada", "en_seguimiento", "sin_accion_registrada"],
            "similarity_score":          [0.8, 0.6, 0.2],
            "politician_coherence_score": [0.7, 0.7, 0.2],
            "scored_at":                 ["2026-01-01T10:00:00+00:00"] * 3,
        })

    def test_returns_dict_with_all_keys(self):
        kpis = get_coherence_kpis(self._make_df())
        assert "politicians_tracked" in kpis
        assert "total_promises" in kpis
        assert "coherence_rate_pct" in kpis
        assert "freshness_label" in kpis

    def test_coherence_rate_in_range(self):
        kpis = get_coherence_kpis(self._make_df())
        assert 0.0 <= kpis["coherence_rate_pct"] <= 100.0

    def test_empty_df_returns_zeros(self):
        kpis = get_coherence_kpis(pd.DataFrame())
        assert kpis["politicians_tracked"] == 0
        assert kpis["total_promises"] == 0
        assert kpis["coherence_rate_pct"] == 0.0

    def test_politicians_counted_correctly(self):
        kpis = get_coherence_kpis(self._make_df())
        assert kpis["politicians_tracked"] == 2

    def test_total_promises_is_row_count(self):
        df = self._make_df()
        kpis = get_coherence_kpis(df)
        assert kpis["total_promises"] == len(df)

    def test_freshness_label_is_string(self):
        kpis = get_coherence_kpis(self._make_df())
        assert isinstance(kpis["freshness_label"], str)

    def test_empty_file_fallback_returns_empty_df(self, tmp_path):
        """_load_parquet on a missing file returns empty DataFrame (via load_promises)."""
        non_existent = tmp_path / "missing.parquet"
        from src.ui.promesometro_loaders import _load_parquet
        df = _load_parquet(non_existent, "test_key", PROMISE_UI_COLUMNS, "test")
        assert df.empty
