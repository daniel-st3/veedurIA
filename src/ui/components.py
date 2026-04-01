"""
Reusable Streamlit UI components for VeedurIA ContratoLimpio.

Provides:
  - render_risk_card(): Full contract risk card with SHAP bar chart
  - render_semaphore(): Color-coded risk semaphore indicator
  - render_ethical_disclaimer(): Mandatory ethical notice
  - render_kpi_row(): 4-column KPI section with modern cards
  - render_kpi_pills(): Compact 3-pill KPI bar for header use
  - render_risk_highlights(): Top-N risk contract cards (Section C)

Usage:
    from src.ui.components import render_risk_card, render_risk_highlights

    render_risk_highlights(df, n=10, dept=None)
    render_risk_card(contract_data, explanations, lang="es")
"""

from __future__ import annotations

from typing import Any

import pandas as pd
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
    "risk_rojo": "rgba(229, 57, 53, 0.06)",
    "risk_amarillo": "rgba(253, 216, 53, 0.06)",
    "risk_verde": "rgba(67, 160, 71, 0.06)",
}


# ---------------------------------------------------------------------------
# Colombian currency parsing helper
# ---------------------------------------------------------------------------

def _parse_cop_value(raw) -> float:
    """
    Parse a Colombian peso value that may be stored as a string with
    period-as-thousand-separator (e.g. "1.500.000,00" or "1500000.0").

    Returns 0.0 on failure.
    """
    if raw is None:
        return 0.0
    if isinstance(raw, (int, float)):
        return float(raw) if pd.notna(raw) else 0.0
    s = str(raw).strip()
    if not s or s in ("nan", "None", ""):
        return 0.0
    # Colombian format: periods as thousands separators, comma as decimal
    # e.g. "1.500.000,00"  →  1500000.00
    if "," in s and "." in s:
        # Assume periods are thousands separators, comma is decimal
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        # Only comma present — treat as decimal separator
        s = s.replace(",", ".")
    elif s.count(".") > 1:
        # Multiple periods — all are thousands separators
        s = s.replace(".", "")
    try:
        return float(s)
    except ValueError:
        return 0.0


def _fmt_cop(value: float) -> str:
    """Format a COP float for display (B/M/K abbreviations)."""
    if value >= 1e12:
        return f"${value / 1e12:,.1f}B"
    if value >= 1e9:
        return f"${value / 1e9:,.1f}MM"
    if value >= 1e6:
        return f"${value / 1e6:,.1f}M"
    return f"${value:,.0f}"


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

    Flat design — no nested expanders. Includes risk score, metadata,
    SHAP bar chart, and SECOP link.
    """
    risk_label = contract.get("risk_label", "risk_verde")
    risk_score = contract.get("risk_score", 0.0)
    accent_color = RISK_COLORS.get(risk_label, "#007AFF")
    bg_color = RISK_BG_COLORS.get(risk_label, "rgba(0,0,0,0.02)")

    score_pct = int(risk_score * 100)

    st.markdown(
        f"""
        <style>
        @keyframes riskCardIn {{
            from {{ opacity: 0; transform: translateY(14px); }}
            to   {{ opacity: 1; transform: translateY(0); }}
        }}
        .risk-card-wrapper {{
            animation: riskCardIn 0.45s cubic-bezier(0.215, 0.61, 0.355, 1) both;
        }}
        </style>
        <div class="risk-card-wrapper">
        <div style="
            background: {bg_color};
            padding: 2rem;
            border-radius: 16px;
            border-left: 4px solid {accent_color};
            margin-bottom: 1.5rem;
        ">
            <div style="display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.5rem;">
                <span style="font-size: 3rem; font-weight: 800; color: #111; line-height: 1;">{score_pct}</span>
                <span style="font-size: 1.2rem; color: #888; font-weight: 400;">/100</span>
            </div>
            <p style="margin: 0; font-size: 1.1rem; font-weight: 500; color: {accent_color};">{t(risk_label)}</p>
        </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Contract metadata in a clean grid
    meta_col1, meta_col2 = st.columns(2)
    with meta_col1:
        st.markdown(f"**{t('detail_entity')}:** {contract.get('entidad', contract.get('nombre_entidad', 'N/A'))}")
        raw_val = contract.get("valor_contrato", 0)
        parsed_val = _parse_cop_value(raw_val)
        st.markdown(f"**{t('detail_value')}:** {_fmt_cop(parsed_val)} COP")
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
        font=dict(size=12, family="Inter, sans-serif"),
    )

    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

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
# KPI cards (full 4-column grid)
# ---------------------------------------------------------------------------

