"""
Unit tests for src/processing/feature_engineering.py — feature counts, ranges, and nulls.

9 tests as specified in Week 3 DoD:
1. build_features produces exactly 25 feature columns
2. No null values in any feature column
3. log_valor_contrato range is non-negative
4. advance_payment_ratio is bounded [0, 1]
5. electoral_window is binary (0 or 1)
6. single_bidder is binary (0 or 1)
7. is_direct_award is binary (0 or 1)
8. value_concentration_gini is bounded [0, 1]
9. build_features on 10K-row sample runs in < 5s (perf test)
"""

from __future__ import annotations

import time

import numpy as np
import pandas as pd
import pytest

from src.processing.feature_engineering import (
    FEATURE_COLUMNS,
    build_features,
)


# ---------------------------------------------------------------------------
# Test data factory
# ---------------------------------------------------------------------------

def _make_sample_df(n: int = 100, seed: int = 42) -> pd.DataFrame:
    """Create a realistic sample DataFrame mimicking SECOP II contracts."""
    rng = np.random.default_rng(seed)

    modalidades = [
        "Contratación Directa",
        "Licitación Pública",
        "Selección Abreviada",
        "Mínima Cuantía",
        "Concurso de Méritos",
    ]

    df = pd.DataFrame({
        "id_contrato": [f"CO-{i:06d}" for i in range(n)],
        "nit_entidad": rng.choice(["839000737", "890805765", "800141955", "860000999"], n),
        "nombre_entidad": rng.choice(["UNGRD", "Municipio de Manizales", "Cancillería", "Min Educación"], n),
        "nit_proveedor": rng.choice([f"PROV-{j:04d}" for j in range(20)], n),
        "proveedor_adjudicado": rng.choice(["Proveedor A SAS", "Proveedor B LTDA", "Proveedor C SA"], n),
        "valor_contrato": rng.lognormal(mean=20, sigma=2, size=n).astype(str),
        "valor_contrato_con_adiciones": rng.lognormal(mean=20, sigma=2, size=n).astype(str),
        "valor_de_pago_adelantado": (rng.random(n) * rng.lognormal(mean=18, sigma=1, size=n)).astype(str),
        "numero_de_ofertantes": rng.choice(["1", "2", "3", "5", None], n),
        "modalidad_de_contratacion": rng.choice(modalidades, n),
        "fecha_firma": pd.date_range("2024-01-01", periods=n, freq="D", tz="UTC").astype(str),
        "fecha_de_fin_del_contrato": pd.date_range("2024-06-01", periods=n, freq="D", tz="UTC").astype(str),
        "fecha_publicacion_proceso": pd.date_range("2023-12-01", periods=n, freq="D", tz="UTC").astype(str),
        "objeto_del_contrato": rng.choice([
            "Suministro de agua potable mediante carrotanques",
            "Prestación de servicios profesionales de asesoría jurídica",
            "Compra",
            "Adquisición de equipos de cómputo y licencias para la entidad",
        ], n),
        "codigo_unspsc": rng.choice(["43211500", "80111600", "72101500", "93131700"], n),
        "departamento": rng.choice(["Bogotá", "Antioquia", "Valle del Cauca", "La Guajira"], n),
    })

    return df


# ---------------------------------------------------------------------------
# Test 1: 25 feature columns present
# ---------------------------------------------------------------------------

def test_build_features_produces_25_columns():
    """build_features() should produce all 25 named feature columns."""
    df = _make_sample_df(50)
    result = build_features(df)

    missing = [col for col in FEATURE_COLUMNS if col not in result.columns]
    assert not missing, f"Missing feature columns: {missing}"
    assert len(FEATURE_COLUMNS) == 25


# ---------------------------------------------------------------------------
# Test 2: No null values in feature columns
# ---------------------------------------------------------------------------

def test_no_null_feature_values():
    """After build_features(), all 25 feature columns must be non-null."""
    df = _make_sample_df(100)
    result = build_features(df)

    for col in FEATURE_COLUMNS:
        null_count = result[col].isnull().sum()
        assert null_count == 0, f"Feature '{col}' has {null_count} nulls"


# ---------------------------------------------------------------------------
# Test 3: log_valor_contrato is non-negative
# ---------------------------------------------------------------------------

def test_log_valor_contrato_non_negative():
    """log1p(x) where x >= 0 should always be >= 0."""
    df = _make_sample_df(100)
    result = build_features(df)
    assert (result["log_valor_contrato"] >= 0).all()


# ---------------------------------------------------------------------------
# Test 4: advance_payment_ratio is bounded [0, 1]
# ---------------------------------------------------------------------------

def test_advance_payment_ratio_bounded():
    """advance_payment_ratio should be clipped to [0, 1]."""
    df = _make_sample_df(100)
    result = build_features(df)
    assert (result["advance_payment_ratio"] >= 0).all()
    assert (result["advance_payment_ratio"] <= 1).all()


# ---------------------------------------------------------------------------
# Test 5: electoral_window is binary
# ---------------------------------------------------------------------------

def test_electoral_window_binary():
    """electoral_window should only contain 0 or 1."""
    df = _make_sample_df(100)
    result = build_features(df)
    assert set(result["electoral_window"].unique()).issubset({0, 1})


# ---------------------------------------------------------------------------
# Test 6: single_bidder is binary
# ---------------------------------------------------------------------------

def test_single_bidder_binary():
    """single_bidder should only contain 0 or 1."""
    df = _make_sample_df(100)
    result = build_features(df)
    assert set(result["single_bidder"].unique()).issubset({0, 1})


# ---------------------------------------------------------------------------
# Test 7: is_direct_award is binary
# ---------------------------------------------------------------------------

def test_is_direct_award_binary():
    """is_direct_award should only contain 0 or 1."""
    df = _make_sample_df(100)
    result = build_features(df)
    assert set(result["is_direct_award"].unique()).issubset({0, 1})


# ---------------------------------------------------------------------------
# Test 8: value_concentration_gini is bounded [0, 1]
# ---------------------------------------------------------------------------

def test_value_concentration_gini_bounded():
    """Gini coefficient should be in [0, 1]."""
    df = _make_sample_df(100)
    result = build_features(df)
    assert (result["value_concentration_gini"] >= 0).all()
    assert (result["value_concentration_gini"] <= 1).all()


# ---------------------------------------------------------------------------
# Test 9: Performance — 10K rows under 5 seconds
# ---------------------------------------------------------------------------

def test_build_features_performance():
    """build_features() on a 10K-row sample should run in under 5 seconds."""
    df = _make_sample_df(10_000, seed=123)

    start = time.monotonic()
    result = build_features(df)
    elapsed = time.monotonic() - start

    assert elapsed < 5.0, f"build_features took {elapsed:.2f}s (limit: 5s)"
    assert len(result) == 10_000
