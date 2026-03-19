"""
Reusable Streamlit UI components for VeedurIA ContratoLimpio.

Provides:
  - render_risk_card(): Full contract risk card with SHAP bar chart
  - render_semaphore(): Color-coded risk semaphore indicator
  - render_ethical_disclaimer(): Mandatory ethical notice

Usage:
    from src.ui.components import render_risk_card, render_semaphore

    render_risk_card(contract_data, explanations, lang="es")
"""

from __future__ import annotations

from typing import Any

import plotly.graph_objects as go
import streamlit as st

from src.ui.i18n import t


# ---------------------------------------------------------------------------
# Color palette
# ---------------------------------------------------------------------------

RISK_COLORS = {
    "risk_rojo": "#E53935",      # Red 600
    "risk_amarillo": "#FDD835",  # Yellow 600
    "risk_verde": "#43A047",     # Green 600
}

RISK_BG_COLORS = {
    "risk_rojo": "rgba(229, 57, 53, 0.08)",
    "risk_amarillo": "rgba(253, 216, 53, 0.08)",
    "risk_verde": "rgba(67, 160, 71, 0.08)",
}


# ---------------------------------------------------------------------------
# Semaphore indicator
# ---------------------------------------------------------------------------

def render_semaphore(risk_label: str) -> None:
    """
    Render a color-coded risk semaphore.

    Args:
        risk_label: One of "risk_rojo", "risk_amarillo", "risk_verde".
    """
    color = RISK_COLORS.get(risk_label, "#757575")
    label_text = t(f"{risk_label}_short")
    st.markdown(
        f'<span style="color:{color}; font-weight:700; font-size:1.1em;">'
        f'{label_text}</span>',
        unsafe_allow_html=True,
    )


# ---------------------------------------------------------------------------
# Risk card
# ---------------------------------------------------------------------------

def render_risk_card(
    contract: dict[str, Any],
    explanations: list[dict[str, Any]] | None = None,
    lang: str = "es",
) -> None:
    """
    Render a full risk detail card for a contract.

    Includes: risk score gauge, contract metadata, SHAP bar chart,
    and SECOP link.

    Args:
        contract:     Dict with contract data (risk_score, risk_label,
                      entidad, proveedor, etc.).
        explanations: List of SHAP explanation dicts (from shap_explainer).
        lang:         Language code.
    """
    risk_label = contract.get("risk_label", "risk_verde")
    risk_score = contract.get("risk_score", 0.0)
    bg_color = RISK_BG_COLORS.get(risk_label, "transparent")

    # Card container
    st.markdown(
        f"""<div style="
            background: {bg_color};
            padding: 2rem;
            border-radius: 12px;
            margin-bottom: 1.5rem;
        ">""",
        unsafe_allow_html=True,
    )

    # Header: risk score + label
    score_pct = int(risk_score * 100)
    
    st.markdown(
        f"<h2 style='margin: 0; font-size: 2.8rem; font-weight: 800; color: #222; line-height: 1.1;'>{score_pct}<span style='font-size: 1.3rem; color: #777; font-weight: 400;'>/100</span></h2>"
        f"<h4 style='margin: 0 0 1.5rem 0; font-weight: 500; font-size: 1.2rem;'>{t(risk_label)}</h4>",
        unsafe_allow_html=True
    )

    # Contract metadata
    st.markdown("---")
    meta_col1, meta_col2 = st.columns(2)
    with meta_col1:
        st.markdown(f"**{t('detail_entity')}:** {contract.get('entidad', contract.get('nombre_entidad', 'N/A'))}")
        st.markdown(f"**{t('detail_value')}:** ${contract.get('valor_contrato', 0):,.0f} COP")
        st.markdown(f"**{t('detail_date')}:** {contract.get('fecha_firma', 'N/A')}")
    with meta_col2:
        st.markdown(f"**{t('detail_provider')}:** {contract.get('proveedor_adjudicado', 'N/A')}")
        st.markdown(f"**{t('detail_modality')}:** {contract.get('modalidad_de_contratacion', 'N/A')}")
        st.markdown(f"**{t('detail_department')}:** {contract.get('departamento', 'N/A')}")

    # SHAP bar chart
    if explanations:
        st.markdown(f"<h4 style='margin-top:1.5rem;'>{t('detail_shap_title')}</h4>", unsafe_allow_html=True)
        _render_shap_bar_chart(explanations, lang)

    # SECOP link
    secop_url = contract.get("secop_url", "")
    if secop_url:
        st.markdown("<br>", unsafe_allow_html=True)
        st.link_button(t("detail_secop_link"), url=secop_url)

    st.markdown("</div>", unsafe_allow_html=True)