def render_kpi_row(
    total_contracts: int,
    red_flags: int,
    value_at_risk: float,
    top_entity: str,
) -> None:
    """
    Render the 4-column KPI section with modern glassmorphism cards.

    Cards animate in with staggered delays (GSAP timeline concept
    translated to CSS animation-delay).

    Args:
        total_contracts: Count of filtered contracts.
        red_flags:       Count where risk_score >= 0.70.
        value_at_risk:   Sum of valor_contrato where risk_score >= 0.70.
        top_entity:      Entity name with most red flags.
    """
    # Inject KPI card styles once per session
    st.markdown("""
    <style>
    @keyframes kpiSlideIn {
        from { opacity: 0; transform: translateY(18px); }
        to   { opacity: 1; transform: translateY(0); }
    }
    .kpi-card {
        background: rgba(255,255,255,0.82);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid rgba(0,0,0,0.06);
        border-radius: 16px;
        padding: 1.5rem 1.4rem 1.3rem;
        margin-bottom: 1rem;
        transition: transform 0.32s cubic-bezier(0.215, 0.61, 0.355, 1),
                    box-shadow 0.32s cubic-bezier(0.215, 0.61, 0.355, 1);
        animation: kpiSlideIn 0.55s cubic-bezier(0.215, 0.61, 0.355, 1) both;
        position: relative;
        overflow: hidden;
    }
    .kpi-card::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 3px;
        border-radius: 16px 16px 0 0;
        background: var(--kpi-accent, linear-gradient(90deg, #007AFF, #5856D6));
    }
    .kpi-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 14px 36px rgba(0,0,0,0.09);
    }
    .kpi-card-1 { animation-delay: 0.05s; }
    .kpi-card-2 { animation-delay: 0.14s; }
    .kpi-card-3 { animation-delay: 0.22s; }
    .kpi-card-4 { animation-delay: 0.30s; }
    .kpi-label {
        margin: 0 0 0.5rem 0;
        font-size: 0.78rem;
        color: #8E8E93;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }
    .kpi-value {
        margin: 0;
        font-size: 1.9rem;
        font-weight: 700;
        color: #111;
        letter-spacing: -0.03em;
        line-height: 1.15;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .kpi-value-entity {
        font-size: 1.1rem;
        font-weight: 600;
        line-height: 1.3;
        white-space: normal;
        word-break: break-word;
    }
    </style>
    """, unsafe_allow_html=True)

    c1, c2, c3, c4 = st.columns(4)

    def _card(
        title: str,
        value: str,
        klass: str = "kpi-card-1",
        accent: str = "linear-gradient(90deg,#007AFF,#5856D6)",
        value_class: str = "kpi-value",
    ) -> str:
        return (
            f'<div class="kpi-card {klass}" style="--kpi-accent:{accent}">'
            f'<p class="kpi-label">{title}</p>'
            f'<p class="{value_class}">{value}</p>'
            f'</div>'
        )

    with c1:
        st.markdown(
            _card(f"📋 {t('kpi_total_contracts')}", f"{total_contracts:,}",
                  klass="kpi-card-1",
                  accent="linear-gradient(90deg,#007AFF,#5AC8FA)"),
            unsafe_allow_html=True,
        )
    with c2:
        st.markdown(
            _card(f"🔴 {t('kpi_red_flags')}", f"{red_flags:,}",
                  klass="kpi-card-2",
                  accent="linear-gradient(90deg,#E53935,#FF7043)"),
            unsafe_allow_html=True,
        )
    with c3:
        formatted = _fmt_cop(value_at_risk)
        st.markdown(
            _card(f"💰 {t('kpi_value_at_risk')}", formatted,
                  klass="kpi-card-3",
                  accent="linear-gradient(90deg,#FF9500,#FFCC00)"),
            unsafe_allow_html=True,
        )
    with c4:
        display_entity = top_entity or "—"
        st.markdown(
            _card(f"🏢 {t('kpi_top_entity')}", display_entity,
                  klass="kpi-card-4",
                  accent="linear-gradient(90deg,#5856D6,#AF52DE)",
                  value_class="kpi-value kpi-value-entity"),
            unsafe_allow_html=True,
        )


