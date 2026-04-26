"""
Phase 3: PromesóMetroNLP — Electoral promise tracking with NLP coherence scoring.

Follows pages/1_ContratoLimpio.py structural conventions:
  - Product nav (HTML component)
  - Overview panel (kicker + title + guide + KPI pills)
  - Filter form (politician, domain, year)
  - Scorecard (left) + Promise cards panel (right)
  - Advanced filters expander
  - Evidence table expander
  - Methodology expander
  - Ethics bar (always visible)
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import streamlit as st
import streamlit.components.v1 as components

from src.ui.i18n import SUPPORTED_LANGUAGES
from src.ui.promesometro_loaders import (
    get_coherence_kpis,
    get_politicians_list,
    load_actions,
    load_coherence,
    load_promises,
)

# ── Page config ────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="PromesóMetroNLP | VeedurIA",
    page_icon="V",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── Session state ──────────────────────────────────────────────────────────────
for _k, _v in {
    "pm_politician":    None,
    "pm_domain":        "all",
    "pm_year":          2026,
    "pm_page":          0,
    "pm_adv_status":    [],
    "pm_min_conf":      0.0,
    "pm_min_sim":       0.0,
}.items():
    if _k not in st.session_state:
        st.session_state[_k] = _v


# ── Language ───────────────────────────────────────────────────────────────────
def _get_lang() -> str:
    raw = st.query_params.get("lang")
    if isinstance(raw, list):
        raw = raw[0] if raw else None
    lang = raw or st.session_state.get("lang") or "es"
    if lang not in SUPPORTED_LANGUAGES:
        lang = "es"
    st.session_state["lang"] = lang
    return lang


lang = _get_lang()

# ── i18n ───────────────────────────────────────────────────────────────────────
_I18N_DIR = Path(__file__).resolve().parent.parent / "i18n"


def _load_i18n(l: str) -> dict:
    path = _I18N_DIR / f"{l}.json"
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


t = _load_i18n(lang)


def _t(key: str, **kwargs) -> str:
    val = t.get(key, key)
    if kwargs:
        try:
            return val.format(**kwargs)
        except (KeyError, ValueError):
            return val
    return val


# ── Load data ──────────────────────────────────────────────────────────────────
df_coherence = load_coherence()
df_promises  = load_promises()

# ── CSS design tokens (matches landing page exactly) ───────────────────────────
_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@500;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
    --bg:#f7f2ea; --bg-2:#f1ebe1;
    --surface:rgba(255,255,255,0.74); --surface-strong:#fffdf8;
    --border:rgba(22,28,45,0.08); --border-strong:rgba(22,28,45,0.14);
    --text:#172033; --text-2:rgba(23,32,51,0.74); --text-m:rgba(23,32,51,0.56);
    --yellow:#d3a21a; --blue:#0d5bd7; --blue-2:#2f7cff;
    --red:#c62839; --green:#198754; --amber:#d3a21a; --grey:#6b7280;
    --shadow-sm:0 6px 24px rgba(20,30,50,0.06);
    --shadow-md:0 18px 50px rgba(20,30,50,0.10);
    --r-lg:28px; --r-md:20px; --r-sm:14px;
    --font-sans:"Inter",sans-serif;
    --font-display:"Syne",sans-serif;
    --font-mono:"JetBrains Mono",monospace;
}
/* ── Full-bleed sticky nav ─────────────────────────────────── */
.pm-nav {
    width:100%; position:sticky; top:0; z-index:100;
    display:flex; align-items:center; gap:1.5rem;
    padding:.85rem 2rem;
    background:rgba(247,242,234,0.95);
    backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
    border-bottom:1px solid var(--border); border-radius:0;
    box-shadow:0 2px 16px rgba(20,30,50,0.05);
    font-family:var(--font-sans);
    box-sizing:border-box; position:relative;
}
.pm-nav::after {
    content:""; position:absolute; bottom:0; left:0; right:0; height:3px;
    background:linear-gradient(90deg,#d3a21a 0 33.3%,#0d5bd7 33.3% 66.6%,#c62839 66.6% 100%);
}
.pm-nav-brand { font:800 1.15rem/1 var(--font-display); color:var(--text); text-decoration:none; }
.pm-nav-brand span { color:var(--blue); }
.pm-nav-links { display:flex; gap:.5rem; margin-left:auto; align-items:center; }
.pm-nav-link {
    font-size:.8rem; padding:.3rem .8rem; border-radius:8px;
    color:rgba(23,32,51,0.55); text-decoration:none; transition:color .15s;
}
.pm-nav-link:hover { color:var(--text); }
.pm-nav-muted { font-size:.8rem; padding:.3rem .8rem; border-radius:8px; color:rgba(23,32,51,0.3); }
.pm-nav-active {
    font-size:.8rem; padding:.3rem .9rem; border-radius:8px;
    color:var(--blue); font-weight:600;
    background:rgba(13,91,215,.07); border-bottom:2px solid var(--blue);
}
.pm-nav-badge {
    font:500 .58rem/1 var(--font-mono);
    background:rgba(13,91,215,.1); color:var(--blue);
    border-radius:5px; padding:2px 6px; margin-left:4px;
}
.pm-nav-badge-indigo {
    font:500 .58rem/1 var(--font-mono);
    background:rgba(99,102,241,.08); color:#818cf8;
    border-radius:5px; padding:2px 6px; margin-left:4px;
}
.pm-nav-lang {
    font:500 .75rem/1 var(--font-mono); color:rgba(23,32,51,0.48);
    text-decoration:none; margin-left:.5rem; padding:.3rem .6rem;
    border:1px solid rgba(22,28,45,0.12); border-radius:6px;
    transition:color .15s;
}
/* ── Page inner padding ────────────────────────────────────── */
.pm-page-inner { padding:0 2rem; }
@media (max-width:900px) {
    .pm-nav { padding:.7rem 1.2rem; gap:1rem; }
    .pm-page-inner { padding:0 1rem; }
}
@media (max-width:640px) {
    .pm-nav-links { gap:.25rem; }
    .pm-nav-link, .pm-nav-muted, .pm-nav-active { padding:.25rem .5rem; font-size:.72rem; }
    .pm-nav-badge, .pm-nav-badge-indigo { display:none; }
    .pm-page-inner { padding:0 .75rem; }
}
body,
[data-testid="stAppViewContainer"],
[data-testid="stMainBlockContainer"],
[data-testid="block-container"] {
    background: var(--bg) !important;
    font-family: var(--font-sans) !important;
}
[data-testid="stSidebar"] { display: none !important; }
#MainMenu, footer, header,
[data-testid="stToolbar"], [data-testid="stDecoration"] { visibility: hidden; }
.block-container { padding: 0 !important; max-width: 100% !important; }
/* Streamlit text elements inherit our font */
h1,h2,h3,h4 { font-family: var(--font-display) !important; color: var(--text) !important; }
p, label, div { font-family: var(--font-sans) !important; }
/* Expander styling */
[data-testid="stExpander"] {
    background: var(--surface-strong) !important;
    border: 1px solid var(--border) !important;
    border-radius: var(--r-sm) !important;
    margin-bottom: .75rem !important;
}
/* Form submit button */
[data-testid="stFormSubmitButton"] > button {
    background: var(--blue) !important;
    color: #fff !important;
    border-radius: 10px !important;
    font-family: var(--font-sans) !important;
    font-weight: 600 !important;
    border: none !important;
}
[data-testid="stFormSubmitButton"] > button:hover {
    background: var(--blue-2) !important;
}
/* Ethics bar */
.pm-ethics {
    background: rgba(211,162,26,0.08);
    border: 1px solid rgba(211,162,26,0.30);
    border-left: 4px solid var(--yellow);
    border-radius: var(--r-sm);
    padding: 1rem 1.4rem;
    font-size: .85rem;
    color: rgba(23,32,51,0.74);
    line-height: 1.7;
    margin: 1.75rem 0 1rem;
}
</style>
"""
st.markdown(_CSS, unsafe_allow_html=True)

