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
import streamlit as st

from src.utils.logger import get_logger

logger = get_logger(__name__)

# Module-level cache for GeoJSON department names (avoids re-reading disk on every call)
_GEOJSON_NAMES_CACHE: dict[str, list[str]] = {}

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
    "DISTRITO CAPITAL DE BOGOTA": "SANTAFE DE BOGOTA D.C",
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
    Cached in-process via module-level dict so disk is only read once.

    Args:
        geojson_path: Path to GeoJSON file. Defaults to the bundled file.

    Returns:
        Sorted list of department names from the GeoJSON.
    """
    from functools import lru_cache as _lru  # noqa: PLC0415

    path = Path(geojson_path) if geojson_path else DEFAULT_GEOJSON_PATH
    if not path.exists():
        return []

    # Use a module-level cache keyed by resolved path
    cache_key = str(path.resolve())
    if cache_key not in _GEOJSON_NAMES_CACHE:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        _GEOJSON_NAMES_CACHE[cache_key] = sorted(
            feat["properties"]["NOMBRE_DPT"]
            for feat in data.get("features", [])
            if "NOMBRE_DPT" in feat.get("properties", {})
        )
    return _GEOJSON_NAMES_CACHE[cache_key]


# ---------------------------------------------------------------------------
# Plotly-based maps (native Streamlit rendering, no extra dependencies)
# ---------------------------------------------------------------------------

def _load_geojson(geojson_path: Path | None = None) -> dict:
    """Load and cache the Colombia GeoJSON data."""
    path = Path(geojson_path) if geojson_path else DEFAULT_GEOJSON_PATH
    if not path.exists():
        logger.warning("GeoJSON not found at %s", path)
        return {"type": "FeatureCollection", "features": []}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def render_hero_colombia_map() -> None:
    """
    Render an animated Colombia "AI Radar" map for the landing page.

    Strategy: pure CSS animation overlay on top of a static Plotly map.
    Streamlit blocks inline <script> tags, so Plotly frame animation
    cannot be auto-triggered. Instead we:
      1. Render a single vivid Plotly choropleth (dept intensity values).
      2. Overlay a pure-CSS animated radar: spinning ring, pulsing dots,
         scanning sweep — all driven by @keyframes, 100% reliable in browser.

    GSAP-inspired easing translated to CSS cubic-bezier curves.
    """
    import plotly.graph_objects as go  # noqa: PLC0415
    import random

    geojson = _load_geojson()
    features = geojson.get("features", [])
    if not features:
        st.info("Colombia map loading...")
        return

    departments = [f["properties"]["NOMBRE_DPT"] for f in features]

    # Deterministic "alert level" values per department
    rng = random.Random(42)
    z = [rng.uniform(0.22, 0.92) for _ in departments]

    # ── Radar CSS animations (injected before chart) ──────────────────────
    # These keyframes run entirely in CSS — no JS needed, no CSP issues.
    st.markdown("""
<style>
/* Radar overlay wrapper */
.radar-map-wrapper {
    position: relative;
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0, 80, 200, 0.13), 0 2px 8px rgba(0,0,0,0.06);
}

/* ── Animated CSS overlay sits ON TOP of the Plotly iframe ── */
.radar-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none;
    z-index: 10;
    border-radius: 18px;
    overflow: hidden;
}

/* Sweeping radar arm: rotates around Bogotá centroid area */
@keyframes radarSweep {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
}
.radar-sweep {
    position: absolute;
    top: 35%; left: 52%;
    width: 300px; height: 300px;
    margin-left: -150px; margin-top: -150px;
    border-radius: 50%;
    animation: radarSweep 5s linear infinite;
    background: conic-gradient(
        from 0deg,
        rgba(0, 122, 255, 0.0) 0deg,
        rgba(0, 122, 255, 0.0) 270deg,
        rgba(0, 122, 255, 0.08) 310deg,
        rgba(0, 200, 255, 0.22) 355deg,
        rgba(0, 122, 255, 0.0) 360deg
    );
}

/* Ripple rings from center */
@keyframes radarRing {
    0%   { transform: scale(0.2); opacity: 0.7; }
    100% { transform: scale(1.6); opacity: 0.0; }
}
.radar-ring {
    position: absolute;
    top: 35%; left: 52%;
    width: 140px; height: 140px;
    margin-left: -70px; margin-top: -70px;
    border-radius: 50%;
    border: 1.5px solid rgba(0, 122, 255, 0.45);
    animation: radarRing 3.2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
}
.radar-ring-2 { animation-delay: 1.07s; }
.radar-ring-3 { animation-delay: 2.14s; }