# ---------------------------------------------------------------------------
# Compact KPI pills (for use inside the dark header bar)
# ---------------------------------------------------------------------------

def render_kpi_pills(
    total_contracts: int,
    red_flags: int,
    top_entity: str,
) -> None:
    """
    Render 3 compact pill-style KPIs for use inside the page header bar.

    Designed to stay above the fold without consuming full card height.
    """
    st.markdown("""
    <style>
    .kpi-pill-row {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        margin-top: 0.5rem;
    }
    .kpi-pill {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px;
        padding: 0.6rem 1rem;
        min-width: 120px;
    }
    .kpi-pill-label {
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(200,220,255,0.7);
        margin-bottom: 0.2rem;
    }
    .kpi-pill-value {
        font-size: 1.45rem;
        font-weight: 800;
        color: #ffffff;
        letter-spacing: -0.03em;
        line-height: 1;
    }
    .kpi-pill-value-red { color: #FF6B6B; }
    .kpi-pill-entity {
        font-size: 0.82rem;
        font-weight: 600;
        color: rgba(200,220,255,0.9);
        line-height: 1.25;
        word-break: break-word;
    }
    </style>
    """, unsafe_allow_html=True)

    entity_display = (top_entity[:28] + "…") if top_entity and len(top_entity) > 28 else (top_entity or "—")

    st.markdown(f"""
    <div class="kpi-pill-row">
        <div class="kpi-pill">
            <div class="kpi-pill-label">📋 {t('kpi_total_contracts')}</div>
            <div class="kpi-pill-value">{total_contracts:,}</div>
        </div>
        <div class="kpi-pill">
            <div class="kpi-pill-label">🔴 {t('kpi_red_flags')}</div>
            <div class="kpi-pill-value kpi-pill-value-red">{red_flags:,}</div>
        </div>
        <div class="kpi-pill">
            <div class="kpi-pill-label">🏢 {t('kpi_top_entity')}</div>
            <div class="kpi-pill-entity">{entity_display}</div>
        </div>
    </div>
    """, unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Risk Highlights — Section C
# ---------------------------------------------------------------------------

def render_risk_highlights(
    df: pd.DataFrame,
    n: int = 10,
    dept: str | None = None,
) -> None:
    """
    Render top-N risk contracts as horizontal highlight cards (Section C).

    Shows the highest-risk contracts nationally or for a selected dept.
    Clicking a card sets st.session_state["selected_contract"].

    Implements:
    - GSAP-inspired staggered card entrance (CSS animation-delay)
    - Subtle breathing glow on red cards (CSS keyframes)
    - Animated entrance on each render

    Args:
        df:   Full scored DataFrame (must have risk_score column).
        n:    Max number of cards to show (default 10).
        dept: If set, filter to this department only.
    """
    if "risk_score" not in df.columns or df.empty:
        st.markdown(
            f"<div class='empty-state'>"
            f"<div class='icon'>✨</div>"
            f"<p>{t('risk_highlights_empty_national')}</p>"
            f"</div>",
            unsafe_allow_html=True,
        )
        return

    # Filter by dept if selected
    df_work = df.copy()
    if dept:
        dept_upper = dept.strip().upper()
        if "departamento" in df_work.columns:
            df_work = df_work[
                df_work["departamento"].str.upper().str.strip() == dept_upper
            ]
        if df_work.empty:
            st.markdown(
                f"<div class='empty-state'>"
                f"<div class='icon'>🗺️</div>"
                f"<p>{t('risk_highlights_empty')}</p>"
                f"</div>",
                unsafe_allow_html=True,
            )
            return

    # Sort by risk score descending, take top-N
    df_top = df_work.sort_values("risk_score", ascending=False).head(n)

    if df_top.empty:
        st.markdown(
            f"<div class='empty-state'>"
            f"<div class='icon'>✨</div>"
            f"<p>{t('risk_highlights_empty_national')}</p>"
            f"</div>",
            unsafe_allow_html=True,
        )
        return

    # Inject styles
    st.markdown("""
    <style>
    @keyframes highlightIn {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
    }
    /* Red card breathing glow — GSAP yoyo pattern in pure CSS */
    @keyframes riskBreath {
        0%, 100% { box-shadow: 0 4px 16px rgba(229, 57, 53, 0.08); }
        50%       { box-shadow: 0 6px 28px rgba(229, 57, 53, 0.28); }
    }
    .hl-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        background: rgba(255,255,255,0.92);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(0,0,0,0.06);
        border-radius: 14px;
        padding: 1rem 1.2rem;
        margin-bottom: 0.65rem;
        cursor: pointer;
        transition: transform 0.25s cubic-bezier(0.215, 0.61, 0.355, 1),
                    box-shadow 0.25s ease;
        animation: highlightIn 0.42s cubic-bezier(0.215, 0.61, 0.355, 1) both;
    }
    .hl-card:hover {
        transform: translateX(4px);
        box-shadow: 0 8px 28px rgba(0,0,0,0.1);
    }
    .hl-card[data-risk="red"] {
        border-left: 4px solid #E53935;
        animation: highlightIn 0.42s cubic-bezier(0.215,0.61,0.355,1) both,
                   riskBreath 3s ease-in-out infinite;
    }
    .hl-card[data-risk="yellow"] {
        border-left: 4px solid #FDD835;
    }
    .hl-card[data-risk="green"] {
        border-left: 4px solid #43A047;
    }
    .hl-score-badge {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        height: 52px;
        border-radius: 12px;
        font-size: 1.1rem;
        font-weight: 800;
        flex-shrink: 0;
        letter-spacing: -0.02em;
    }
    .hl-score-red    { background: rgba(229,57,53,0.1);  color: #C62828; }
    .hl-score-yellow { background: rgba(253,216,53,0.15); color: #F57F17; }
    .hl-score-green  { background: rgba(67,160,71,0.1);  color: #2E7D32; }
    .hl-body { flex: 1; min-width: 0; }
    .hl-entity {
        font-size: 0.88rem;
        font-weight: 700;
        color: #111;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 0.1rem;
    }
    .hl-meta {
        font-size: 0.76rem;
        color: #8E8E93;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .hl-arrow {
        font-size: 1rem;
        color: #C7C7CC;
        flex-shrink: 0;
    }
    </style>
    """, unsafe_allow_html=True)

    # Render each card as a Streamlit button (invisible) with HTML overlay
    for i, (_, row) in enumerate(df_top.iterrows()):
        score = float(row.get("risk_score", 0))
        score_pct = int(score * 100)
        risk_label = str(row.get("risk_label", "risk_verde"))

        if risk_label == "risk_rojo" or score >= 0.70:
            data_risk = "red"
            badge_cls = "hl-score-red"
        elif risk_label == "risk_amarillo" or score >= 0.40:
            data_risk = "yellow"
            badge_cls = "hl-score-yellow"
        else:
            data_risk = "green"
            badge_cls = "hl-score-green"

        entity = str(row.get("nombre_entidad", row.get("entidad", "N/A")))
        if len(entity) > 50:
            entity = entity[:50] + "…"

        dept_val = str(row.get("departamento", ""))
        fecha = str(row.get("fecha_firma", ""))[:10]
        raw_val = row.get("valor_contrato", 0)
        valor = _fmt_cop(_parse_cop_value(raw_val))

        meta_parts = [x for x in [dept_val, fecha, valor] if x and x != "nan"]
        meta = " · ".join(meta_parts)

        delay = f"{i * 0.06:.2f}s"

        st.markdown(
            f"""<div class="hl-card" data-risk="{data_risk}"
                    style="animation-delay:{delay}">
                <div class="hl-score-badge {badge_cls}">{score_pct}</div>
                <div class="hl-body">
                    <div class="hl-entity">{entity}</div>
                    <div class="hl-meta">{meta}</div>
                </div>
                <div class="hl-arrow">›</div>
            </div>""",
            unsafe_allow_html=True,
        )

        # Invisible Streamlit button to capture click and set session state
        btn_key = f"hl_btn_{i}_{score_pct}_{hash(entity) % 9999}"
        if st.button(
            f"{score_pct} — {entity[:30]}",
            key=btn_key,
            help=f"Ver detalle: {entity}",
            use_container_width=True,
        ):
            st.session_state["selected_contract"] = row.to_dict()
            st.session_state["highlight_selected"] = i
