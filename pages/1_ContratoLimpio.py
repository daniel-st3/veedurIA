"""
Phase 1 — ContratoLimpio: ML risk semaphore on live SECOP II contracts.

Full 4-section Streamlit page:
  1. KPIs (total contracts, red flags, value at risk, top entity)
  2. Choropleth map (avg risk by department)
  3. Contracts table (sortable, filterable)
  4. Detail panel (risk card + SHAP + disclaimer)
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import streamlit as st

from src.models.isolation_forest import RED_THRESHOLD, YELLOW_THRESHOLD
from src.ui.components import (
    render_ethical_disclaimer,
    render_kpi_row,
    render_risk_card,
)
from src.ui.i18n import t
from src.ui.maps import build_department_summary, render_choropleth

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="ContratoLimpio VeedurIA",
    page_icon="🚦",
    layout="wide",
)

# Initialize session state
if "lang" not in st.session_state:
    st.session_state["lang"] = "es"
if "selected_contract" not in st.session_state:
    st.session_state["selected_contract"] = None

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"
LAST_RUN_PATH = DATA_PROCESSED / "last_run.json"


@st.cache_data(ttl=300)  # 5-minute cache
def load_scored_data() -> pd.DataFrame:
    """Load the latest scored contracts Parquet file."""
    scored_path = DATA_PROCESSED / "scored_contracts.parquet"
    if scored_path.exists():
        return pd.read_parquet(scored_path)

    # Fallback: load any available parquet and return without scores
    parquet_files = sorted(DATA_PROCESSED.glob("secop_contratos_*.parquet"))
    if parquet_files:
        return pd.read_parquet(parquet_files[-1])

    return pd.DataFrame()


def get_staleness_info() -> tuple[str, bool]:
    """Get last update timestamp and whether data is stale (>4h)."""
    if LAST_RUN_PATH.exists():
        with open(LAST_RUN_PATH, "r") as f:
            state = json.load(f)
        last_ts = state.get("last_run_ts")
        if last_ts:
            try:
                last_dt = datetime.fromisoformat(last_ts)
                now = datetime.now(timezone.utc)
                hours_ago = (now - last_dt).total_seconds() / 3600
                return last_ts[:19], hours_ago > 4
            except (ValueError, TypeError):
                pass
    return "N/A", True


# ---------------------------------------------------------------------------
# Sidebar — Filters
# ---------------------------------------------------------------------------

with st.sidebar:
    st.markdown(f"### {t('sidebar_filters')}")

    # Language toggle
    lang_options = {"Español": "es", "English": "en"}
    selected_lang = st.selectbox(
        t("lang_label"),
        options=list(lang_options.keys()),
        index=0 if st.session_state["lang"] == "es" else 1,
        key="cl_lang_selector",
    )
    st.session_state["lang"] = lang_options[selected_lang]

    st.markdown("---")

    # Load data for filter options
    df_all = load_scored_data()

    with st.form("contract_filters"):
        # Department filter
        dept_options = sorted(df_all["departamento"].dropna().unique().tolist()) \
            if "departamento" in df_all.columns and not df_all.empty else []
        filter_dept = st.multiselect(
            t("sidebar_department"),
            options=dept_options,
            default=[],
        )

        # Entity text search
        filter_entity = st.text_input(
            t("sidebar_entity"),
            value="",
        )

        # Modality filter
        mod_options = sorted(df_all["modalidad_de_contratacion"].dropna().unique().tolist()) \
            if "modalidad_de_contratacion" in df_all.columns and not df_all.empty else []
        filter_modality = st.multiselect(
            t("sidebar_modality"),
            options=mod_options,
            default=[],
        )

        # Date range
        filter_date = st.date_input(
            t("sidebar_date_range"),
            value=[],
        )

        # Risk filter
        risk_options = {
            t("risk_rojo_short"): "risk_rojo",
            t("risk_amarillo_short"): "risk_amarillo",
            t("risk_verde_short"): "risk_verde",
        }
        
        if "risk_label" in df_all.columns:
            filter_risk = st.multiselect(
                t("sidebar_risk_filter"),
                options=list(risk_options.keys()),
                default=[],
            )
        else:
            filter_risk = []

        submitted = st.form_submit_button(t("sidebar_apply"))

# ---------------------------------------------------------------------------
# Apply filters
# ---------------------------------------------------------------------------

df = df_all.copy()

if not df.empty:
    if filter_dept:
        df = df[df["departamento"].isin(filter_dept)]

    if filter_entity:
        entity_mask = pd.Series(False, index=df.index)
        for col in ("nombre_entidad", "nombre_entidad_norm", "nit_entidad", "nit_entidad_clean"):
            if col in df.columns:
                entity_mask |= df[col].astype(str).str.contains(
                    filter_entity, case=False, na=False
                )
        df = df[entity_mask]

    if filter_modality and "modalidad_de_contratacion" in df.columns:
        df = df[df["modalidad_de_contratacion"].isin(filter_modality)]

    if filter_date and len(filter_date) == 2 and "fecha_firma" in df.columns:
        fecha = pd.to_datetime(df["fecha_firma"], errors="coerce")
        df = df[
            (fecha >= pd.Timestamp(filter_date[0], tz="UTC"))
            & (fecha <= pd.Timestamp(filter_date[1], tz="UTC"))
        ]

    if filter_risk:
        risk_values = [risk_options[k] for k in filter_risk]
        if "risk_label" in df.columns:
            df = df[df["risk_label"].isin(risk_values)]

# ---------------------------------------------------------------------------
# Page title
# ---------------------------------------------------------------------------

col_title, col_status = st.columns([3, 1])
with col_title:
    st.markdown(f"<h1 style='margin-bottom:0.2rem;'>🚦 {t('nav_contrato_limpio')}</h1>", unsafe_allow_html=True)
    st.markdown(f"<p style='color: #666; font-size: 1.1rem; margin-top: 0;'>{t('phase_1_desc')}</p>", unsafe_allow_html=True)
with col_status:
    last_update, is_stale = get_staleness_info()
    if is_stale:
        st.warning(t("sidebar_staleness_warning"))
    else:
        st.markdown(
            f"<div style='text-align:right; margin-top:1.5rem;'><span style='background:#f9f9f9; border: 1px solid #eee; padding:0.4rem 0.8rem; border-radius:20px; font-size:0.85rem; color:#555;'>{t('data_updated_ago', hours=0)}</span></div>", 
            unsafe_allow_html=True
        )

st.markdown("<br>", unsafe_allow_html=True)

if df.empty:
    st.info(t("no_contracts_found"))
    st.stop()

has_scores = "risk_score" in df.columns and not df["risk_score"].isnull().all()

if not has_scores:
    st.info(f"✨ {t('ml_calculating')}")
else:
    # ---------------------------------------------------------------------------
    # Section 1 — KPIs
    # ---------------------------------------------------------------------------
    
    st.markdown(f"### {t('section_kpis')}")

    red_mask = df["risk_score"] >= RED_THRESHOLD
    total_contracts = len(df)
    red_flags = int(red_mask.sum())
    value_at_risk = float(pd.to_numeric(df.loc[red_mask, "valor_contrato"], errors="coerce").sum()) \
        if "valor_contrato" in df.columns else 0.0

    # Top entity by red flags
    if "nombre_entidad" in df.columns and red_flags > 0:
        top_entity = df.loc[red_mask, "nombre_entidad"].value_counts().index[0]
    else:
        top_entity = ""

    render_kpi_row(total_contracts, red_flags, value_at_risk, top_entity)
    
    # ---------------------------------------------------------------------------
    # Section 2 — Choropleth Map
    # ---------------------------------------------------------------------------
    
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown(f"<h3 style='margin-bottom: 0.2rem;'>{t('section_map')}</h3>", unsafe_allow_html=True)
    st.markdown(f"<p style='color: #777; font-size: 0.95rem; margin-bottom: 1.5rem;'>Promedio de riesgo algorítmico calculado a nivel departamental.</p>", unsafe_allow_html=True)
    
    if "departamento" in df.columns:
        df_dept = build_department_summary(df)
        if not df_dept.empty:
            render_choropleth(df_dept)
        else:
            st.info(t("map_calculating_msg"))
    else:
        st.info(t("map_calculating_msg"))

# ---------------------------------------------------------------------------
# Section 3 — Contracts Table
# ---------------------------------------------------------------------------

st.markdown(f"### {t('section_table')}")

display_cols = []
col_rename = {}

# Build display columns based on available data
available_mappings = {
    "risk_label": t("table_semaphore"),
    "nombre_entidad": t("table_entity"),
    "proveedor_adjudicado": t("table_provider"),
    "valor_contrato": t("table_value"),
    "modalidad_de_contratacion": t("table_modality"),
    "fecha_firma": t("table_date"),
    "departamento": t("table_department"),
    "risk_score": t("table_risk_score"),
}

for col, label in available_mappings.items():
    if col in df.columns:
        display_cols.append(col)
        col_rename[col] = label

if display_cols:
    df_display = df[display_cols].rename(columns=col_rename)

    # Sort by risk score descending
    risk_col = t("table_risk_score")
    if risk_col in df_display.columns:
        df_display = df_display.sort_values(risk_col, ascending=False)
        
    # Map risk_label to emoji string for clean display
    sem_col = t("table_semaphore")
    if sem_col in df_display.columns:
        df_display[sem_col] = df_display[sem_col].apply(
            lambda x: t(f"{x}_short") if pd.notna(x) and x in risk_options.values() else x
        )

    # Show table
    event = st.dataframe(
        df_display,
        use_container_width=True,
        height=400,
        on_select="rerun",
        selection_mode="single-row",
    )

    # Handle row selection
    if event and event.selection and event.selection.rows:
        selected_idx = event.selection.rows[0]
        original_idx = df.index[selected_idx]
        st.session_state["selected_contract"] = df.loc[original_idx].to_dict()

# ---------------------------------------------------------------------------
# Section 4 — Detail Panel
# ---------------------------------------------------------------------------

if has_scores:
    st.markdown(f"### {t('section_detail')}")

    selected = st.session_state.get("selected_contract")
    if selected and "risk_score" in selected and pd.notna(selected["risk_score"]):
        st.markdown(f"#### {selected.get('nombre_entidad', 'N/A')}")
        
        # Build SHAP explanations if available
        explanations = selected.get("shap_explanations")

        render_risk_card(
            contract=selected,
            explanations=explanations,
            lang=st.session_state.get("lang", "es"),
        )
        
        # Methodology info in simple raw format without nested expanders
        st.markdown(f"**{t('methodology_title')}**")
        st.caption(
            f"• {t('methodology_model')}<br>"
            f"• {t('methodology_features')}<br>"
            f"• {t('methodology_contamination', rate=5)}<br>"
            f"• {t('methodology_update')}", 
            unsafe_allow_html=True
        )
    else:
        st.caption("👆 Seleccione un contrato de la tabla para ver el detalle.")

# Always show disclaimer at the bottom
st.markdown("<br><br>", unsafe_allow_html=True)
render_ethical_disclaimer()
