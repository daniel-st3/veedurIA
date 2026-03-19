"""
Folium choropleth map builder for VeedurIA ContratoLimpio.

Renders a choropleth map of average risk score per Colombian department
using YlOrRd color scale on CartoDB Positron tiles.

GeoJSON source:
  john-guerra/Colombia.geo.json (GitHub Gist 43c7656821069d00dcbc)
  Original: DANE open data shapefiles (public domain Colombian government data)
  Simplified: Douglas-Peucker (tolerance=0.008, 0.02 for San Andrés),
  coordinates rounded to 4 decimals, non-essential properties stripped.
  91 KB / 33 features / property key: NOMBRE_DPT

Usage:
    from src.ui.maps import render_choropleth, build_department_summary

    df_dept = build_department_summary(df_scored)
    render_choropleth(df_dept)
"""

from __future__ import annotations

import json
import unicodedata
from pathlib import Path
from typing import Any

import pandas as pd

from src.utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_GEOJSON_PATH = PROJECT_ROOT / "data" / "reference" / "colombia_departments.geojson"

# Map center and zoom for Colombia
COLOMBIA_CENTER = [4.5709, -74.2973]
COLOMBIA_ZOOM = 5

# ---------------------------------------------------------------------------
# Department name normalization
# ---------------------------------------------------------------------------

# Mapping from SECOP / user-facing department names to the GeoJSON NOMBRE_DPT.
# The GeoJSON uses uppercase unaccented names from DANE.
# SECOP data may use title case, accented, or abbreviated names.
SECOP_TO_GEOJSON: dict[str, str] = {
    "BOGOTA": "SANTAFE DE BOGOTA D.C",
    "BOGOTA D.C.": "SANTAFE DE BOGOTA D.C",
    "BOGOTA, D.C.": "SANTAFE DE BOGOTA D.C",
    "BOGOTA D.C": "SANTAFE DE BOGOTA D.C",
    "SANTAFE DE BOGOTA": "SANTAFE DE BOGOTA D.C",
    "DISTRITO CAPITAL": "SANTAFE DE BOGOTA D.C",
    "SAN ANDRES": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
    "SAN ANDRES Y PROVIDENCIA": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
    "SAN ANDRES, PROVIDENCIA Y SANTA CATALINA": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
    "NARINO": "NARIÑO",
    "GUAJIRA": "LA GUAJIRA",
    "NORTE SANTANDER": "NORTE DE SANTANDER",
}


def _strip_accents(s: str) -> str:
    """Remove diacritical marks except Ñ (which DANE keeps)."""
    out = []
    for c in unicodedata.normalize("NFD", s):
        cat = unicodedata.category(c)
        if cat == "Mn":  # Mark, Nonspacing (diacritics)
            # Keep combining tilde (U+0303) for Ñ
            if c == "\u0303":
                out.append(c)
            # Drop all other accents
        else:
            out.append(c)
    return unicodedata.normalize("NFC", "".join(out))


def normalize_department_name(name: str) -> str:
    """
    Normalize a department name from SECOP format to the GeoJSON NOMBRE_DPT format.

    Steps:
      1. Uppercase
      2. Strip accents (except Ñ)
      3. Map known SECOP variants to GeoJSON names

    Args:
        name: Raw department name from SECOP data.

    Returns:
        Normalized name matching GeoJSON NOMBRE_DPT values.
    """
    if not isinstance(name, str) or not name.strip():
        return ""

    normalized = _strip_accents(name.strip().upper())

    # Check explicit mapping first
    if normalized in SECOP_TO_GEOJSON:
        return SECOP_TO_GEOJSON[normalized]

    return normalized


# ---------------------------------------------------------------------------
# Choropleth builder
# ---------------------------------------------------------------------------