/* Hot-spot dot: blinks over Bogotá */
@keyframes hotDot {
    0%, 100% { box-shadow: 0 0 0 0 rgba(229, 57, 53, 0.7); transform: scale(1); }
    50%       { box-shadow: 0 0 0 10px rgba(229, 57, 53, 0); transform: scale(1.3); }
}
.radar-hotspot {
    position: absolute;
    top: 34%; left: 53%;
    width: 9px; height: 9px;
    border-radius: 50%;
    background: #E53935;
    animation: hotDot 2s ease-in-out infinite;
}

/* Secondary dot: Medellín */
.radar-hotspot-2 {
    top: 27%; left: 46%;
    animation-delay: 0.8s;
    background: #FF9500;
    width: 7px; height: 7px;
}
/* Cali */
.radar-hotspot-3 {
    top: 41%; left: 44%;
    animation-delay: 1.4s;
    background: #FF9500;
    width: 6px; height: 6px;
}

/* Gradient vignette for cinematic feel */
.radar-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(
        ellipse at center,
        transparent 45%,
        rgba(250, 250, 252, 0.18) 100%
    );
    border-radius: 18px;
}

/* Thin top status bar */
.radar-scanline {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg,
        transparent 0%,
        rgba(0, 200, 255, 0.0) 20%,
        rgba(0, 200, 255, 0.7) 50%,
        rgba(0, 200, 255, 0.0) 80%,
        transparent 100%
    );
    animation: scanlineMoveX 4s ease-in-out infinite;
}
@keyframes scanlineMoveX {
    0%, 100% { transform: translateX(-100%); opacity: 0; }
    10%       { opacity: 1; }
    90%       { opacity: 1; }
    50%       { transform: translateX(100%); }
}
</style>
""", unsafe_allow_html=True)

    fig = go.Figure(go.Choroplethmap(
        geojson=geojson,
        locations=departments,
        featureidkey="properties.NOMBRE_DPT",
        z=z,
        colorscale=[
            [0.00, "rgba(10, 40, 120, 0.06)"],
            [0.30, "rgba(0, 90, 210, 0.20)"],
            [0.55, "rgba(55, 65, 210, 0.34)"],
            [0.78, "rgba(100, 55, 205, 0.46)"],
            [1.00, "rgba(168, 50, 220, 0.62)"],
        ],
        marker_line_width=0.8,
        marker_line_color="rgba(255, 255, 255, 0.6)",
        marker_opacity=0.92,
        showscale=False,
        hovertemplate="<b>%{location}</b><extra></extra>",
    ))

    fig.update_layout(
        map=dict(
            style="carto-positron",
            center=dict(lat=4.5, lon=-73.5),
            zoom=4.2,
        ),
        margin=dict(l=0, r=0, t=0, b=0),
        height=460,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        hoverlabel=dict(
            bgcolor="rgba(255,255,255,0.96)",
            font_size=13,
            font_family="Inter, sans-serif",
            bordercolor="rgba(0,0,0,0.06)",
        ),
    )

    # Wrap in radar overlay container
    st.markdown('<div class="radar-map-wrapper">', unsafe_allow_html=True)
    st.plotly_chart(
        fig,
        use_container_width=True,
        config={"displayModeBar": False, "scrollZoom": False},
    )
    # CSS-animated radar overlay (sits visually on top via absolute positioning)
    # Note: Streamlit renders these in document flow, not truly absolute over
    # the chart iframe. We use a negative-margin trick + z-index.
    st.markdown("""
<div class="radar-overlay" style="margin-top:-460px; height:460px;">
    <div class="radar-scanline"></div>
    <div class="radar-sweep"></div>
    <div class="radar-ring"></div>
    <div class="radar-ring radar-ring-2"></div>
    <div class="radar-ring radar-ring-3"></div>
    <div class="radar-hotspot"></div>
    <div class="radar-hotspot radar-hotspot-2"></div>
    <div class="radar-hotspot radar-hotspot-3"></div>
    <div class="radar-vignette"></div>