def _render_shap_bar_chart(
    explanations: list[dict[str, Any]],
    lang: str = "es",
) -> None:
    """Render a horizontal bar chart of SHAP feature contributions."""
    label_key = f"label_{lang}"
    labels = [e.get(label_key, e["feature_key"]) for e in reversed(explanations)]
    values = [e["value"] for e in reversed(explanations)]
    colors = [
        "#FF3B30" if e["direction"] == "increases_risk" else "#007AFF"
        for e in reversed(explanations)
    ]

    fig = go.Figure(go.Bar(
        x=values,
        y=labels,
        orientation="h",
        marker_color=colors,
        text=[f"{v:+.3f}" for v in values],
        textposition="auto",
    ))

    fig.update_layout(
        height=max(200, 40 * len(explanations)),
        margin=dict(l=0, r=0, t=10, b=10),
        xaxis_title="SHAP value",
        yaxis_title="",
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        font=dict(size=12),
    )

    st.plotly_chart(fig, use_container_width=True)

    # Legend
    col1, col2 = st.columns(2)
    with col1:
        st.markdown(f"<span style='color: #FF3B30; font-weight:500;'>↑</span> {t('detail_shap_increases')}", unsafe_allow_html=True)
    with col2:
        st.markdown(f"<span style='color: #007AFF; font-weight:500;'>↓</span> {t('detail_shap_decreases')}", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Ethical disclaimer
# ---------------------------------------------------------------------------

def render_ethical_disclaimer() -> None:
    """Render the mandatory ethical disclaimer. Always visible."""
    st.info(t("ethical_disclaimer"))


# ---------------------------------------------------------------------------
# KPI cards
# ---------------------------------------------------------------------------

def render_kpi_row(
    total_contracts: int,
    red_flags: int,
    value_at_risk: float,
    top_entity: str,
) -> None:
    """
    Render the 4-column KPI section.

    Args:
        total_contracts: Count of filtered contracts.
        red_flags:       Count where risk_score ≥ 0.70.
        value_at_risk:   Sum of valor_contrato where risk_score ≥ 0.70.
        top_entity:      Entity name with most red flags.
    """
    c1, c2, c3, c4 = st.columns(4)

    def _card(title: str, value: str, bg_color: str = "rgba(0,0,0,0.02)"):
        return f"""
        <div style="background: {bg_color}; padding: 1.5rem 1.2rem; border-radius: 12px; margin-bottom: 2rem;">
            <p style="margin: 0; font-size: 0.95rem; color: #777; font-weight: 400; letter-spacing: -0.01em;">{title}</p>
            <h2 style="margin: 0.2rem 0 0 0; font-size: 2rem; font-weight: 700; color: #111; letter-spacing: -0.02em;">{value}</h2>
        </div>
        """

    with c1:
        st.markdown(_card(t("kpi_total_contracts"), f"{total_contracts:,}"), unsafe_allow_html=True)
    with c2:
        # Give red flags a faint red tint
        st.markdown(_card(t("kpi_red_flags"), f"{red_flags:,}", bg_color="rgba(229, 57, 53, 0.05)"), unsafe_allow_html=True)
    with c3:
        # Format as billions with B suffix
        if value_at_risk >= 1e9:
            formatted = f"${value_at_risk / 1e9:,.1f}B"
        elif value_at_risk >= 1e6:
            formatted = f"${value_at_risk / 1e6:,.1f}M"
        else:
            formatted = f"${value_at_risk:,.0f}"
        st.markdown(_card(t("kpi_value_at_risk"), formatted), unsafe_allow_html=True)
    with c4:
        st.markdown(_card(t("kpi_top_entity"), top_entity or ""), unsafe_allow_html=True)
