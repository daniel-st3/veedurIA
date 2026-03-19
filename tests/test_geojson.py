"""
Tests for Colombia departments GeoJSON and department name normalization.

Tests:
1. GeoJSON file exists at data/reference/colombia_departments.geojson
2. All features have NOMBRE_DPT property
3. File is under 500KB
4. Exactly 33 features (32 departments + Bogotá D.C.)
5. normalize_department_name maps SECOP variants correctly
6. build_department_summary normalizes and aggregates correctly
7. All geometry types are valid (Polygon or MultiPolygon)
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
GEOJSON_PATH = PROJECT_ROOT / "data" / "reference" / "colombia_departments.geojson"


# ---------------------------------------------------------------------------
# Test 1: File exists
# ---------------------------------------------------------------------------

def test_geojson_file_exists():
    """The GeoJSON file must exist at the expected path."""
    assert GEOJSON_PATH.exists(), f"GeoJSON not found: {GEOJSON_PATH}"


# ---------------------------------------------------------------------------
# Test 2: All features have NOMBRE_DPT
# ---------------------------------------------------------------------------

def test_all_features_have_nombre_dpt():
    """Every feature in the GeoJSON must have a 'NOMBRE_DPT' property."""
    with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    features = data.get("features", [])
    assert len(features) > 0, "GeoJSON has no features"

    for i, feat in enumerate(features):
        props = feat.get("properties", {})
        assert "NOMBRE_DPT" in props, f"Feature {i} missing NOMBRE_DPT"
        assert isinstance(props["NOMBRE_DPT"], str), f"Feature {i} NOMBRE_DPT not string"
        assert len(props["NOMBRE_DPT"]) > 0, f"Feature {i} NOMBRE_DPT is empty"


# ---------------------------------------------------------------------------
# Test 3: File under 500KB
# ---------------------------------------------------------------------------

def test_geojson_under_500kb():
    """The GeoJSON file must be under 500KB for Streamlit Cloud."""
    size_bytes = GEOJSON_PATH.stat().st_size
    size_kb = size_bytes / 1024
    assert size_kb < 500, f"GeoJSON is {size_kb:.1f} KB (limit: 500 KB)"


# ---------------------------------------------------------------------------
# Test 4: Exactly 33 features
# ---------------------------------------------------------------------------

def test_geojson_has_33_features():
    """Colombia has 32 departments + Bogotá D.C. = 33 features."""
    with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert len(data["features"]) == 33


# ---------------------------------------------------------------------------
# Test 5: normalize_department_name maps correctly
# ---------------------------------------------------------------------------

def test_normalize_department_name_variants():
    """Known SECOP department name variants should map to their GeoJSON equivalents."""
    from src.ui.maps import normalize_department_name

    # Standard case — just uppercase
    assert normalize_department_name("Antioquia") == "ANTIOQUIA"
    assert normalize_department_name("Valle del Cauca") == "VALLE DEL CAUCA"

    # Bogotá variants
    assert normalize_department_name("Bogotá") == "SANTAFE DE BOGOTA D.C"
    assert normalize_department_name("Bogota D.C.") == "SANTAFE DE BOGOTA D.C"
    assert normalize_department_name("Bogotá D.C.") == "SANTAFE DE BOGOTA D.C"

    # San Andrés
    assert normalize_department_name("San Andrés") == \
        "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA"
    assert normalize_department_name("San Andrés y Providencia") == \
        "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA"

    # La Guajira
    assert normalize_department_name("La Guajira") == "LA GUAJIRA"
    assert normalize_department_name("Guajira") == "LA GUAJIRA"

    # Ñ preservation
    assert normalize_department_name("Nariño") == "NARIÑO"

    # Empty / None
    assert normalize_department_name("") == ""
    assert normalize_department_name("  ") == ""


# ---------------------------------------------------------------------------
# Test 6: build_department_summary normalizes and aggregates
# ---------------------------------------------------------------------------

def test_build_department_summary():
    """build_department_summary should normalize names and aggregate correctly."""
    from src.ui.maps import build_department_summary

    df = pd.DataFrame({
        "departamento": ["Bogotá", "Bogotá", "Antioquia", "Antioquia", "Antioquia"],
        "risk_score": [0.8, 0.6, 0.3, 0.4, 0.5],
    })

    result = build_department_summary(df)

    assert len(result) == 2

    bogota = result[result["departamento"] == "SANTAFE DE BOGOTA D.C"]
    assert len(bogota) == 1
    assert bogota.iloc[0]["avg_risk"] == pytest.approx(0.7, abs=0.01)
    assert bogota.iloc[0]["contract_count"] == 2

    antioquia = result[result["departamento"] == "ANTIOQUIA"]
    assert len(antioquia) == 1
    assert antioquia.iloc[0]["avg_risk"] == pytest.approx(0.4, abs=0.01)
    assert antioquia.iloc[0]["contract_count"] == 3


# ---------------------------------------------------------------------------
# Test 7: All geometries are valid types
# ---------------------------------------------------------------------------

def test_geojson_valid_geometry_types():
    """All features must have Polygon or MultiPolygon geometry."""
    with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    valid_types = {"Polygon", "MultiPolygon"}
    for i, feat in enumerate(data["features"]):
        geo_type = feat["geometry"]["type"]
        assert geo_type in valid_types, \
            f"Feature {i} ({feat['properties'].get('NOMBRE_DPT')}) has invalid type: {geo_type}"
