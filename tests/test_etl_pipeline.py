"""
Unit tests for SECOP ETL pipeline (Week 2) — last_run.json management
and Supabase upload.

4 tests as specified in Week 2 DoD:
1. load_last_run — missing file returns defaults
2. save_last_run — atomic write produces valid JSON
3. save_last_run — no corruption on simulated failure
4. upload_to_supabase — mock Supabase client
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from src.ingestion.secop_client import (
    load_last_run,
    save_last_run,
    upload_to_supabase,
    LAST_RUN_PATH,
    normalize_dataframe,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_data_dir(tmp_path, monkeypatch):
    """Redirect LAST_RUN_PATH and DATA_PROCESSED to a temp directory."""
    import src.ingestion.secop_client as mod
    monkeypatch.setattr(mod, "LAST_RUN_PATH", tmp_path / "last_run.json")
    monkeypatch.setattr(mod, "DATA_PROCESSED", tmp_path)
    return tmp_path


# ---------------------------------------------------------------------------
# Test 1: load_last_run — missing file returns defaults
# ---------------------------------------------------------------------------

def test_load_last_run_missing_file_returns_defaults(tmp_data_dir):
    """When last_run.json does not exist, load_last_run() should return
    default values with null timestamps and zero rows."""
    state = load_last_run()

    assert state["last_updated_at"] is None
    assert state["last_run_ts"] is None
    assert state["rows_fetched"] == 0
    assert state["dataset_key"] == "contratos"


# ---------------------------------------------------------------------------
# Test 2: save_last_run — atomic write produces valid JSON
# ---------------------------------------------------------------------------

def test_save_last_run_atomic_write(tmp_data_dir):
    """save_last_run() should write a valid JSON file that can be read
    back successfully by load_last_run()."""
    test_state = {
        "last_updated_at": "2025-03-10T12:00:00.000000+00:00",
        "last_run_ts": "2025-03-10T12:05:00.000000+00:00",
        "rows_fetched": 42000,
        "dataset_key": "contratos",
    }

    save_last_run(test_state)

    # Read it back
    loaded = load_last_run()
    assert loaded["last_updated_at"] == test_state["last_updated_at"]
    assert loaded["rows_fetched"] == 42000

    # Verify the file is valid JSON
    path = tmp_data_dir / "last_run.json"
    with open(path, "r") as f:
        raw = json.load(f)
    assert raw["rows_fetched"] == 42000


# ---------------------------------------------------------------------------
# Test 3: save_last_run — no corruption on failure
# ---------------------------------------------------------------------------

def test_save_last_run_no_corruption_on_failure(tmp_data_dir):
    """If save_last_run() fails mid-write (simulated by patching os.replace),
    the original last_run.json should remain intact."""
    # First, write a valid state
    original_state = {
        "last_updated_at": "2025-01-01T00:00:00.000",
        "last_run_ts": "2025-01-01T00:00:00.000",
        "rows_fetched": 1000,
        "dataset_key": "contratos",
    }
    save_last_run(original_state)

    # Now try to save a new state but make os.replace fail
    new_state = {
        "last_updated_at": "2025-06-01T00:00:00.000",
        "last_run_ts": "2025-06-01T00:00:00.000",
        "rows_fetched": 99999,
        "dataset_key": "contratos",
    }

    with patch("src.ingestion.secop_client.os.replace", side_effect=OSError("disk full")):
        with pytest.raises(OSError, match="disk full"):
            save_last_run(new_state)

    # Original file should still be intact
    loaded = load_last_run()
    assert loaded["rows_fetched"] == 1000
    assert loaded["last_updated_at"] == "2025-01-01T00:00:00.000"


# ---------------------------------------------------------------------------
# Test 4: upload_to_supabase — mock Supabase client
# ---------------------------------------------------------------------------

def test_upload_to_supabase_calls_storage(tmp_path):
    """upload_to_supabase() should call Supabase storage upload with the
    correct bucket and file contents."""
    import sys

    # Create a fake parquet file
    fake_parquet = tmp_path / "test_file.parquet"
    fake_parquet.write_bytes(b"fake parquet data")

    mock_storage = MagicMock()
    mock_bucket = MagicMock()
    mock_storage.from_.return_value = mock_bucket

    mock_supabase = MagicMock()
    mock_supabase.storage = mock_storage

    # Inject mock supabase module since create_client is imported locally
    mock_supabase_module = MagicMock()
    mock_supabase_module.create_client.return_value = mock_supabase

    original = sys.modules.get("supabase")
    sys.modules["supabase"] = mock_supabase_module
    try:
        with patch("src.utils.config.get_supabase_url", return_value="https://test.supabase.co"):
            with patch("src.utils.config.get_supabase_key", return_value="test-key"):
                with patch("src.utils.config.get_supabase_storage_bucket", return_value="veeduria-processed"):
                    upload_to_supabase(fake_parquet)
    finally:
        if original is None:
            sys.modules.pop("supabase", None)
        else:
            sys.modules["supabase"] = original

    # Verify storage was called
    mock_storage.from_.assert_called_once_with("veeduria-processed")
    mock_bucket.upload.assert_called_once()

    # Verify the remote path
    call_args = mock_bucket.upload.call_args
    assert call_args.args[0] == "data/test_file.parquet"


# ---------------------------------------------------------------------------
# Test 5 (Bonus): normalize_dataframe handles missing columns gracefully
# ---------------------------------------------------------------------------

def test_normalize_dataframe_basic():
    """normalize_dataframe should clean NITs, normalize names, and coerce
    numerics without crashing on a minimal DataFrame."""
    import pandas as pd

    df = pd.DataFrame({
        "nit_entidad": ["830.123.456-7", "900555123"],
        "nombre_entidad": ["Municipio de Bogotá", "ALCALDÍA DE CALI"],
        "valor_contrato": ["1500000000", "invalid"],
        "fecha_firma": ["2024-06-15T00:00:00.000", "bad_date"],
    })

    result = normalize_dataframe(df)

    # NIT cleaning
    assert result["nit_entidad_clean"].iloc[0] == "8301234567"
    assert result["nit_entidad_clean"].iloc[1] == "900555123"

    # Name normalization (uppercase, no accents)
    assert result["nombre_entidad_norm"].iloc[0] == "MUNICIPIO DE BOGOTA"

    # Numeric coercion
    assert result["valor_contrato"].iloc[0] == 1500000000.0
    assert pd.isna(result["valor_contrato"].iloc[1])

    # Date coercion
    assert pd.notna(result["fecha_firma"].iloc[0])
    assert pd.isna(result["fecha_firma"].iloc[1])