# ── Product Nav ─────────────────────────────────────────────────────────────────
_NAV_HTML = f"""
<nav class="pm-nav">
  <a href="/" class="pm-nav-brand">Veedur<span>IA</span></a>
  <div class="pm-nav-links">
    <a href="/ContratoLimpio" class="pm-nav-link">{_t('nav_contrato_limpio')}</a>
    <span class="pm-nav-muted">
      {_t('nav_sigue_el_dinero')}
      <span class="pm-nav-badge-indigo">{_t('nav_phase_soon')}</span>
    </span>
    <span class="pm-nav-active">
      {_t('nav_promesometro')}
      <span class="pm-nav-badge">{_t('nav_phase_active')}</span>
    </span>
    <a href="?lang={'en' if lang=='es' else 'es'}" class="pm-nav-lang">
      {'EN' if lang=='es' else 'ES'}
    </a>
  </div>
</nav>
"""
st.markdown(_NAV_HTML, unsafe_allow_html=True)


# ── KPI helpers ────────────────────────────────────────────────────────────────
kpis = get_coherence_kpis(df_coherence)


# ── Overview panel (components.html) ──────────────────────────────────────────
_OVERVIEW_HTML = f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{{box-sizing:border-box;margin:0;padding:0;}}
body{{font-family:"Inter",sans-serif;background:#f7f2ea;
     padding:2.5rem 2.5rem 2rem;}}
