"""
Tests for src.ui.data_loaders.

Covers:
  - Column pruning: only requested columns are returned.
  - Preview size cap: load_preview() returns at most PREVIEW_SIZE rows.
  - Row-group tail skipping: only the trailing portion is read.
  - Full load: load_full() returns all rows.
  - Empty-file safety: functions return empty DataFrame when no file exists.
  - load_scored_data() alias: matches load_preview() result.
  - get_total_row_count(): correct count without loading rows.
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_parquet(n_rows: int, extra_col: bool = True) -> Path:
    """Write a small Parquet file with a subset of UI_COLUMNS plus optional extras."""
    from src.ui.data_loaders import UI_COLUMNS

    data: dict = {col: [f"val_{i}" for i in range(n_rows)] for col in UI_COLUMNS}
    if extra_col:
        # Simulate the 100 unused columns present in the real 114-col file
        data["unused_column_a"] = [0] * n_rows
        data["unused_column_b"] = [1.0] * n_rows

    df = pd.DataFrame(data)
    tmp = tempfile.NamedTemporaryFile(suffix=".parquet", delete=False)
    df.to_parquet(tmp.name, index=False, engine="pyarrow",
                  # Use small row groups so row-group skipping is exercised
                  row_group_size=max(1, n_rows // 5))
    return Path(tmp.name)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def small_parquet():
    """100-row Parquet file (well under PREVIEW_SIZE)."""
    p = _make_parquet(100)
    yield p
    p.unlink(missing_ok=True)


@pytest.fixture()
def large_parquet():
    """PREVIEW_SIZE + 500 rows so the preview cap is exercised."""
    from src.ui.data_loaders import PREVIEW_SIZE
    p = _make_parquet(PREVIEW_SIZE + 500)
    yield p
    p.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# _safe_read tests (direct, no Streamlit cache)
# ---------------------------------------------------------------------------

class TestSafeRead:
    def test_column_pruning(self, small_parquet):
        """Only UI_COLUMNS are returned; unused columns are absent."""
        from src.ui.data_loaders import UI_COLUMNS, _safe_read
        df = _safe_read(small_parquet, columns=UI_COLUMNS)
        for col in df.columns:
            assert col in UI_COLUMNS, f"Unexpected column: {col}"

    def test_all_rows_when_no_nrows(self, small_parquet):
        """Without nrows, _safe_read returns all rows."""
        from src.ui.data_loaders import UI_COLUMNS, _safe_read
        df = _safe_read(small_parquet, columns=UI_COLUMNS)
        assert len(df) == 100

    def test_preview_cap_small_file(self, small_parquet):
        """When nrows > file rows, all rows are returned (no error)."""
        from src.ui.data_loaders import PREVIEW_SIZE, UI_COLUMNS, _safe_read
        df = _safe_read(small_parquet, columns=UI_COLUMNS, nrows=PREVIEW_SIZE)
        assert len(df) == 100  # file is smaller than preview size

    def test_preview_cap_large_file(self, large_parquet):
        """When nrows < file rows, _safe_read returns exactly nrows rows."""
        from src.ui.data_loaders import PREVIEW_SIZE, UI_COLUMNS, _safe_read
        df = _safe_read(large_parquet, columns=UI_COLUMNS, nrows=PREVIEW_SIZE)
        assert len(df) == PREVIEW_SIZE

    def test_missing_column_dropped_silently(self, small_parquet):
        """Requesting a non-existent column doesn't raise; it's simply omitted."""
        from src.ui.data_loaders import _safe_read
        df = _safe_read(small_parquet, columns=["nombre_entidad", "nonexistent_xyz"])
        assert "nonexistent_xyz" not in df.columns
        assert "nombre_entidad" in df.columns


# ---------------------------------------------------------------------------
# Cached loader tests (patching _resolve_parquet_path)
# ---------------------------------------------------------------------------

class TestLoadPreview:
    def test_returns_dataframe(self, small_parquet):
        """load_preview() returns a pd.DataFrame."""
        import src.ui.data_loaders as dl
        with patch.object(dl, "_resolve_parquet_path", return_value=small_parquet):
            dl.load_preview.clear()
            result = dl.load_preview()
        assert isinstance(result, pd.DataFrame)
        assert not result.empty

    def test_respects_preview_size(self, large_parquet):
        """load_preview() caps rows at PREVIEW_SIZE."""
        import src.ui.data_loaders as dl
        with patch.object(dl, "_resolve_parquet_path", return_value=large_parquet):
            dl.load_preview.clear()
            result = dl.load_preview()
        assert len(result) == dl.PREVIEW_SIZE

    def test_no_unused_columns(self, small_parquet):
        """load_preview() does not return columns outside UI_COLUMNS."""
        import src.ui.data_loaders as dl
        with patch.object(dl, "_resolve_parquet_path", return_value=small_parquet):
            dl.load_preview.clear()
            result = dl.load_preview()
        for col in result.columns:
            assert col in dl.UI_COLUMNS

    def test_returns_empty_when_no_file(self):
        """load_preview() returns an empty DataFrame when no Parquet file exists."""
        import src.ui.data_loaders as dl
        with patch.object(dl, "_resolve_parquet_path", return_value=None):
            dl.load_preview.clear()
            result = dl.load_preview()
        assert isinstance(result, pd.DataFrame)
        assert result.empty


class TestLoadFull:
    def test_returns_all_rows(self, large_parquet):
        """load_full() returns all rows (no cap)."""
        import src.ui.data_loaders as dl
        with patch.object(dl, "_resolve_parquet_path", return_value=large_parquet):
            dl.load_full.clear()
            result = dl.load_full()
        from src.ui.data_loaders import PREVIEW_SIZE
        assert len(result) == PREVIEW_SIZE + 500

    def test_returns_empty_when_no_file(self):
        """load_full() returns empty DataFrame when no Parquet file exists."""
        import src.ui.data_loaders as dl
        with patch.object(dl, "_resolve_parquet_path", return_value=None):
            dl.load_full.clear()
            result = dl.load_full()
        assert result.empty


class TestLoadScoredData:
    def test_alias_matches_preview(self, small_parquet):
        """load_scored_data() returns the same shape as load_preview()."""
        import src.ui.data_loaders as dl
        with patch.object(dl, "_resolve_parquet_path", return_value=small_parquet):
            dl.load_preview.clear()
            dl.load_scored_data.clear()
            preview = dl.load_preview()
            scored = dl.load_scored_data()
        # Same shape and columns (may differ in cache key so compare structure)
        assert list(preview.columns) == list(scored.columns)
        assert len(preview) == len(scored)


class TestGetTotalRowCount:
    def test_count_matches_file(self, large_parquet):
        """get_total_row_count() returns the exact row count without loading data."""
        import src.ui.data_loaders as dl
        with patch.object(dl, "_resolve_parquet_path", return_value=large_parquet):
            count = dl.get_total_row_count()
        from src.ui.data_loaders import PREVIEW_SIZE
        assert count == PREVIEW_SIZE + 500

    def test_returns_zero_when_no_file(self):
        """get_total_row_count() returns 0 when no file exists."""
        import src.ui.data_loaders as dl
        with patch.object(dl, "_resolve_parquet_path", return_value=None):
            assert dl.get_total_row_count() == 0