</div>
""", unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)


def render_plotly_choropleth(
    df_dept: pd.DataFrame,
    geojson_path: str | Path | None = None,
    active_dept_filter: list[str] | None = None,
) -> str | None:
    """
    Render a Plotly choropleth map of average risk by department.

    Replaces the Folium version for the ContratoLimpio page.
    Renders natively in Streamlit without streamlit-folium.

    Uses st.plotly_chart with on_select='rerun' so that clicking a
    department stores the selection in session state. Returns the
    clicked department name (NOMBRE_DPT string) or None.

    Args:
        df_dept:             DataFrame with columns: departamento, avg_risk, contract_count.
                             Should always be the NATIONAL summary (not pre-filtered),
                             so all departments are visible and clickable.
        geojson_path:        Path to Colombia departments GeoJSON file.
        active_dept_filter:  List of department names currently active in the sidebar
                             filter (used only to show a warning message).

    Returns:
        The clicked department name string, or None if no selection.
    """
    import plotly.graph_objects as go  # noqa: PLC0415
    from src.ui.i18n import t  # noqa: PLC0415

    geojson = _load_geojson(geojson_path)

    if df_dept.empty:
        st.info("No department data available for the map.")
        return None

    # Show a helpful message when sidebar dept filter limits the map view
    if active_dept_filter and len(active_dept_filter) > 0:
        n_depts = len(active_dept_filter)
        st.markdown(
            f"<div style='background:rgba(13,91,215,0.05);border:1px solid rgba(13,91,215,0.12);"
            f"border-radius:10px;padding:0.55rem 1rem;font-size:0.78rem;"
            f"color:rgba(23,32,51,0.66);margin-bottom:0.6rem;"
            f"font-family:\"JetBrains Mono\",monospace;letter-spacing:0.03em;'>"
            f"{t('map_filtered_warning', n=n_depts)} "
            f"<span style='color:rgba(13,91,215,0.70);'>"
            f"({', '.join(active_dept_filter[:3])}{'…' if n_depts>3 else ''})</span>"
            f"</div>",
            unsafe_allow_html=True,
        )

    # ── Premium civic-data palette ────────────────────────────────────────
    # Semi-transparent colors so dark map tiles show through
    COLORSCALE = [
        [0.00, "rgba(25, 135, 84, 0.70)"],
        [0.28, "rgba(211, 162, 26, 0.78)"],
        [0.56, "rgba(237, 115, 21, 0.84)"],
        [1.00, "rgba(198, 40, 57, 0.92)"],
    ]

    fig = go.Figure(go.Choroplethmap(
        geojson=geojson,
        locations=df_dept["departamento"],
        featureidkey="properties.NOMBRE_DPT",
        z=df_dept["avg_risk"],
        colorscale=COLORSCALE,
        zmin=0.0,
        zmax=max(df_dept["avg_risk"].max(), 0.5),
        marker_line_width=0.8,
        marker_line_color="rgba(255, 255, 255, 0.18)",
        marker_opacity=1.0,
        showscale=True,
        colorbar=dict(
            title=dict(
                text="Riesgo",
                font=dict(size=11, family="Inter, sans-serif", color="rgba(23,32,51,0.72)"),
                side="right",
            ),
            thickness=8,
            len=0.50,
            x=1.01,
            bgcolor="rgba(255,253,248,0.95)",
            bordercolor="rgba(23,32,51,0.08)",
            borderwidth=1,
            tickfont=dict(size=10, family="JetBrains Mono, monospace", color="rgba(23,32,51,0.52)"),
            tickformat=".2f",
            outlinecolor="rgba(0,0,0,0)",
            tickvals=[0.0, 0.2, 0.4, 0.6, 0.8],
            ticktext=["0.0", "0.2", "0.4", "0.6", "0.8"],
        ),
        customdata=df_dept[["contract_count"]].values if "contract_count" in df_dept.columns else None,
        hovertemplate=(
            "<b>%{location}</b><br>"
            "Riesgo promedio: <b>%{z:.2f}</b><br>"
            "Contratos: %{customdata[0]:,}<extra></extra>"
        ) if "contract_count" in df_dept.columns else (
            "<b>%{location}</b><br>"
            "Riesgo promedio: <b>%{z:.2f}</b><extra></extra>"
        ),
    ))

    fig.update_layout(
        map=dict(
            style="carto-positron",
            center=dict(lat=4.5, lon=-73.5),
            zoom=4.25,
        ),
        margin=dict(l=0, r=0, t=0, b=0),
        height=480,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        hoverlabel=dict(
            bgcolor="rgba(255,253,248,0.98)",
            font_size=13,
            font_family="Inter, sans-serif",
            font_color="rgba(23,32,51,0.94)",
            bordercolor="rgba(23,32,51,0.08)",
        ),
        clickmode="event+select",
    )

    # Dark wrapper — transparent so page bg shows through
    st.markdown("""
<style>
.choropleth-wrapper {
    border-radius: 22px;
    overflow: hidden;
    background: transparent;
    border: none;
}
</style>
<div class="choropleth-wrapper">""", unsafe_allow_html=True)

    chart_event = st.plotly_chart(
        fig,
        use_container_width=True,
        config={"displayModeBar": False, "scrollZoom": False},
        on_select="rerun",
        key="choropleth_main",
    )
    st.markdown("</div>", unsafe_allow_html=True)

    # Extract clicked department from Plotly selection event
    selected_dept: str | None = None
    if chart_event and hasattr(chart_event, "selection"):
        sel = chart_event.selection
        if sel and hasattr(sel, "points") and sel.points:
            pt = sel.points[0]
            # Plotly choroplethmapbox stores the location in pt.location
            loc = getattr(pt, "location", None)
            if loc:
                selected_dept = str(loc)

    return selected_dept