.kicker{{font:500 .72rem/1 "JetBrains Mono",monospace;letter-spacing:.14em;
         text-transform:uppercase;color:#0d5bd7;margin-bottom:.85rem;}}
.title{{font:800 clamp(1.6rem,3.2vw,2.4rem)/1.1 "Syne",sans-serif;color:#172033;
        margin-bottom:.8rem;}}
.sub{{font-size:.93rem;color:rgba(23,32,51,0.72);line-height:1.7;
      max-width:820px;margin-bottom:2rem;}}
.guide{{display:flex;gap:1rem;margin-bottom:2rem;flex-wrap:wrap;}}
.step{{display:flex;align-items:flex-start;gap:.8rem;
       background:rgba(255,255,255,0.78);
       border:1px solid rgba(22,28,45,0.08);
       border-radius:20px;
       padding:1.1rem 1.3rem;
       flex:1;min-width:200px;
       box-shadow:0 6px 24px rgba(20,30,50,0.06);}}
.step-n{{font:700 1rem/1 "JetBrains Mono",monospace;color:#0d5bd7;
         min-width:1.4rem;padding-top:2px;}}
.step-t{{font:600 .82rem/1.2 "Inter",sans-serif;color:#172033;margin-bottom:.35rem;}}
.step-b{{font-size:.76rem;color:rgba(23,32,51,0.72);line-height:1.5;}}
.kpi-row{{display:flex;gap:1rem;flex-wrap:wrap;}}
.kpi{{background:rgba(255,255,255,0.78);
      border:1px solid rgba(22,28,45,0.08);
      border-radius:20px;
      padding:1.1rem 1.4rem;flex:1;min-width:140px;
      box-shadow:0 6px 24px rgba(20,30,50,0.06);}}
.kpi-v{{font:700 1.75rem/1 "Syne",sans-serif;color:#0d5bd7;margin-bottom:.35rem;}}
.kpi-l{{font:500 .68rem/1 "JetBrains Mono",monospace;
        color:rgba(23,32,51,0.54);text-transform:uppercase;letter-spacing:.1em;}}
</style></head><body>
<div class="kicker">{_t('pm_overview_kicker')}</div>
<div class="title">{_t('pm_overview_title')}</div>
<div class="sub">{_t('pm_overview_sub')}</div>
<div class="guide">
  <div class="step"><div class="step-n">1</div><div>
    <div class="step-t">{_t('pm_route_1_t')}</div>
    <div class="step-b">{_t('pm_route_1_b')}</div>
  </div></div>
  <div class="step"><div class="step-n">2</div><div>
    <div class="step-t">{_t('pm_route_2_t')}</div>
    <div class="step-b">{_t('pm_route_2_b')}</div>
  </div></div>
  <div class="step"><div class="step-n">3</div><div>
    <div class="step-t">{_t('pm_route_3_t')}</div>
    <div class="step-b">{_t('pm_route_3_b')}</div>
  </div></div>
</div>
<div class="kpi-row">
  <div class="kpi"><div class="kpi-v">{kpis['politicians_tracked']}</div>
    <div class="kpi-l">{_t('pm_kpi_politicians')}</div></div>
  <div class="kpi"><div class="kpi-v">{kpis['total_promises']}</div>
    <div class="kpi-l">{_t('pm_kpi_promises')}</div></div>
  <div class="kpi"><div class="kpi-v">{kpis['coherence_rate_pct']}%</div>
    <div class="kpi-l">{_t('pm_kpi_coherence_rate')}</div></div>
  <div class="kpi"><div class="kpi-v" style="font-size:1rem;">{kpis['freshness_label']}</div>
    <div class="kpi-l">{_t('pm_kpi_freshness')}</div></div>
</div>
</body></html>"""
components.html(_OVERVIEW_HTML, height=380, scrolling=False)


# ── Filters ────────────────────────────────────────────────────────────────────
politicians_list = get_politicians_list(df_coherence)
domain_options   = [
    _t("all_domains"),
    _t("domain_educacion"), _t("domain_salud"), _t("domain_seguridad"),
    _t("domain_economia"), _t("domain_infraestructura"), _t("domain_medio_ambiente"),
    _t("domain_justicia"), _t("domain_social"), _t("domain_otro"),
]
_DOMAIN_KEY_MAP = {
    _t("all_domains"):            "all",
    _t("domain_educacion"):       "educacion",
    _t("domain_salud"):           "salud",
    _t("domain_seguridad"):       "seguridad",
    _t("domain_economia"):        "economia",
    _t("domain_infraestructura"): "infraestructura",
    _t("domain_medio_ambiente"):  "medio_ambiente",
    _t("domain_justicia"):        "justicia",
    _t("domain_social"):          "social",
    _t("domain_otro"):            "otro",
}

with st.form("pm_filters"):
    fc1, fc2, fc3, fc4 = st.columns([4, 3, 2, 1])
    with fc1:
        pol_options = [_t("filter_politician")] + politicians_list
        pol_sel = st.selectbox(
            _t("filter_politician"), options=pol_options, label_visibility="collapsed"
        )
    with fc2:
        dom_sel = st.selectbox(
            _t("filter_domain"), options=domain_options, label_visibility="collapsed"
        )
    with fc3:
        year_sel = st.selectbox(
            _t("filter_year"), options=[2026, 2022, 2018], label_visibility="collapsed"
        )
    with fc4:
        submitted = st.form_submit_button(_t("apply_filters"), use_container_width=True)

if submitted:
    st.session_state["pm_politician"] = (
        None if pol_sel == _t("filter_politician") else pol_sel
    )
    st.session_state["pm_domain"] = _DOMAIN_KEY_MAP.get(dom_sel, "all")
    st.session_state["pm_year"]   = year_sel
    st.session_state["pm_page"]   = 0


# ── Apply filters ──────────────────────────────────────────────────────────────
def _apply_filters(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    pol    = st.session_state["pm_politician"]
    domain = st.session_state["pm_domain"]
    year   = st.session_state["pm_year"]

    if pol and "politician_id" in df.columns:
        df = df[df["politician_id"] == pol]
    if domain != "all" and "domain" in df.columns:
        df = df[df["domain"] == domain]
    if "election_year" in df.columns:
        df = df[df["election_year"] == year]

    # Advanced filters
    adv_status = st.session_state.get("pm_adv_status", [])
    min_sim    = st.session_state.get("pm_min_sim", 0.0)

    if adv_status and "status" in df.columns:
        status_map = {
            _t("pm_status_fulfilled"):   "con_accion_registrada",
            _t("pm_status_in_progress"): "en_seguimiento",
            _t("pm_status_no_action"):   "sin_accion_registrada",
        }
        raw_statuses = [status_map.get(s, s) for s in adv_status]
        df = df[df["status"].isin(raw_statuses)]
    if min_sim > 0 and "similarity_score" in df.columns:
        df = df[df["similarity_score"] >= min_sim]

    return df.reset_index(drop=True)


df_filtered = _apply_filters(df_coherence)


# ── No-data state ──────────────────────────────────────────────────────────────
_render_main = not df_coherence.empty

if not _render_main:
    st.info(_t("pm_no_data"))


# ── Main layout ────────────────────────────────────────────────────────────────
if _render_main:
    col_left, col_right = st.columns([4, 6])

    # ── Scorecard ─────────────────────────────────────────────────────────────
    with col_left:
        pol_id     = st.session_state.get("pm_politician")
        pol_group  = df_filtered if not df_filtered.empty else df_coherence
        global_score = 0.0
        if "politician_coherence_score" in pol_group.columns and not pol_group.empty:
            global_score = float(pol_group["politician_coherence_score"].iloc[0])

        n_fulfilled = int((pol_group.get("status", pd.Series(dtype=str)) == "con_accion_registrada").sum())
        n_progress  = int((pol_group.get("status", pd.Series(dtype=str)) == "en_seguimiento").sum())
        n_no_action = int((pol_group.get("status", pd.Series(dtype=str)) == "sin_accion_registrada").sum())

        # Per-domain bars
        bars_html = ""
        if "domain" in pol_group.columns and "similarity_score" in pol_group.columns:
            for dom, dg in pol_group.groupby("domain"):
                avg = float(dg["similarity_score"].mean())
                dn  = len(dg)
                pct = int(avg * 100)
                bar_color = (
                    "#198754" if avg >= 0.72 else
                    "#d3a21a" if avg >= 0.45 else
                    "#6b7280"
                )
                dom_lbl = _t(f"domain_{dom}") if f"domain_{dom}" in t else str(dom)
                bars_html += f"""
                <div style="margin-bottom:.6rem;">
                  <div style="display:flex;justify-content:space-between;
                              font-size:.75rem;color:#4a5a70;margin-bottom:.2rem;">
                    <span>{dom_lbl}</span><span>{pct}% · {dn}</span>
                  </div>
                  <div style="height:5px;background:rgba(0,0,0,.07);border-radius:3px;overflow:hidden;">
                    <div style="width:{pct}%;height:100%;background:{bar_color};border-radius:3px;"></div>
                  </div>
                </div>"""

        pol_display = pol_id or "Todos los políticos"
        global_pct  = int(global_score * 100)

        _SCORECARD_HTML = f"""<!DOCTYPE html><html><head><meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
        <style>
        *{{box-sizing:border-box;margin:0;padding:0;}}
        body{{font-family:"Inter",sans-serif;background:#f7f2ea;padding:1.2rem 1.2rem 1rem;}}
        .sc{{background:rgba(255,255,255,0.78);
             border:1px solid rgba(22,28,45,0.08);
             border-radius:24px;padding:1.6rem 1.5rem;
             box-shadow:0 6px 24px rgba(20,30,50,0.06);}}
        .sc-name{{font:600 .9rem/1.3 "Inter",sans-serif;
                  color:rgba(23,32,51,0.68);
                  margin-bottom:.6rem;word-break:break-word;}}
        .sc-global{{font:800 2.8rem/1 "Syne",sans-serif;color:#0d5bd7;margin:.6rem 0 .25rem;}}
        .sc-label{{font:500 .65rem/1 "JetBrains Mono",monospace;
                   text-transform:uppercase;letter-spacing:.12em;
                   color:rgba(23,32,51,0.54);margin-bottom:1.1rem;}}
        .sc-counts{{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1.3rem;}}
        .sc-pill{{font-size:.7rem;padding:.3rem .65rem;border-radius:8px;font-weight:600;}}
        .pill-g{{background:rgba(25,135,84,.1);color:#198754;}}
        .pill-y{{background:rgba(211,162,26,.12);color:#b8860b;}}
        .pill-gr{{background:rgba(107,114,128,.1);color:#5a6a80;}}
        .sc-dom-hdr{{font:500 .6rem/1 "JetBrains Mono",monospace;letter-spacing:.12em;
                     text-transform:uppercase;color:rgba(23,32,51,0.46);margin-bottom:.9rem;}}
        </style></head><body>
        <div class="sc">
          <div class="sc-name">{pol_display}</div>
          <div class="sc-global">{global_pct}%</div>
          <div class="sc-label">{_t('pm_scorecard_global')}</div>
          <div class="sc-counts">
            <span class="sc-pill pill-g">✓ {n_fulfilled} {_t('pm_scorecard_n_fulfilled')}</span>
            <span class="sc-pill pill-y">◑ {n_progress} {_t('pm_scorecard_n_in_progress')}</span>
            <span class="sc-pill pill-gr">○ {n_no_action} {_t('pm_scorecard_n_no_action')}</span>
          </div>
          <div class="sc-dom-hdr">Desglose por dominio</div>
          {bars_html or '<span style="font-size:.8rem;color:#5a6a80;">Sin datos de dominio.</span>'}
        </div>
        </body></html>"""
        components.html(_SCORECARD_HTML, height=540, scrolling=True)

    # ── Promise cards panel ────────────────────────────────────────────────────
    with col_right:
        CARDS_PER_PAGE = 20
        page      = st.session_state.get("pm_page", 0)
        total     = len(df_filtered)
        start_idx = page * CARDS_PER_PAGE
        end_idx   = min(start_idx + CARDS_PER_PAGE, total)
        page_df   = df_filtered.iloc[start_idx:end_idx] if not df_filtered.empty else df_filtered

        cards_html_inner = ""
        if page_df.empty:
            cards_html_inner = (
                f'<div style="padding:2rem;text-align:center;color:#4a5a6e;font-size:.9rem;">'
                f'{_t("pm_no_data")}</div>'
            )
        else:
            for _, row in page_df.iterrows():
                status   = str(row.get("status", "sin_accion_registrada"))
                sim      = float(row.get("similarity_score", 0))
                domain   = str(row.get("domain", ""))
                prom_txt = str(row.get("promise_text", ""))[:300]
                snippet  = str(row.get("evidence_snippet", ""))[:200]
                src_url  = str(row.get("source_url", ""))
                conf_val = float(row.get("extraction_confidence", 0)) if "extraction_confidence" in row.index else 0.0

                if status == "con_accion_registrada":
                    border_col = "#198754"
                    status_lbl = _t("pm_status_fulfilled")
                    status_col = "#198754"
                elif status == "en_seguimiento":
                    border_col = "#d3a21a"
                    status_lbl = _t("pm_status_in_progress")
                    status_col = "#d3a21a"
                else:
                    border_col = "#6b7280"
                    status_lbl = _t("pm_status_no_action")
                    status_col = "#6b7280"

                dom_label = _t(f"domain_{domain}") if f"domain_{domain}" in t else domain
                sim_pct   = int(sim * 100)
                conf_pct  = int(conf_val * 100)

                src_link = ""
                if src_url and src_url not in ("nan", ""):
                    src_link = (
                        f'<a href="{src_url}" target="_blank" rel="noopener noreferrer" '
                        f'style="font-size:.73rem;color:#0f52ba;">'
                        f'{_t("pm_card_source_promise")} ↗</a>'
                    )

                snippet_block = ""
                if snippet and snippet not in ("nan", ""):
                    snippet_block = (
                        f'<div style="font-size:.77rem;color:rgba(23,32,51,0.6);'
                        f'background:rgba(22,28,45,0.04);border-radius:12px;'
                        f'border-left:3px solid rgba(13,91,215,0.25);'
                        f'padding:.65rem .9rem;margin-top:.7rem;'
                        f'line-height:1.55;font-style:italic;">"{snippet}"</div>'
                    )

                cards_html_inner += f"""
                <div style="background:rgba(255,255,255,0.82);
                            border:1px solid rgba(22,28,45,0.08);
                            border-radius:20px;
                            border-left:4px solid {border_col};
                            padding:1.1rem 1.3rem;
                            margin-bottom:1rem;
                            box-shadow:0 6px 24px rgba(20,30,50,0.06);">
                  <div style="display:flex;align-items:center;gap:.6rem;
                              margin-bottom:.7rem;flex-wrap:wrap;">
                    <span style="font:500 .68rem/1 'JetBrains Mono',monospace;
                                 letter-spacing:.1em;text-transform:uppercase;
                                 background:rgba(13,91,215,.08);
                                 color:#0d5bd7;border-radius:6px;padding:3px 8px;">
                      {dom_label}</span>
                    <span style="font-size:.76rem;font-weight:600;color:{status_col};">
                      {status_lbl}</span>
                    <span style="margin-left:auto;font:400 .69rem/1 'JetBrains Mono',monospace;
                                 color:rgba(23,32,51,0.54);">
                      {_t('pm_card_similarity')} {sim_pct}%
                      &middot; {_t('pm_card_confidence')} {conf_pct}%</span>
                  </div>
                  <div style="font-size:.88rem;color:#172033;line-height:1.6;
                              margin-bottom:.6rem;">{prom_txt}</div>
                  {snippet_block}
                  <div style="display:flex;gap:.8rem;align-items:center;
                              margin-top:.8rem;flex-wrap:wrap;">
                    {src_link}
                    <span style="font-size:.69rem;color:rgba(23,32,51,0.52);
                                 line-height:1.45;flex:1;">
                      {_t('pm_card_disclaimer')}
                    </span>
                  </div>
                </div>"""

        _PANEL_HTML = f"""<!DOCTYPE html><html><head><meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
        <style>
        *{{box-sizing:border-box;margin:0;padding:0;}}
        body{{font-family:"Inter",sans-serif;background:#f7f2ea;padding:.75rem .75rem 1.5rem;}}
        </style></head><body>{cards_html_inner}</body></html>"""
        components.html(_PANEL_HTML, height=700, scrolling=True)

        # Pagination
        if total > CARDS_PER_PAGE:
            pc1, pc2, pc3 = st.columns([1, 2, 1])
            with pc1:
                if page > 0 and st.button("← Anterior"):
                    st.session_state["pm_page"] = page - 1
                    st.rerun()
            with pc2:
                st.caption(f"Página {page+1} · {start_idx+1}–{end_idx} de {total}")
            with pc3:
                if end_idx < total and st.button("Siguiente →"):
                    st.session_state["pm_page"] = page + 1
                    st.rerun()


# ── Advanced filters expander ──────────────────────────────────────────────────
with st.expander(_t("pm_adv_filters"), expanded=False):
    afc1, afc2, afc3 = st.columns(3)
    with afc1:
        status_opts = [
            _t("pm_status_fulfilled"),
            _t("pm_status_in_progress"),
            _t("pm_status_no_action"),
        ]
        adv_status = st.multiselect(_t("pm_filter_status"), options=status_opts)
    with afc2:
        adv_min_conf = st.slider(_t("pm_filter_min_confidence"), 0.0, 1.0, 0.0, 0.05)
    with afc3:
        adv_min_sim  = st.slider(_t("pm_filter_min_similarity"), 0.0, 1.0, 0.0, 0.05)

    if st.button(_t("filter_apply"), key="adv_apply"):
        st.session_state["pm_adv_status"] = adv_status
        st.session_state["pm_min_conf"]   = adv_min_conf
        st.session_state["pm_min_sim"]    = adv_min_sim
        st.rerun()


# ── Evidence table expander ────────────────────────────────────────────────────
_n_rows = len(df_filtered)
with st.expander(_t("pm_evidence_table", n=_n_rows), expanded=False):
    st.caption(_t("pm_evidence_table_caption"))

    if df_filtered.empty:
        st.info(_t("pm_no_data"))
    else:
        display_df = df_filtered.copy()
        if not df_promises.empty and "promise_id" in df_promises.columns:
            text_cols = [
                c for c in ["promise_id", "promise_text", "extraction_confidence"]
                if c in df_promises.columns
            ]
            display_df = display_df.merge(
                df_promises[text_cols], on="promise_id", how="left", suffixes=("", "_p")
            )

        table_cols = [c for c in [
            "politician_id", "domain", "promise_text",
            "status", "similarity_score", "extraction_confidence", "evidence_snippet",
        ] if c in display_df.columns]

        col_rename = {
            "politician_id":         _t("table_col_politician"),
            "domain":                _t("table_col_domain"),
            "promise_text":          _t("table_col_promise"),
            "status":                _t("table_col_status"),
            "similarity_score":      _t("table_col_similarity"),
            "extraction_confidence": _t("table_col_confidence"),
        }

        st.dataframe(
            display_df[table_cols].rename(columns=col_rename),
            use_container_width=True,
            hide_index=True,
        )


# ── Methodology expander ───────────────────────────────────────────────────────
with st.expander(_t("pm_methodology"), expanded=False):
    mc1, mc2 = st.columns(2)
    with mc1:
        st.markdown(f"**{_t('pm_method_model')}**")
        st.markdown(
            "paraphrase-multilingual-MiniLM-L12-v2 (sentence-transformers)  \n"
            "BERTopic · nr_topics=9 · min_topic_size=3  \n"
            "spaCy es_core_news_lg (NER confirmation pass)"
        )
        st.markdown(f"**{_t('pm_method_thresholds')}**")
        st.markdown(_t("pm_method_thresholds_body"))
    with mc2:
        st.markdown(f"**{_t('pm_method_limits')}**")
        st.markdown(_t("pm_method_limits_body"))
    st.caption(
        "Esta es una alerta preventiva generada automáticamente. "
        "No constituye prueba de irregularidad. "
        "Consulte los documentos del proceso antes de concluir."
    )


# ── Ethics bar (always visible) ────────────────────────────────────────────────
st.markdown(
    f'<div class="pm-ethics">{_t("pm_ethics_bar")}</div>',
    unsafe_allow_html=True,
)