def render_choropleth(
    df_dept: pd.DataFrame,
    geojson_path: str | Path | None = None,
) -> None:
    """
    Build and render a Folium choropleth map in a Streamlit fragment.

    The join key is:
      - DataFrame column: "departamento" (normalized to match GeoJSON)
      - GeoJSON property: "NOMBRE_DPT"

    Args:
        df_dept:      DataFrame with columns: departamento, avg_risk, contract_count.
                      'departamento' values must be normalized (uppercase, DANE names).
        geojson_path: Path to Colombia departments GeoJSON file.
                      Defaults to data/reference/colombia_departments.geojson.
    """
    import folium  # noqa: PLC0415
    from streamlit_folium import st_folium  # noqa: PLC0415

    geojson_path = Path(geojson_path) if geojson_path else DEFAULT_GEOJSON_PATH

    m = folium.Map(
        location=COLOMBIA_CENTER,
        zoom_start=COLOMBIA_ZOOM,
        tiles="CartoDB Positron",
    )

    if geojson_path.exists() and not df_dept.empty:
        choropleth = folium.Choropleth(
            geo_data=str(geojson_path),
            name="Risk choropleth",
            data=df_dept,
            columns=["departamento", "avg_risk"],
            key_on="feature.properties.NOMBRE_DPT",
            fill_color="YlOrRd",
            fill_opacity=0.7,
            line_weight=0.5,
            line_opacity=0.4,
            legend_name="Average Risk Score",
            nan_fill_color="#f5f5f7",
        )
        choropleth.add_to(m)

        # Add tooltips
        style_function = lambda x: {
            "fillColor": "#ffffff",
            "color": "#000000",
            "fillOpacity": 0.05,
            "weight": 0.1,
        }
        highlight_function = lambda x: {
            "fillColor": "#000000",
            "color": "#000000",
            "fillOpacity": 0.2,
            "weight": 0.3,
        }

        folium.features.GeoJson(
            str(geojson_path),
            style_function=style_function,
            highlight_function=highlight_function,
            tooltip=folium.features.GeoJsonTooltip(
                fields=["NOMBRE_DPT"],
                aliases=[""],
                style="background-color: white; color: #111; font-family: sans-serif; font-size: 11px; padding: 4px; border: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 4px;",
            ),
        ).add_to(m)

    else:
        if not geojson_path.exists():
            logger.warning("GeoJSON file not found: %s — rendering empty map", geojson_path)
        folium.Marker(
            location=COLOMBIA_CENTER,
            popup="Colombia",
            icon=folium.Icon(color="blue", icon="info-sign"),
        ).add_to(m)

    st_folium(m, width=700, height=500, returned_objects=[])


# ---------------------------------------------------------------------------
# Department aggregation
# ---------------------------------------------------------------------------

def build_department_summary(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate risk scores by department for the choropleth map.

    Normalizes department names to match the GeoJSON NOMBRE_DPT values
    (uppercase, unaccented, DANE canonical names) so the Folium
    Choropleth join works correctly.

    Args:
        df: Scored DataFrame with columns 'departamento' and 'risk_score'.

    Returns:
        DataFrame with columns: departamento, avg_risk, contract_count.
        'departamento' values match GeoJSON NOMBRE_DPT keys.
    """
    if "departamento" not in df.columns or "risk_score" not in df.columns:
        return pd.DataFrame(columns=["departamento", "avg_risk", "contract_count"])

    df = df.copy()

    # Normalize department names to match GeoJSON NOMBRE_DPT
    df["departamento"] = df["departamento"].apply(normalize_department_name)

    # Drop rows with empty department names
    df = df[df["departamento"] != ""]

    result = (
        df.groupby("departamento")
        .agg(
            avg_risk=("risk_score", "mean"),
            contract_count=("risk_score", "size"),
        )
        .reset_index()
    )
    result["avg_risk"] = result["avg_risk"].round(3)
    return result


def get_geojson_department_names(
    geojson_path: str | Path | None = None,
) -> list[str]:
    """
    Extract all NOMBRE_DPT values from the GeoJSON file.

    Useful for validation and testing.

    Args:
        geojson_path: Path to GeoJSON file. Defaults to the bundled file.

    Returns:
        Sorted list of department names from the GeoJSON.
    """
    geojson_path = Path(geojson_path) if geojson_path else DEFAULT_GEOJSON_PATH

    if not geojson_path.exists():
        return []

    with open(geojson_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return sorted(
        feat["properties"]["NOMBRE_DPT"]
        for feat in data.get("features", [])
        if "NOMBRE_DPT" in feat.get("properties", {})
    )
