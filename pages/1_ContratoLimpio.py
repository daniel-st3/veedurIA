"""
Phase 1: ContratoLimpio v4 — Product-grade redesign
Structural redesign: product nav → compact KPIs → 2-primary filters
→ map (left) + ML-explanation + guided panel (right) → expanders.
Above-the-fold: map + ML story + top anomalies all visible without scroll.
"""

from __future__ import annotations

import glob
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
import streamlit.components.v1 as components

from src.models.isolation_forest import RED_THRESHOLD, YELLOW_THRESHOLD
from src.ui.i18n import SUPPORTED_LANGUAGES
from src.ui.data_loaders import (
    TABLE_PAGE_SIZE,
    get_total_row_count,
    load_full,
    load_preview,
)
from src.ui.maps import build_department_summary, render_plotly_choropleth

# ── SHAP feature labels (plain-language Spanish) ──────────────────────────────
try:
    from src.models.shap_explainer import FEATURE_LABELS as _SHAP_LABELS
except ImportError:
    _SHAP_LABELS: dict = {}

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="ContratoLimpio | VeedurIA",
    page_icon="V",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── Session state ─────────────────────────────────────────────────────────────
for key, default in {
    "selected_contract_json": None,
    "full_dataset": False,
    "selected_dept": None,
    "total_row_count_cache": None,
}.items():
    if key not in st.session_state:
        st.session_state[key] = default


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
is_es = lang == "es"

copy = {
    "es": {
        "nav_p1": "P1 ContratoLimpio",
        "nav_p2": "P2 SigueElDinero",
        "nav_p3": "P3 PromesómetroNLP",
        "soon": "Pronto",
        "overview_kicker": "Fase 1 activa · SECOP II",
        "overview_title": "ContratoLimpio para entender antes de concluir",
        "overview_sub": "Esta fase no busca acusar automaticamente. Ordena los contratos que mas se salen del patron historico, explica que señales empujaron ese puntaje y te lleva a SECOP II para revisar el caso con documentos y contexto.",
        "route_1_t": "Empieza simple", "route_1_b": "Filtra por territorio o por riesgo. No necesitas configurar todo para encontrar una pista util.",
        "route_2_t": "Lee el mapa como panorama", "route_2_b": "Un clic en un departamento reorganiza la exploracion y reduce el ruido en la lista.",
        "route_3_t": "Abre un caso y verifica", "route_3_b": "Usa la explicacion del modelo como punto de partida, no como conclusion final.",
        "stat_1_l": "Contratos analizados", "stat_1_b": "Base disponible para encontrar señales anómalas.",
        "stat_2_l": "Alertas rojas", "stat_2_b": "Contratos que merecen una segunda mirada.",
        "stat_3_l": "Valor priorizado", "stat_3_b": "Monto asociado a la franja roja actual.",
        "stat_4_l": "Estado del dato", "stat_4_b": "La lectura siempre depende de la calidad y vigencia de SECOP II.",
        "controls_title": "Empieza con un filtro simple",
        "controls_copy": "Primero territorio, luego nivel de riesgo. Los filtros avanzados quedan abajo si necesitas afinar más.",
        "dept": "Departamento",
        "risk": "Nivel de riesgo",
        "apply": "Aplicar filtros",
        "chip_map": "Mapa",
        "chip_dept": "Departamento",
        "chip_risk": "Riesgo",
        "preview": "Vista rápida: {shown} contratos recientes de {total}. Cambia a historial completo en Filtros avanzados.",
        "empty_none": "Sin contratos con estos filtros. Amplia la búsqueda.",
        "empty_ml": "Los puntajes de riesgo se están calculando. Recarga en unos minutos.",
        "map_eyebrow": "Radar de riesgo · Colombia",
        "map_hint": "Haz clic en un departamento para concentrar la exploración",
        "clear": "limpiar",
        "panel_scope_country": "Casos para empezar · Colombia",
        "panel_scope_dept": "Casos para empezar · {dept}",
        "panel_copy": "Esta no es una lista bruta. Mezcla puntaje, monto y recencia para proponerte por dónde empezar el filtro actual.",
        "slice_red": "alertas rojas", "slice_red_copy": "Contratos con prioridad alta en este corte.",
        "slice_value": "valor priorizado", "slice_value_copy": "Monto agregado de la franja roja visible.",
        "slice_dept": "territorio dominante", "slice_dept_copy": "Departamento con más contratos en la vista actual.",
        "ml_banner_model": "IF Isolation Forest",
        "ml_banner_vars": "25 variables",
        "ml_banner_rate": "5% tasa de anomalía",
        "ml_banner_note": "Puntaje alto = inusual, no irregular. Verifica siempre en SECOP II — el modelo prioriza, tú decides.",
        "guide_title": "Cómo explorar",
        "guide_1": "Selecciona un departamento en el mapa",
        "guide_2": "Abre un caso para ver por qué subió",
        "guide_3": "Verifica en SECOP II con el enlace oficial",
        "pick_start": "Empieza aquí",
        "pick_value": "Riesgo alto + monto relevante",
        "pick_recent": "Caso reciente",
        "pick_signal": "Señal fuerte del modelo",
        "signal_fallback": "Se sale del patrón histórico",
        "label_red": "Patrón muy inusual",
        "label_yellow": "Patrón atípico",
        "label_green": "Sin banderas detectadas",
        "shap_title": "Factores que elevaron el puntaje",
        "shap_hint": "Barras rojas = más inusual · verdes = más típico",
        "why_here": "Por qué está aquí:",
        "detail_entity": "Entidad",
        "detail_provider": "Proveedor",
        "detail_value": "Valor del contrato",
        "detail_mod": "Modalidad",
        "detail_date": "Fecha de firma",
        "detail_dept": "Departamento",
        "detail_link": "Ver contrato en SECOP II",
        "ethics_short": "Alerta preventiva — no es una acusación. Revisa el contrato en SECOP II y forma tu propia conclusión.",
        "adv_filters": "Filtros avanzados",
        "adv_caption": "Busca por entidad, modalidad o carga el historial completo.",
        "adv_entity": "Buscar entidad / NIT",
        "adv_entity_ph": "nombre o NIT...",
        "adv_mod": "Modalidad",
        "adv_apply": "Aplicar filtros avanzados",
        "load_full": "Cargar historial completo",
        "load_preview": "Volver a vista rápida",
        "summary_exp": "Panorama del corte actual",
        "summary_cap": "Antes de abrir contrato por contrato, mira quién concentra alertas y qué modalidades aparecen más arriba en este filtro.",
        "summary_entities": "Entidades que más te conviene revisar",
        "summary_mods": "Modalidades con riesgo medio más alto",
        "table_exp": "Base contractual del corte · {n} filas",
        "table_cap": "Solo para bajar al detalle o contrastar la selección. La lectura principal del producto está arriba: mapa, casos sugeridos y explicación del modelo.",
        "method_exp": "Metodología del modelo",
        "ethics_bar": "<strong>Aviso ético:</strong> Este análisis es informativo y no constituye prueba de irregularidad. Un puntaje de riesgo alto señala un patrón inusual, no confirma conductas indebidas. Consulte siempre los documentos del proceso en la fuente oficial <strong>SECOP II</strong> antes de concluir.",
        "all": "Todos",
        "risk_all": "Todo el espectro",
        "risk_high": "Alto",
        "risk_medium": "Medio",
        "risk_low": "Bajo",
        "active_map_prefix": "Mapa",
        "active_dept_prefix": "Departamento",
        "active_risk_prefix": "Riesgo",
        "unavailable": "No disponible",
        "freshness_unknown": "Estado desconocido",
        "freshness_stale": "Datos desactualizados",
        "freshness_updated": "Actualizado hace {hours}h",
        "table_col_risk": "Riesgo",
        "table_col_entity": "Entidad",
        "table_col_provider": "Proveedor",
        "table_col_value": "Valor (COP)",
        "table_col_mod": "Modalidad",
        "table_col_date": "Fecha firma",
        "table_col_dept": "Departamento",
        "summary_col_contracts": "Contratos",
        "summary_col_mean": "Riesgo medio",
        "summary_col_max": "Riesgo máximo",
        "method_model": "¿Qué modelo se usa?",
        "method_model_body": "Isolation Forest (scikit-learn) — algoritmo de detección de anomalías no supervisado.",
        "method_analyzes": "¿Qué analiza?",
        "method_score": "¿Qué significa el puntaje?",
        "method_score_body": "Un número de 0 a 100 que mide qué tan inusual es el contrato respecto al patrón histórico de SECOP II.",
        "method_scale": "**≥70** — Patrón muy atípico, requiere revisión · **40–69** — Patrón atípico moderado · **<40** — Sin banderas.",
        "method_trained": "¿Cuándo se entrenó?",
        "method_trained_body": "El modelo se reentrena semanalmente con datos actualizados de SECOP II.",
        "method_validated": "¿Se validó el modelo?",
        "method_validated_body": "Sí. {passed} de {total} casos de referencia detectados correctamente (UNGRD carrotanques, Manizales directos, Pasaportes Colombia).",
        "method_limits": "Limitaciones importantes",
        "method_limits_body": "El modelo no tiene acceso al contexto institucional ni a documentos del proceso. Un puntaje alto identifica contratos estadísticamente inusuales — no confirma irregularidades. Siempre es necesario revisar los documentos en SECOP II.",
        "method_source": "Fuente de datos",
        "lang_es": "ES",
        "lang_en": "EN",
    },
    "en": {
        "nav_p1": "P1 ContratoLimpio",
        "nav_p2": "P2 SigueElDinero",
        "nav_p3": "P3 PromesometroNLP",
        "soon": "Soon",
        "overview_kicker": "Phase 1 active · SECOP II",
        "overview_title": "ContratoLimpio to understand before concluding",
        "overview_sub": "This phase is not designed to accuse automatically. It orders the contracts that break the historical pattern the most, explains which signals pushed that score up, and takes you to SECOP II to review the case with documents and context.",
        "route_1_t": "Start simple", "route_1_b": "Filter by territory or by risk. You do not need to configure everything to find a useful lead.",
        "route_2_t": "Read the map as overview", "route_2_b": "One click on a department reorganizes the exploration and reduces noise in the list.",
        "route_3_t": "Open one case and verify", "route_3_b": "Use the model explanation as a starting point, not as a final conclusion.",
        "stat_1_l": "Contracts analyzed", "stat_1_b": "Available base for spotting anomalous signals.",
        "stat_2_l": "Red alerts", "stat_2_b": "Contracts that deserve a second look.",
        "stat_3_l": "Prioritized value", "stat_3_b": "Amount associated with the current red slice.",
        "stat_4_l": "Data status", "stat_4_b": "Reading always depends on SECOP II quality and freshness.",
        "controls_title": "Start with a simple filter",
        "controls_copy": "First territory, then risk level. Advanced filters remain below if you need to refine further.",
        "dept": "Department",
        "risk": "Risk level",
        "apply": "Apply filters",
        "chip_map": "Map",
        "chip_dept": "Department",
        "chip_risk": "Risk",
        "preview": "Quick view: {shown} recent contracts out of {total}. Switch to full history in Advanced filters.",
        "empty_none": "No contracts match these filters. Widen the search.",
        "empty_ml": "Risk scores are still being computed. Reload in a few minutes.",
        "map_eyebrow": "Risk surface · Colombia",
        "map_hint": "Click a department to focus the exploration",
        "clear": "clear",
        "panel_scope_country": "Lead cases · Colombia",
        "panel_scope_dept": "Lead cases · {dept}",
        "panel_copy": "This is not a raw list. It combines score, value, and recency to suggest where to start inside the current slice.",
        "slice_red": "red alerts", "slice_red_copy": "High-priority contracts in this view.",
        "slice_value": "prioritized value", "slice_value_copy": "Aggregate amount of the visible red slice.",
        "slice_dept": "dominant territory", "slice_dept_copy": "Department with the most contracts in the current view.",
        "ml_banner_model": "IF Isolation Forest",
        "ml_banner_vars": "25 variables",
        "ml_banner_rate": "5% anomaly rate",
        "ml_banner_note": "High score = unusual, not irregular. Always verify in SECOP II — the model prioritizes, you decide.",
        "guide_title": "How to explore",
        "guide_1": "Select a department on the map",
        "guide_2": "Open one case to see why it rose",
        "guide_3": "Verify in SECOP II using the official link",
        "pick_start": "Start here",
        "pick_value": "High risk + relevant value",
        "pick_recent": "Recent case",
        "pick_signal": "Strong model signal",
        "signal_fallback": "Breaks the historical pattern",
        "label_red": "Highly unusual pattern",
        "label_yellow": "Atypical pattern",
        "label_green": "No flags detected",
        "shap_title": "Factors that raised the score",
        "shap_hint": "Red bars = more unusual · green = more typical",
        "why_here": "Why it is here:",
        "detail_entity": "Entity",
        "detail_provider": "Provider",
        "detail_value": "Contract value",
        "detail_mod": "Modality",
        "detail_date": "Signing date",
        "detail_dept": "Department",
        "detail_link": "View contract in SECOP II",
        "ethics_short": "Preventive alert — not an accusation. Review the contract in SECOP II and form your own conclusion.",
        "adv_filters": "Advanced filters",
        "adv_caption": "Search by entity, modality, or load the full history.",
        "adv_entity": "Search entity / NIT",
        "adv_entity_ph": "name or NIT...",
        "adv_mod": "Modality",
        "adv_apply": "Apply advanced filters",
        "load_full": "Load full history",
        "load_preview": "Back to quick view",
        "summary_exp": "Current slice overview",
        "summary_cap": "Before opening contract by contract, look at which entities concentrate alerts and which modalities rise to the top in this filter.",
        "summary_entities": "Entities worth reviewing first",
        "summary_mods": "Modalities with the highest mean risk",
        "table_exp": "Contract base for this slice · {n} rows",
        "table_cap": "Only for drilling down or cross-checking the selection. The main reading of the product is above: map, suggested cases, and model explanation.",
        "method_exp": "Model methodology",
        "ethics_bar": "<strong>Ethical notice:</strong> This analysis is informational and does not constitute evidence of wrongdoing. A high risk score signals an unusual pattern, not confirmed misconduct. Always review the process documents in the official <strong>SECOP II</strong> source before concluding.",
        "all": "All",
        "risk_all": "Full spectrum",
        "risk_high": "High",
        "risk_medium": "Medium",
        "risk_low": "Low",
        "active_map_prefix": "Map",
        "active_dept_prefix": "Department",
        "active_risk_prefix": "Risk",
        "unavailable": "Not available",
        "freshness_unknown": "Unknown status",
        "freshness_stale": "Data is stale",
        "freshness_updated": "Updated {hours}h ago",
        "table_col_risk": "Risk",
        "table_col_entity": "Entity",
        "table_col_provider": "Provider",
        "table_col_value": "Value (COP)",
        "table_col_mod": "Modality",
        "table_col_date": "Signing date",
        "table_col_dept": "Department",
        "summary_col_contracts": "Contracts",
        "summary_col_mean": "Mean risk",
        "summary_col_max": "Max risk",
        "method_model": "Which model is used?",
        "method_model_body": "Isolation Forest (scikit-learn) — unsupervised anomaly detection algorithm.",
        "method_analyzes": "What does it analyze?",
        "method_score": "What does the score mean?",
        "method_score_body": "A 0 to 100 number that measures how unusual the contract looks against the historical SECOP II pattern.",
        "method_scale": "**≥70** — Highly atypical pattern, review first · **40–69** — Moderately atypical pattern · **<40** — No flags.",
        "method_trained": "When was it trained?",
        "method_trained_body": "The model is retrained weekly with updated SECOP II data.",
        "method_validated": "Was the model validated?",
        "method_validated_body": "Yes. {passed} out of {total} reference cases were correctly detected (UNGRD tanker trucks, direct Manizales awards, Colombia passports).",
        "method_limits": "Important limitations",
        "method_limits_body": "The model does not have access to institutional context or process documents. A high score identifies statistically unusual contracts — it does not confirm wrongdoing. Reviewing the documents in SECOP II is always necessary.",
        "method_source": "Data source",
        "lang_es": "ES",
        "lang_en": "EN",
    },
}[lang]

home_url = f"/?lang={lang}"

# ── Global CSS — design token system + responsive ─────────────────────────────
st.markdown(r"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

/* ── Design tokens ── */
:root {
  --bg:       #f7f2ea;
  --bg-s:     rgba(255,255,255,0.76);
  --bg-h:     rgba(255,255,255,0.92);
  --border:   rgba(23,32,51,0.08);
  --bdr-h:    rgba(23,32,51,0.14);
  --text:     #172033;
  --text-2:   rgba(23,32,51,0.70);
  --text-m:   rgba(23,32,51,0.44);
  --blue:     #0d5bd7;
  --r-red:    #c62839;
  --r-yellow: #d3a21a;
  --r-green:  #198754;
  --r-sm: 12px; --r-md: 18px; --r-lg: 26px;
  --sp-1: 0.5rem; --sp-2: 1rem; --sp-3: 1.5rem;
  --shadow-sm: 0 10px 30px rgba(20,30,50,0.06);
  --shadow-md: 0 22px 50px rgba(20,30,50,0.10);
}

/* ── Streamlit chrome removal ── */
*, *::before, *::after { box-sizing: border-box; }
#MainMenu, footer, header,
[data-testid="stToolbar"], [data-testid="stDecoration"],
[data-testid="stStatusWidget"], [data-testid="stSidebar"],
[data-testid="collapsedControl"], [data-testid="stSidebarNav"],
[data-testid="stSidebarCollapsedControl"],
.stDeployButton,
button[kind="headerNoPadding"],
section[data-testid="stSidebar"] + div > button,
.css-1544g2n, .css-ffhzg2, .css-1rs6os,
div[data-testid="collapsedControl"],
.stApp > div > button:first-child { display: none !important; }

.stApp {
  font-family:'Inter',sans-serif !important;
  background:
    radial-gradient(circle at top left, rgba(211,162,26,0.10), transparent 28%),
    radial-gradient(circle at bottom right, rgba(13,91,215,0.08), transparent 22%),
    var(--bg) !important;
  color:var(--text) !important;
}
.block-container { padding:0.8rem 1.8rem 3rem !important; max-width:1340px !important; }

/* ── Product nav ── */
.vd-nav {
  display:flex; align-items:center; gap:1.2rem; flex-wrap:wrap;
  padding:0.8rem 1rem;
  border:1px solid var(--border);
  border-radius:20px;
  background:rgba(255,255,255,0.72);
  backdrop-filter:blur(14px);
  box-shadow:var(--shadow-sm);
  margin-bottom:1rem;
}
.vd-nav-brand {
  font-family:'Syne',sans-serif; font-weight:800; font-size:1.05rem;
  color:#fff; text-decoration:none; letter-spacing:-0.02em;
}
.vd-nav-brand span { color:var(--blue); }
.vd-nav-sep { color:var(--text-m); font-size:0.75rem; }
.vd-nav-phases { display:flex; align-items:center; gap:0.85rem; flex-wrap:wrap; }
.vd-phase {
  display:inline-flex; align-items:center; gap:5px;
  font-family:'Inter',sans-serif; font-size:0.78rem; font-weight:500;
  padding:4px 0; position:relative;
}
.vd-phase.active { color:var(--text); border-bottom:2px solid var(--blue); padding-bottom:2px; }
.vd-phase.upcoming { color:var(--text-m); cursor:default; }
.vd-phase .phase-dot {
  width:6px; height:6px; border-radius:50%; background:var(--r-green);
  animation:phaseDot 2.2s ease-in-out infinite;
}
@keyframes phaseDot {
  0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,0.7);}
  50%{box-shadow:0 0 0 5px rgba(74,222,128,0);}
}
.soon-badge {
  display:inline-block; padding:1px 6px; border-radius:4px;
  font-size:0.58rem; font-weight:700; letter-spacing:0.06em;
  background:rgba(211,162,26,0.10); color:var(--r-yellow);
  border:1px solid rgba(211,162,26,0.16); text-transform:uppercase;
}
.nav-back {
  font-family:'JetBrains Mono',monospace; font-size:0.72rem;
  color:rgba(13,91,215,0.78); text-decoration:none;
  letter-spacing:0.04em;
  transition:color 0.18s;
}
.nav-back:hover { color:var(--blue); }
.nav-lang {
  margin-left:auto; display:inline-flex; align-items:center; gap:0.2rem;
  padding:0.2rem; border-radius:999px; background:rgba(255,255,255,0.82);
  border:1px solid var(--border);
}
.nav-lang a {
  min-width:40px; height:30px; display:inline-flex; align-items:center; justify-content:center;
  border-radius:999px; text-decoration:none; color:var(--text-m);
  font-family:'JetBrains Mono',monospace; font-size:0.68rem; letter-spacing:0.08em;
}
.nav-lang a.active { background:rgba(13,91,215,0.10); color:var(--blue); }

.phase-hero {
  display:grid; grid-template-columns:minmax(0,1.05fr) minmax(340px,0.95fr); gap:1rem;
  margin-bottom:1rem;
}
.phase-card {
  border:1px solid var(--border);
  border-radius:24px;
  background:rgba(255,255,255,0.78);
  box-shadow:var(--shadow-sm);
  padding:1.35rem 1.4rem 1.25rem;
  position:relative;
  overflow:hidden;
}
.phase-card::before {
  content:""; position:absolute; top:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg,var(--r-yellow) 0 34%, var(--blue) 34% 68%, var(--r-red) 68% 100%);
}
.phase-kicker {
  font-family:'JetBrains Mono',monospace; font-size:0.66rem; letter-spacing:0.14em;
  text-transform:uppercase; color:var(--blue); margin-bottom:0.8rem;
}
.phase-title {
  font-family:'Syne',sans-serif; font-size:clamp(1.95rem, 4vw, 3.1rem);
  line-height:0.98; letter-spacing:-0.05em; margin-bottom:0.55rem;
}
.phase-title .flag-word {
  background:linear-gradient(90deg,var(--r-yellow) 0 30%, var(--blue) 30% 70%, var(--r-red) 70% 100%);
  -webkit-background-clip:text; background-clip:text; color:transparent;
}
.phase-sub {
  font-size:0.95rem; line-height:1.68; color:var(--text-2); max-width:640px;
}
.phase-steps {
  display:grid; grid-template-columns:1fr; gap:0.75rem;
}
.phase-step {
  display:flex; gap:0.75rem; align-items:flex-start;
  padding:0.9rem 1rem; border-radius:18px; background:rgba(247,242,234,0.86);
  border:1px solid rgba(23,32,51,0.06);
}
.phase-step-n {
  width:24px; height:24px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  background:rgba(13,91,215,0.10); color:var(--blue);
  font-family:'JetBrains Mono',monospace; font-size:0.68rem; font-weight:600; flex-shrink:0;
}
.phase-step b { display:block; font-size:0.82rem; margin-bottom:0.15rem; }
.phase-step span:last-child { font-size:0.8rem; line-height:1.5; color:var(--text-2); }

.control-shell,
.map-shell,
.expander-shell {
  border:1px solid var(--border);
  border-radius:24px;
  background:rgba(255,255,255,0.66);
  box-shadow:var(--shadow-sm);
}
.control-shell {
  padding:0.1rem 0 0.6rem; margin-bottom:0.55rem;
  border:none; border-radius:0; background:transparent; box-shadow:none;
}
.control-head {
  display:flex; align-items:flex-start; justify-content:space-between; gap:1rem;
  margin-bottom:0.75rem;
}
.control-title {
  font-family:'Syne',sans-serif; font-size:1.05rem; letter-spacing:-0.03em;
  margin-bottom:0.18rem;
}
.control-copy {
  font-size:0.8rem; color:var(--text-2); line-height:1.5;
}
.active-filter-row {
  display:flex; flex-wrap:wrap; gap:0.55rem; margin-top:0.15rem;
}
.active-chip {
  display:inline-flex; align-items:center; gap:0.35rem;
  padding:0.45rem 0.68rem; border-radius:999px;
  background:rgba(13,91,215,0.08); color:var(--blue); border:1px solid rgba(13,91,215,0.10);
  font-size:0.74rem; font-weight:600;
}
.map-shell { padding:0.9rem 0.9rem 0.8rem; position:relative; overflow:hidden; }
.map-shell::before {
  content:""; position:absolute; top:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg,var(--r-yellow) 0 34%, var(--blue) 34% 68%, var(--r-red) 68% 100%);
}
.map-shell::after {
  content:""; position:absolute; inset:auto -20% 18% -20%; height:120px;
  background:linear-gradient(90deg, transparent, rgba(13,91,215,0.08), transparent);
  transform:translateX(-35%);
  animation:mapSweep 6s linear infinite;
  pointer-events:none;
}
@keyframes mapSweep {
  from { transform:translateX(-35%); }
  to { transform:translateX(35%); }
}

/* ── Expanders ── */
.stExpander {
  background:rgba(255,255,255,0.78) !important;
  border:1px solid var(--border) !important;
  border-radius:var(--r-lg) !important;
  box-shadow:var(--shadow-sm) !important;
}
.stExpander summary { color:var(--text) !important; font-family:'Inter',sans-serif !important; font-weight:600 !important; }

/* ── Dataframe ── */
[data-testid="stDataFrame"] { border-radius:18px; overflow:hidden; border:1px solid var(--border); }

/* ── Buttons ── */
div[data-testid="stButton"] > button {
  background:rgba(13,91,215,0.07) !important;
  border:1px solid rgba(13,91,215,0.18) !important;
  color:var(--blue) !important; border-radius:var(--r-sm) !important;
  font-family:'Inter',sans-serif !important; font-size:0.83rem !important;
  font-weight:600 !important; padding:0.48rem 1.1rem !important;
  transition:background 0.2s,transform 0.2s, box-shadow 0.2s !important;
}
div[data-testid="stButton"] > button:hover {
  background:rgba(13,91,215,0.12) !important; transform:translateY(-1px) !important;
  box-shadow:0 8px 20px rgba(13,91,215,0.10) !important;
}

/* ── Inputs ── */
input, textarea, [data-baseweb="select"] > div,
.stTextInput input, [data-testid="stNumberInput"] input {
  background:rgba(255,255,255,0.86) !important;
  border:1px solid var(--border) !important;
  border-radius:var(--r-sm) !important;
  color:var(--text) !important;
}
[data-baseweb="select"] > div {
  min-height:46px !important;
  box-shadow:0 10px 20px rgba(20,30,50,0.04) !important;
}
[data-baseweb="popover"] *, [data-baseweb="menu"] {
  background:#fffdf8 !important; color:var(--text) !important;
}

/* ── Form submit button ── */
div[data-testid="stFormSubmitButton"] > button {
  background:linear-gradient(135deg,var(--blue),#2f7cff) !important;
  border:1px solid rgba(13,91,215,0.28) !important;
  color:#fff !important; font-weight:600 !important;
  min-height:42px !important;
  width:100% !important;
  box-shadow:0 12px 24px rgba(13,91,215,0.18) !important;
}
div[data-testid="stFormSubmitButton"] > button:hover {
  background:linear-gradient(135deg,#0b51c1,#1f74ff) !important;
  transform:translateY(-1px) !important;
}

/* ── Map label eyebrow ── */
.map-eyebrow {
  font-family:'JetBrains Mono',monospace; font-size:0.63rem;
  letter-spacing:0.13em; text-transform:uppercase; color:var(--blue);
  margin-bottom:0.3rem;
}
.map-hint {
  font-size:0.68rem; color:var(--text-m); text-align:center;
  font-family:'JetBrains Mono',monospace; letter-spacing:0.04em;
  margin-top:0.35rem;
}
.dept-tag {
  display:inline-flex; align-items:center; gap:5px;
  font-family:'JetBrains Mono',monospace; font-size:0.7rem;
  color:rgba(13,91,215,0.80); background:rgba(13,91,215,0.07);
  border:1px solid rgba(13,91,215,0.12); border-radius:999px;
  padding:3px 10px; margin-bottom:0.4rem;
}

/* ── Ethics bar ── */
.ethics-bar {
  background:rgba(211,162,26,0.07);
  border:1px solid rgba(211,162,26,0.16);
  border-radius:var(--r-md); padding:1rem 1.2rem;
  font-size:0.83rem; color:rgba(110,78,0,0.88); line-height:1.65;
  margin-top:1.2rem;
  box-shadow:var(--shadow-sm);
}

/* ── Filter label style ── */
.stCaption { color:var(--text-m) !important; font-size:0.73rem !important; }

/* ── Preview banner ── */
.preview-note {
  font-family:'JetBrains Mono',monospace; font-size:0.66rem;
  color:var(--text-m); margin-top:0.25rem;
}

/* ── Accessibility: reduce motion ── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration:0.01ms !important;
    transition-duration:0.01ms !important;
  }
}

/* ── Responsive: tablet / mobile ── */
@media (max-width:900px) {
  .vd-nav { gap:0.75rem; }
  .vd-nav-phases { gap:0.6rem; }
  .block-container { padding:0.5rem 1rem 2.5rem !important; }
  .phase-hero { grid-template-columns:1fr; }
}
@media (max-width:640px) {
  .vd-phase { font-size:0.72rem; }
  .soon-badge { display:none; }
}
</style>
""", unsafe_allow_html=True)

# ── Paths ─────────────────────────────────────────────────────────────────────
PROJECT_ROOT    = Path(__file__).resolve().parent.parent
DATA_PROCESSED  = PROJECT_ROOT / "data" / "processed"
LAST_RUN_PATH   = DATA_PROCESSED / "last_run.json"
MODEL_META_DIR  = DATA_PROCESSED / "models"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_cop(raw: Any) -> float:
    if raw is None:
        return 0.0
    if isinstance(raw, (int, float)):
        v = float(raw)
        return v if pd.notna(v) else 0.0
    s = str(raw).strip()
    if not s or s.lower() in ("nan", "none", "", "null"):
        return 0.0
    s = re.sub(r"[\$\s€]", "", s)
    if not s:
        return 0.0
    try:
        if "e" in s.lower() and "." in s:
            return float(s)
        if s.count(".") > 1:
            s = s.replace(".", "").replace(",", ".")
        elif "," in s and "." in s:
            last_dot, last_comma = s.rfind("."), s.rfind(",")
            if last_comma > last_dot:
                s = s.replace(".", "").replace(",", ".")
            else:
                s = s.replace(",", "")
        elif "," in s:
            parts = s.split(",")
            s = s.replace(",", ".") if len(parts) == 2 and len(parts[1]) <= 2 else s.replace(",", "")
        return float(s)
    except (ValueError, AttributeError):
        return 0.0


def _fmt_cop(v: float) -> str:
    if v <= 0:
        return copy["unavailable"]
    if v >= 1e12:
        return f"${v/1e12:,.2f}B COP"
    if v >= 1e9:
        return f"${v/1e9:,.2f}MM COP"
    if v >= 1e6:
        return f"${v/1e6:,.1f}M COP"
    return f"${v:,.0f} COP"


def _staleness() -> tuple[float, bool]:
    if LAST_RUN_PATH.exists():
        try:
            with open(LAST_RUN_PATH) as f:
                data = json.load(f)
            ts = data.get("last_run_ts")
            if ts:
                hours = (datetime.now(timezone.utc) - datetime.fromisoformat(ts)).total_seconds() / 3600
                return hours, hours > 6
        except Exception:
            pass
    return -1.0, True


def _value_at_risk(df: pd.DataFrame) -> float:
    if "risk_score" not in df.columns or "valor_contrato" not in df.columns:
        return 0.0
    red = df[df["risk_score"] >= RED_THRESHOLD]
    if red.empty:
        return 0.0
    return red["valor_contrato"].apply(_parse_cop).sum()


def _load_model_meta() -> dict:
    try:
        files = sorted(glob.glob(str(MODEL_META_DIR / "*_metadata.json")))
        if files:
            with open(files[-1]) as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def _safe_date(value: Any) -> pd.Timestamp:
    """Parse dates for ranking logic without raising."""
    try:
        dt = pd.to_datetime(value, errors="coerce")
        return dt if pd.notna(dt) else pd.Timestamp("1970-01-01")
    except Exception:
        return pd.Timestamp("1970-01-01")


def _risk_option_map() -> dict[str, str | None]:
    return {
        copy["risk_all"]: None,
        copy["risk_high"]: "risk_rojo",
        copy["risk_medium"]: "risk_amarillo",
        copy["risk_low"]: "risk_verde",
    }


# ── Data loading ──────────────────────────────────────────────────────────────
if st.session_state["full_dataset"]:
    df_all = load_full()
    is_preview = False
else:
    df_all = load_preview()
    is_preview = True

if st.session_state["total_row_count_cache"] is None:
    st.session_state["total_row_count_cache"] = get_total_row_count()
total_in_file: int = st.session_state["total_row_count_cache"]

df_dept_national = (
    build_department_summary(df_all)
    if "departamento" in df_all.columns else pd.DataFrame()
)
has_scores = (
    "risk_score" in df_all.columns
    and not df_all["risk_score"].isnull().all()
    and len(df_all) > 0
)

hours_ago, is_stale = _staleness()
freshness_color  = "#fbbf24" if is_stale else "#4ade80"
freshness_label  = (
    copy["freshness_unknown"] if hours_ago < 0
    else (
        copy["freshness_stale"]
        if is_stale
        else copy["freshness_updated"].format(hours=f"{hours_ago:.0f}")
    )
)
red_count = int((df_all["risk_score"] >= RED_THRESHOLD).sum()) if has_scores else 0
var_total  = _value_at_risk(df_all) if has_scores else 0.0

# ── Product Nav ───────────────────────────────────────────────────────────────
overview_title_html = copy["overview_title"]
if is_es:
    overview_title_html = overview_title_html.replace("entender", "<span class='flag'>entender</span>")
else:
    overview_title_html = overview_title_html.replace("understand", "<span class='flag'>understand</span>")

st.markdown(f"""
<nav class="vd-nav">
  <a href="{home_url}" class="nav-back">← VeedurIA</a>
  <span class="vd-nav-sep">·</span>
  <div class="vd-nav-phases">
    <span class="vd-phase active">
      <span class="phase-dot"></span>
      {copy["nav_p1"]}
    </span>
    <span class="vd-phase upcoming">
      {copy["nav_p2"]}
      <span class="soon-badge">{copy["soon"]}</span>
    </span>
    <span class="vd-phase upcoming">
      {copy["nav_p3"]}
      <span class="soon-badge">{copy["soon"]}</span>
    </span>
  </div>
  <div class="nav-lang">
    <a href="/ContratoLimpio?lang=es" class="{"active" if is_es else ""}">{copy["lang_es"]}</a>
    <a href="/ContratoLimpio?lang=en" class="{"active" if not is_es else ""}">{copy["lang_en"]}</a>
  </div>
</nav>
""", unsafe_allow_html=True)
overview_html = f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
*{{box-sizing:border-box;margin:0;padding:0;}}
body{{background:transparent;font-family:'Inter',sans-serif;overflow:hidden;color:#172033;}}
.overview{{
  position:relative; overflow:hidden;
  border:1px solid rgba(23,32,51,0.08); border-radius:28px;
  background:
    radial-gradient(circle at top left, rgba(211,162,26,0.12), transparent 28%),
    radial-gradient(circle at bottom right, rgba(13,91,215,0.08), transparent 24%),
    rgba(255,255,255,0.84);
  box-shadow:0 18px 40px rgba(20,30,50,0.08);
  padding:1.4rem 1.5rem;
}}
.overview::before{{
  content:""; position:absolute; top:0; left:0; right:0; height:4px;
  background:linear-gradient(90deg,#d3a21a 0 34%, #0d5bd7 34% 68%, #c62839 68% 100%);
}}
.grid{{display:grid; grid-template-columns:minmax(0,1.2fr) minmax(340px,0.8fr); gap:1.2rem; align-items:start;}}
.kick{{font-family:'JetBrains Mono',monospace; font-size:0.66rem; letter-spacing:0.15em; text-transform:uppercase; color:#0d5bd7; margin-bottom:0.8rem;}}
.title{{font-family:'Syne',sans-serif; font-size:2.7rem; line-height:0.95; letter-spacing:-0.06em; margin-bottom:0.6rem;}}
.title .flag{{background:linear-gradient(90deg,#d3a21a 0 30%, #0d5bd7 30% 70%, #c62839 70% 100%); -webkit-background-clip:text; background-clip:text; color:transparent;}}
.sub{{font-size:0.94rem; line-height:1.65; color:rgba(23,32,51,0.72); max-width:690px;}}
.stats{{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0.72rem;}}
.stat{{
  padding:0.9rem 0.95rem; border-radius:18px; background:rgba(255,255,255,0.76);
  border:1px solid rgba(23,32,51,0.07);
}}
.stat small{{display:block; font-family:'JetBrains Mono',monospace; font-size:0.6rem; letter-spacing:0.12em; text-transform:uppercase; color:rgba(23,32,51,0.42); margin-bottom:0.45rem;}}
.stat strong{{display:block; font-family:'Syne',sans-serif; font-size:1.2rem; letter-spacing:-0.04em; margin-bottom:0.18rem;}}
.stat span{{font-size:0.76rem; line-height:1.45; color:rgba(23,32,51,0.70);}}
.s-blue strong{{color:#0d5bd7;}} .s-red strong{{color:#c62839;}} .s-yellow strong{{color:#d3a21a;}} .s-green strong{{color:#198754;}}
.route{{margin-top:0.95rem; display:grid; gap:0.55rem;}}
.route-step{{display:flex; gap:0.65rem; align-items:flex-start; padding:0.72rem 0.8rem; border-radius:16px; background:rgba(248,243,236,0.9); border:1px solid rgba(23,32,51,0.06);}}
.route-step b{{display:block; font-size:0.79rem; margin-bottom:0.12rem;}}
.route-step span:last-child{{font-size:0.75rem; line-height:1.48; color:rgba(23,32,51,0.72);}}
.n{{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(13,91,215,0.10);color:#0d5bd7;font-family:'JetBrains Mono',monospace;font-size:0.66rem;font-weight:600;flex-shrink:0;}}
</style>
<section class="overview">
  <div class="grid">
    <div>
      <div class="kick">{copy["overview_kicker"]}</div>
      <div class="title">{overview_title_html}</div>
      <p class="sub">{copy["overview_sub"]}</p>
      <div class="route">
        <div class="route-step"><div class="n">1</div><span><b>{copy["route_1_t"]}</b><span>{copy["route_1_b"]}</span></span></div>
        <div class="route-step"><div class="n">2</div><span><b>{copy["route_2_t"]}</b><span>{copy["route_2_b"]}</span></span></div>
        <div class="route-step"><div class="n">3</div><span><b>{copy["route_3_t"]}</b><span>{copy["route_3_b"]}</span></span></div>
      </div>
    </div>
    <div class="stats">
      <div class="stat s-blue"><small>{copy["stat_1_l"]}</small><strong>{total_in_file:,}</strong><span>{copy["stat_1_b"]}</span></div>
      <div class="stat s-red"><small>{copy["stat_2_l"]}</small><strong>{red_count:,}</strong><span>{copy["stat_2_b"]}</span></div>
      <div class="stat s-yellow"><small>{copy["stat_3_l"]}</small><strong>{_fmt_cop(var_total)}</strong><span>{copy["stat_3_b"]}</span></div>
      <div class="stat s-green"><small>{copy["stat_4_l"]}</small><strong>{freshness_label}</strong><span>{copy["stat_4_b"]}</span></div>
    </div>
  </div>
</section>
"""
components.html(overview_html, height=280, scrolling=False)

# ── Primary Filter Form (2 filters only) ─────────────────────────────────────
dept_opts = (
    [copy["all"]] + sorted(df_all["departamento"].dropna().unique().tolist())
    if "departamento" in df_all.columns else ["Todos"]
)
risk_option_map = _risk_option_map()
risk_opts = list(risk_option_map.keys())

st.markdown("""
<div class="control-shell">
  <div class="control-head">
    <div>
      <div class="control-title">""" + copy["controls_title"] + """</div>
      <div class="control-copy">""" + copy["controls_copy"] + """</div>
    </div>
  </div>
""", unsafe_allow_html=True)

with st.form("primary_filters", clear_on_submit=False):
    f_d, f_r, f_btn = st.columns([4, 4, 2])
    with f_d:
        filter_dept_val = st.selectbox(
            copy["dept"],
            dept_opts,
            key="pf_dept",
            help="Limita la lectura a un territorio concreto.",
        )
    with f_r:
        filter_risk_val = st.selectbox(
            copy["risk"],
            risk_opts,
            key="pf_risk",
            help="Prioriza alertas altas o revisa todo el espectro.",
        )
    with f_btn:
        st.markdown("<div style='height:1.55rem'></div>", unsafe_allow_html=True)
        submitted = st.form_submit_button(copy["apply"], use_container_width=True)

active_chips = []
if st.session_state.get("selected_dept"):
    active_chips.append(f"{copy['active_map_prefix']}: {st.session_state['selected_dept']}")
elif st.session_state.get("pf_dept") not in (None, copy["all"]):
    active_chips.append(f"{copy['active_dept_prefix']}: {st.session_state['pf_dept']}")
if st.session_state.get("pf_risk") not in (None, copy["risk_all"]):
    active_chips.append(f"{copy['active_risk_prefix']}: {st.session_state['pf_risk']}")
if active_chips:
    st.markdown(
        "<div class='active-filter-row'>"
        + "".join(f"<span class='active-chip'>{chip}</span>" for chip in active_chips)
        + "</div>",
        unsafe_allow_html=True,
    )

st.markdown("</div>", unsafe_allow_html=True)

if is_preview and total_in_file > len(df_all):
    st.markdown(
        f"<p class='preview-note'>{copy['preview'].format(shown=f'{len(df_all):,}', total=f'{total_in_file:,}')}</p>",
        unsafe_allow_html=True,
    )

# ── Apply primary filters ─────────────────────────────────────────────────────
df = df_all.copy()

# Department: both the form filter AND the map click selection
active_dept = st.session_state.get("selected_dept")
effective_dept = active_dept if active_dept else (
    filter_dept_val if filter_dept_val != copy["all"] else None
)
if effective_dept and "departamento" in df.columns:
    df = df[df["departamento"].str.upper().str.strip() == effective_dept.upper().strip()]

if filter_risk_val != copy["risk_all"] and "risk_label" in df.columns:
    selected_risk = risk_option_map.get(filter_risk_val)
    if selected_risk:
        df = df[df["risk_label"] == selected_risk]

# ── Advanced filter state (persisted via session_state from the expander form) ──
# These are applied below after the expander renders.
_adv_entity = st.session_state.get("_adv_entity", "")
_adv_mod    = st.session_state.get("_adv_mod", copy["all"])

if _adv_entity and "nombre_entidad" in df.columns:
    mask = df["nombre_entidad"].astype(str).str.contains(_adv_entity, case=False, na=False)
    if "nit_entidad" in df.columns:
        mask |= df["nit_entidad"].astype(str).str.contains(_adv_entity, case=False, na=False)
    df = df[mask]

mod_opts = (
    [copy["all"]] + sorted(df_all["modalidad_de_contratacion"].dropna().unique().tolist())
    if "modalidad_de_contratacion" in df_all.columns else [copy["all"]]
)
if _adv_mod != copy["all"] and "modalidad_de_contratacion" in df.columns:
    df = df[df["modalidad_de_contratacion"] == _adv_mod]

# ── Empty/no-scores guard ─────────────────────────────────────────────────────
def _empty_state(icon: str, msg: str) -> None:
    st.markdown(
        f"<div style='text-align:center;padding:3rem;color:rgba(180,195,220,.3);'>"
        f"<div style='font-size:2rem'>{icon}</div><div style='font-size:.9rem'>{msg}</div></div>",
        unsafe_allow_html=True,
    )

if df.empty:
    _empty_state("NA", copy["empty_none"])
    st.stop()

if not has_scores:
    _empty_state("ML", copy["empty_ml"])
    st.stop()

slice_red = int((df["risk_score"] >= RED_THRESHOLD).sum()) if "risk_score" in df.columns else 0
slice_yellow = int(((df["risk_score"] >= YELLOW_THRESHOLD) & (df["risk_score"] < RED_THRESHOLD)).sum()) if "risk_score" in df.columns else 0
slice_value = _value_at_risk(df)
dominant_dept = (
    df["departamento"].mode().iloc[0]
    if "departamento" in df.columns and not df["departamento"].mode().empty else "Colombia"
)

# ── Main 2-column layout ──────────────────────────────────────────────────────
map_col, panel_col = st.columns([6, 4], gap="medium")

with map_col:
    st.markdown("<div class='map-shell'>", unsafe_allow_html=True)
    st.markdown(f"<p class='map-eyebrow'>{copy['map_eyebrow']}</p>", unsafe_allow_html=True)

    if active_dept:
        cc1, cc2 = st.columns([8, 2])
        with cc1:
            st.markdown(
                f"<div class='dept-tag'>{active_dept}</div>",
                unsafe_allow_html=True,
            )
        with cc2:
            if st.button(copy["clear"], key="clear_dept"):
                st.session_state["selected_dept"] = None
                st.session_state["selected_contract_json"] = None
                st.rerun()

    clicked = render_plotly_choropleth(
        df_dept_national,
        active_dept_filter=[effective_dept] if effective_dept else None,
    )
    if clicked and clicked != st.session_state.get("selected_dept"):
        st.session_state["selected_dept"] = clicked
        st.session_state["selected_contract_json"] = None
        st.rerun()

    st.markdown(
        f"<p class='map-hint'>{copy['map_hint']}</p>",
        unsafe_allow_html=True,
    )
    st.markdown("</div>", unsafe_allow_html=True)

# ── Build curated focus cases with SHAP ──────────────────────────────────────
hl_source = df.copy()
if "risk_score" in hl_source.columns:
    hl_source["_valor_num"] = hl_source.get("valor_contrato", 0).apply(_parse_cop)
    hl_source["_fecha_rank"] = hl_source.get("fecha_firma", "").apply(_safe_date)
    risk_rank = hl_source["risk_score"].rank(pct=True, method="max")
    value_rank = hl_source["_valor_num"].rank(pct=True, method="max") if hl_source["_valor_num"].max() > 0 else 0
    recent_rank = hl_source["_fecha_rank"].rank(pct=True, method="max")
    hl_source["_priority"] = (
        hl_source["risk_score"] * 0.72
        + value_rank * 0.18
        + recent_rank * 0.10
    )
    top_df = (
        hl_source.sort_values(
            ["_priority", "risk_score", "_valor_num"],
            ascending=[False, False, False],
        )
        .head(6)
        .reset_index(drop=True)
    )
else:
    top_df = pd.DataFrame()

card_data: list[dict] = []
for i, row in top_df.iterrows():
    score     = float(row.get("risk_score", 0))
    score_pct = int(score * 100)
    rl        = str(row.get("risk_label", "risk_verde"))
    cat       = (
        "red"    if (rl == "risk_rojo"    or score >= RED_THRESHOLD) else
        "yellow" if (rl == "risk_amarillo" or score >= YELLOW_THRESHOLD) else "green"
    )
    entity    = str(row.get("nombre_entidad", "N/A"))
    provider  = str(row.get("proveedor_adjudicado", copy["unavailable"]))
    dept_v    = str(row.get("departamento", ""))
    fecha     = str(row.get("fecha_firma", ""))[:10]
    raw_v     = row.get("valor_contrato", 0)
    valor     = _fmt_cop(_parse_cop(raw_v))
    mod       = str(row.get("modalidad_de_contratacion", copy["unavailable"]))
    secop_url = str(row.get("secop_url") or row.get("urlproceso") or "")
    value_num  = float(row.get("_valor_num", 0))

    # Serialize SHAP factors with plain-language labels
    shap_factors: list[dict] = []
    for n in range(1, 6):
        feat_key = row.get(f"shap_feat_{n}")
        val      = row.get(f"shap_val_{n}")
        if feat_key and pd.notna(feat_key):
            label_info = _SHAP_LABELS.get(str(feat_key), {})
            label = label_info.get(
                "label_es" if is_es else "label_en",
                label_info.get("label_es", str(feat_key).replace("_", " ").capitalize()),
            )
            try:
                shap_factors.append({"label": label, "value": float(val or 0)})
            except (TypeError, ValueError):
                pass

    main_signal = shap_factors[0]["label"] if shap_factors else copy["signal_fallback"]
    if i == 0:
        pick_reason = copy["pick_start"]
    elif score >= RED_THRESHOLD and value_num > 0 and value_num >= top_df["_valor_num"].median():
        pick_reason = copy["pick_value"]
    elif row.get("_fecha_rank", pd.Timestamp("1970-01-01")) >= top_df["_fecha_rank"].quantile(0.7):
        pick_reason = copy["pick_recent"]
    else:
        pick_reason = copy["pick_signal"]

    card_data.append({
        "idx":        i,
        "score":      score_pct,
        "cat":        cat,
        "entity":     entity,
        "entity_short": entity[:52] + "…" if len(entity) > 52 else entity,
        "provider":   provider,
        "dept":       dept_v,
        "fecha":      fecha,
        "valor":      valor,
        "mod":        mod,
        "secop_url":  secop_url,
        "shap":       shap_factors,
        "signal":     main_signal,
        "pick_reason": pick_reason,
    })

card_data_json = json.dumps(card_data, ensure_ascii=False)

scope_label = (
    copy["panel_scope_dept"].format(dept=f"<span style='opacity:.55'>{effective_dept}</span>")
    if effective_dept else copy["panel_scope_country"]
)

# ── Interactive Panel HTML ────────────────────────────────────────────────────
PANEL_HTML = f"""<!DOCTYPE html>
<html lang='es'><head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width,initial-scale=1'>
<link rel='preconnect' href='https://fonts.googleapis.com'>
<link href='https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap' rel='stylesheet'>
<style>
*{{box-sizing:border-box;margin:0;padding:0;}}
:root{{
  --blue:#0d5bd7;--r-red:#c62839;--r-yellow:#d3a21a;--r-green:#198754;
  --text:#172033;--text-2:rgba(23,32,51,.70);--text-m:rgba(23,32,51,.44);
  --border:rgba(23,32,51,.08);--bg-s:rgba(255,255,255,.74);--bg-soft:#f8f3ec;
  --r-md:18px;--r-lg:24px;
}}
html,body{{background:transparent;font-family:'Inter',sans-serif;color:var(--text);overflow-x:hidden;}}

/* ── ML Banner ── */
.ml-banner{{
  background:linear-gradient(135deg,rgba(255,255,255,.88),rgba(248,243,236,.82));
  border:1px solid rgba(13,91,215,.10);border-radius:var(--r-lg);
  padding:.95rem 1rem .85rem;margin-bottom:.9rem;
  box-shadow:0 12px 24px rgba(20,30,50,.05);
}}
.ml-pills{{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;margin-bottom:.4rem;}}
.ml-badge{{
  display:inline-flex;align-items:center;gap:5px;
  font-family:'JetBrains Mono',monospace;font-size:.62rem;font-weight:600;
  letter-spacing:.06em;text-transform:uppercase;
  background:rgba(13,91,215,.08);color:var(--blue);
  border:1px solid rgba(13,91,215,.10);border-radius:999px;padding:4px 9px;
}}
.ml-pill{{
  font-family:'JetBrains Mono',monospace;font-size:.6rem;
  background:rgba(255,255,255,.78);border:1px solid var(--border);
  border-radius:999px;padding:3px 8px;color:var(--text-2);
}}
.ml-pill.r{{background:rgba(198,40,57,.08);color:var(--r-red);border-color:rgba(198,40,57,.14);}}
.ml-pill.y{{background:rgba(211,162,26,.08);color:var(--r-yellow);border-color:rgba(211,162,26,.14);}}
.ml-pill.g{{background:rgba(25,135,84,.07);color:var(--r-green);border-color:rgba(25,135,84,.12);}}
.ml-note{{font-size:.76rem;color:var(--text-2);line-height:1.5;}}
.ml-note strong{{color:var(--text);font-weight:700;}}

/* ── Guide strip ── */
.guide-strip{{
  background:rgba(255,255,255,.78);border:1px solid var(--border);
  border-radius:var(--r-md);padding:.9rem 1rem;margin-bottom:.8rem;
  box-shadow:0 10px 22px rgba(20,30,50,.04);
}}
.guide-hdr{{font-family:'JetBrains Mono',monospace;font-size:.62rem;letter-spacing:.1em;
            text-transform:uppercase;color:var(--blue);margin-bottom:.55rem;}}
.guide-step{{
  display:flex;align-items:flex-start;gap:.55rem;
  font-size:.78rem;color:var(--text-2);margin-bottom:.35rem;line-height:1.4;
}}
.guide-step:last-child{{margin-bottom:0;}}
.g-n{{
  width:18px;height:18px;border-radius:50%;flex-shrink:0;
  background:rgba(13,91,215,.10);border:1px solid rgba(13,91,215,.12);
  color:var(--blue);font-size:.6rem;font-weight:700;
  display:flex;align-items:center;justify-content:center;
  font-family:'JetBrains Mono',monospace;
}}

/* ── Section header ── */
.ph{{
  font-family:'JetBrains Mono',monospace;font-size:.63rem;
  letter-spacing:.13em;text-transform:uppercase;color:var(--blue);
  margin-bottom:.65rem;
}}
.panel-copy{{font-size:.78rem;line-height:1.5;color:var(--text-2);margin-bottom:.75rem;}}
.slice-stats{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem;margin-bottom:.8rem;}}
.slice-stat{{padding:.72rem .76rem;border-radius:16px;background:rgba(255,255,255,.74);border:1px solid var(--border);}}
.slice-stat small{{display:block;font-family:'JetBrains Mono',monospace;font-size:.56rem;letter-spacing:.10em;text-transform:uppercase;color:var(--text-m);margin-bottom:.28rem;}}
.slice-stat strong{{display:block;font-family:'Syne',sans-serif;font-size:1rem;letter-spacing:-.03em;margin-bottom:.15rem;}}
.slice-stat span{{font-size:.7rem;line-height:1.45;color:var(--text-2);}}

/* ── Cards ── */
@keyframes cardIn{{
  from{{opacity:0;transform:translateY(14px) scale(.985);}}
  to  {{opacity:1;transform:translateY(0)    scale(1);}}
}}
@keyframes glowRed{{
  0%,100%{{box-shadow:0 0 0 0 rgba(198,40,57,0);}}
  50%{{box-shadow:0 0 14px 0 rgba(198,40,57,.14);}}
}}
.card{{
  display:flex;align-items:center;gap:.7rem;
  background:var(--bg-s);border:1px solid var(--border);
  border-radius:var(--r-md);padding:.82rem .95rem;margin-bottom:.45rem;
  cursor:pointer;position:relative;user-select:none;
  transition:background .18s,border-color .18s,transform .28s cubic-bezier(.34,1.56,.64,1);
  animation:cardIn .5s cubic-bezier(.16,1,.3,1) both;
  animation-delay:calc(var(--i,0) * 0.058s);
  box-shadow:0 10px 20px rgba(20,30,50,.04);
}}
.card:hover{{background:rgba(255,255,255,.92);border-color:rgba(13,91,215,.16);transform:translateX(3px);}}
.card.active{{border-color:rgba(13,91,215,.22);background:rgba(255,255,255,.94);}}
.card.red{{border-left:3px solid var(--r-red);animation:cardIn .5s cubic-bezier(.16,1,.3,1) both,glowRed 3.8s ease-in-out infinite;}}
.card.yellow{{border-left:3px solid var(--r-yellow);}}
.card.green{{border-left:3px solid var(--r-green);}}
.badge{{
  width:40px;height:40px;border-radius:9px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  font-family:'Syne',sans-serif;font-weight:800;font-size:.9rem;
}}
.badge.red{{background:rgba(198,40,57,.10);color:var(--r-red);}}
.badge.yellow{{background:rgba(211,162,26,.12);color:var(--r-yellow);}}
.badge.green{{background:rgba(25,135,84,.10);color:var(--r-green);}}
.card-body{{flex:1;min-width:0;}}
.card-top{{display:flex;align-items:center;gap:.5rem;margin-bottom:.2rem;}}
.pick-pill{{
  display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .48rem;border-radius:999px;
  background:rgba(13,91,215,.08);border:1px solid rgba(13,91,215,.10);color:var(--blue);
  font-size:.58rem;font-family:'JetBrains Mono',monospace;letter-spacing:.06em;text-transform:uppercase;
}}
.card-ent{{font-size:.82rem;font-weight:600;color:var(--text);
           white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:.1rem;}}
.card-meta{{font-size:.67rem;color:var(--text-m);font-family:'JetBrains Mono',monospace;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}}
.card-signal{{font-size:.72rem;color:var(--text-2);line-height:1.45;margin-top:.28rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}}
.arr{{color:var(--text-m);font-size:.88rem;flex-shrink:0;transition:transform .2s,color .2s;}}
.card.active .arr{{transform:rotate(90deg);color:var(--blue);}}

/* ── Detail drawer ── */
@keyframes drawerIn{{from{{opacity:0;transform:translateY(-8px);}}to{{opacity:1;transform:translateY(0);}}}}
.drawer{{
  background:rgba(255,253,248,.96);border:1px solid rgba(13,91,215,.12);
  border-radius:var(--r-lg);padding:1.3rem 1.4rem;margin-bottom:.38rem;
  animation:drawerIn .36s cubic-bezier(.16,1,.3,1) both;display:none;
  box-shadow:0 18px 36px rgba(20,30,50,.08);
}}
.drawer.open{{display:block;}}
.dr-top{{display:flex;align-items:flex-start;justify-content:space-between;gap:.8rem;margin-bottom:1rem;}}
.score-n{{font-family:'Syne',sans-serif;font-size:2.9rem;font-weight:800;letter-spacing:-.05em;line-height:1;}}
.score-d{{font-size:.85rem;color:var(--text-m);}}
.score-lbl{{font-size:.85rem;font-weight:600;margin-top:.15rem;}}
.score-r{{color:var(--r-red);}} .score-y{{color:var(--r-yellow);}} .score-g{{color:var(--r-green);}}
.dr-close{{
  width:28px;height:28px;border-radius:7px;border:1px solid var(--border);
  background:rgba(247,242,234,.86);color:var(--text-m);
  display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.88rem;
  flex-shrink:0;transition:background .18s;
}}
.dr-close:hover{{background:rgba(255,255,255,.09);color:#fff;}}
.dr-grid{{display:grid;grid-template-columns:1fr 1fr;gap:.65rem;}}
.dr-field{{}}
.dr-lbl{{font-family:'JetBrains Mono',monospace;font-size:.57rem;letter-spacing:.09em;
          text-transform:uppercase;color:var(--text-m);margin-bottom:.18rem;}}
.dr-val{{font-size:.83rem;color:var(--text);font-weight:500;word-break:break-word;line-height:1.38;}}
.secop-btn{{
  display:inline-flex;align-items:center;gap:6px;margin-top:1rem;
  background:rgba(13,91,215,.08);border:1px solid rgba(13,91,215,.12);
  color:var(--blue);text-decoration:none;border-radius:9px;padding:.45rem 1rem;
  font-size:.8rem;font-weight:600;font-family:'Inter',sans-serif;transition:background .18s;
}}
.secop-btn:hover{{background:rgba(13,91,215,.14);}}

/* ── SHAP bars ── */
.shap-wrap{{margin-top:1.1rem;}}
.shap-hdr{{font-family:'JetBrains Mono',monospace;font-size:.57rem;letter-spacing:.09em;
           text-transform:uppercase;color:var(--text-m);margin-bottom:.2rem;}}
.shap-hint{{font-size:.68rem;color:var(--text-m);margin-bottom:.6rem;line-height:1.4;}}
.shap-row{{display:flex;align-items:center;gap:.55rem;margin-bottom:.38rem;}}
.shap-lbl{{
  width:140px;flex-shrink:0;font-size:.73rem;color:var(--text-2);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}}
.shap-track{{flex:1;height:5px;background:rgba(23,32,51,.08);border-radius:3px;overflow:hidden;}}
.shap-bar{{height:100%;border-radius:3px;width:0%;transition:width .55s cubic-bezier(.4,0,.2,1);}}
.bar-risk{{background:linear-gradient(90deg,#c62839,#d3a21a);}}
.bar-safe{{background:linear-gradient(90deg,#198754,#44b67a);}}

/* ── Ethics note ── */
.dr-ethics{{
  margin-top:.9rem;font-size:.71rem;color:rgba(110,78,0,.82);
  line-height:1.5;border-top:1px solid rgba(23,32,51,.08);padding-top:.7rem;
}}

/* ── Empty state ── */
.empty{{text-align:center;padding:2rem 1rem;color:var(--text-m);}}
.empty-icon{{font-size:1.8rem;margin-bottom:.5rem;}}
.empty-txt{{font-size:.85rem;}}

/* ── Responsive ── */
@media(max-width:540px){{
  .dr-grid{{grid-template-columns:1fr;}}
  .score-n{{font-size:2.2rem;}}
  .shap-lbl{{width:110px;}}
}}
@media(prefers-reduced-motion:reduce){{
  *,*::before,*::after{{animation-duration:.01ms!important;transition-duration:.01ms!important;}}
}}
</style>
</head>
<body>

<!-- ML Banner -->
<div class="ml-banner">
  <div class="ml-pills">
    <span class="ml-badge">{copy["ml_banner_model"]}</span>
    <span class="ml-pill">{copy["ml_banner_vars"]}</span>
    <span class="ml-pill">{copy["ml_banner_rate"]}</span>
    <span class="ml-pill r">HI ≥70</span>
    <span class="ml-pill y">MID 40–69</span>
    <span class="ml-pill g">LOW &lt;40</span>
  </div>
  <div class="ml-note">
    <strong>{copy["ml_banner_note"].split(" — ")[0]}</strong>
    {" — ".join(copy["ml_banner_note"].split(" — ")[1:])}
  </div>
</div>

<!-- Guide strip (shows until a card is opened) -->
<div class="guide-strip" id="guide-strip">
  <div class="guide-hdr">{copy["guide_title"]}</div>
  <div class="guide-step"><span class="g-n">1</span><span>{copy["guide_1"]}</span></div>
  <div class="guide-step"><span class="g-n">2</span><span>{copy["guide_2"]}</span></div>
  <div class="guide-step"><span class="g-n">3</span><span>{copy["guide_3"]}</span></div>
</div>

<!-- Panel header + card list -->
<div class="ph" id="ph">{scope_label}</div>
<div class="panel-copy">{copy["panel_copy"]}</div>
<div class="slice-stats">
  <div class="slice-stat"><small>{copy["slice_red"]}</small><strong>{slice_red:,}</strong><span>{copy["slice_red_copy"]}</span></div>
  <div class="slice-stat"><small>{copy["slice_value"]}</small><strong>{_fmt_cop(slice_value)}</strong><span>{copy["slice_value_copy"]}</span></div>
  <div class="slice-stat"><small>{copy["slice_dept"]}</small><strong>{dominant_dept}</strong><span>{copy["slice_dept_copy"]}</span></div>
</div>
<div id="list"></div>

<script>
var CARDS = {card_data_json};
var openIdx = null;

function esc(s){{
  var d=document.createElement('div');d.innerText=String(s||'');return d.innerHTML;
}}

function scoreColor(cat){{
  return cat==='red'?'score-r':cat==='yellow'?'score-y':'score-g';
}}

function renderLabel(cat){{
  if(cat==='red')   return '<span class="score-lbl score-r">HIGH · {copy["label_red"]}</span>';
  if(cat==='yellow')return '<span class="score-lbl score-y">MID · {copy["label_yellow"]}</span>';
  return '<span class="score-lbl score-g">LOW · {copy["label_green"]}</span>';
}}

function buildShap(shap){{
  if(!shap||!shap.length) return '';
  var html='<div class="shap-wrap">'
    +'<div class="shap-hdr">{copy["shap_title"]}</div>'
    +'<div class="shap-hint">{copy["shap_hint"]}</div>';
  shap.forEach(function(f){{
    var pct=Math.min(Math.abs(f.value)*600,100).toFixed(1);
    var cls=f.value<0?'bar-risk':'bar-safe';
    html+='<div class="shap-row">'
      +'<div class="shap-lbl">'+esc(f.label)+'</div>'
      +'<div class="shap-track"><div class="shap-bar '+cls+'" data-w="'+pct+'%" style="width:0%"></div></div>'
      +'</div>';
  }});
  return html+'</div>';
}}

function buildDrawer(c){{
  var secopBtn=c.secop_url
    ?'<a href="'+c.secop_url+'" target="_blank" class="secop-btn">{copy["detail_link"]} ↗</a>'
    :'';
  var clr=scoreColor(c.cat);
  return '<div class="drawer open" id="drawer-'+c.idx+'">'
    +'<div class="dr-top">'
    +  '<div>'
    +    '<div class="score-n '+clr+'">'+c.score+'<span class="score-d">/100</span></div>'
    +    renderLabel(c.cat)
    +    '<div style="margin-top:.45rem;font-size:.74rem;color:var(--text-2);"><strong style="color:var(--text);">{copy["why_here"]}</strong> '+esc(c.pick_reason)+' · '+esc(c.signal)+'</div>'
    +  '</div>'
    +  '<div class="dr-close" onclick="closeDrawer()">&#215;</div>'
    +'</div>'
    +'<div class="dr-grid">'
    +  '<div class="dr-field"><div class="dr-lbl">{copy["detail_entity"]}</div><div class="dr-val">'+esc(c.entity)+'</div></div>'
    +  '<div class="dr-field"><div class="dr-lbl">{copy["detail_provider"]}</div><div class="dr-val">'+esc(c.provider)+'</div></div>'
    +  '<div class="dr-field"><div class="dr-lbl">{copy["detail_value"]}</div><div class="dr-val">'+esc(c.valor)+'</div></div>'
    +  '<div class="dr-field"><div class="dr-lbl">{copy["detail_mod"]}</div><div class="dr-val">'+esc(c.mod)+'</div></div>'
    +  '<div class="dr-field"><div class="dr-lbl">{copy["detail_date"]}</div><div class="dr-val">'+esc(c.fecha)+'</div></div>'
    +  '<div class="dr-field"><div class="dr-lbl">{copy["detail_dept"]}</div><div class="dr-val">'+esc(c.dept)+'</div></div>'
    +'</div>'
    + buildShap(c.shap)
    + secopBtn
    +'<div class="dr-ethics">{copy["ethics_short"]}</div>'
    +'</div>';
}}

function animateSHAP(){{
  requestAnimationFrame(function(){{
    document.querySelectorAll('.shap-bar[data-w]').forEach(function(b){{
      b.style.width = b.getAttribute('data-w');
    }});
  }});
}}

function closeDrawer(){{
  openIdx=null;
  render();
}}

function toggleCard(idx){{
  openIdx=(openIdx===idx)?null:idx;
  render();
}}

function render(){{
  var list=document.getElementById('list');
  var guide=document.getElementById('guide-strip');
  if(!CARDS||!CARDS.length){{
    list.innerHTML='<div class="empty"><div class="empty-icon">NA</div>'
      +'<div class="empty-txt">{copy["empty_none"]}</div></div>';
    return;
  }}
  // Hide guide once a card is opened
  if(guide) guide.style.display = (openIdx!==null)?'none':'';
  var html='';
  CARDS.forEach(function(c,i){{
    var isOpen=openIdx===c.idx;
    html+='<div class="card '+c.cat+(isOpen?' active':'')
      +'" style="--i:'+i+'" onclick="toggleCard('+c.idx+')">';
    html+='<div class="badge '+c.cat+'">'+c.score+'</div>';
    html+='<div class="card-body">';
    html+='<div class="card-top"><span class="pick-pill">'+esc(c.pick_reason)+'</span></div>';
    html+='<div class="card-ent">'+esc(c.entity_short)+'</div>';
    var meta=[c.dept,c.fecha,c.valor].filter(Boolean).join(' · ');
    html+='<div class="card-meta">'+meta+'</div>';
    html+='<div class="card-signal">{copy["why_here"]} '+esc(c.signal)+'</div>';
    html+='</div>';
    html+='<div class="arr">›</div>';
    html+='</div>';
    if(isOpen){{
      html+=buildDrawer(c);
    }}
  }});
  list.innerHTML=html;
  if(openIdx!==null) animateSHAP();
}}

render();
</script>
</body></html>"""

with panel_col:
    components.html(PANEL_HTML, height=700, scrolling=True)

entity_summary = pd.DataFrame()
if {"nombre_entidad", "risk_score"}.issubset(df.columns):
    entity_summary = (
        df.groupby("nombre_entidad")
        .agg(
            contratos=("risk_score", "size"),
            riesgo_promedio=("risk_score", "mean"),
            riesgo_maximo=("risk_score", "max"),
        )
        .sort_values(["riesgo_maximo", "contratos"], ascending=[False, False])
        .head(8)
        .reset_index()
    )

mod_summary = pd.DataFrame()
if {"modalidad_de_contratacion", "risk_score"}.issubset(df.columns):
    mod_summary = (
        df.groupby("modalidad_de_contratacion")
        .agg(
            contratos=("risk_score", "size"),
            riesgo_promedio=("risk_score", "mean"),
        )
        .sort_values(["riesgo_promedio", "contratos"], ascending=[False, False])
        .head(8)
        .reset_index()
    )

# ── Advanced Filters Expander ─────────────────────────────────────────────────
with st.expander(copy["adv_filters"], expanded=False):
    st.caption(copy["adv_caption"])
    with st.form("adv_filters", clear_on_submit=False):
        ae1, ae2 = st.columns(2)
        with ae1:
            adv_entity = st.text_input(
                copy["adv_entity"], value=_adv_entity, key="adv_entity_input",
                placeholder=copy["adv_entity_ph"],
            )
        with ae2:
            adv_mod = st.selectbox(
                copy["adv_mod"], mod_opts,
                index=mod_opts.index(_adv_mod) if _adv_mod in mod_opts else 0,
                key="adv_mod_input",
            )
        adv_submitted = st.form_submit_button(copy["adv_apply"] + " →")

    if adv_submitted:
        st.session_state["_adv_entity"] = adv_entity
        st.session_state["_adv_mod"]    = adv_mod
        st.rerun()

    load_label = copy["load_full"] if is_preview else copy["load_preview"]
    if st.button(load_label, key="toggle_full"):
        st.session_state["full_dataset"] = not st.session_state["full_dataset"]
        st.session_state["selected_contract_json"] = None
        st.rerun()

# ── Dashboard summary graphs ──────────────────────────────────────────────────
st.markdown("<br><h4 style='font-family:\"Syne\", sans-serif;margin-bottom:1rem;'>" + copy["summary_exp"] + "</h4>", unsafe_allow_html=True)
st.caption(copy["summary_cap"])

c1, c2, c3 = st.columns(3)

# 1. Entidades con Mayor Riesgo (Bar Chart)
with c1:
    st.markdown(f"**{copy['summary_entities']}**")
    if not entity_summary.empty:
        fig1 = px.bar(
            entity_summary.head(10).sort_values("riesgo_promedio", ascending=True),
            x="riesgo_promedio",
            y="nombre_entidad",
            orientation="h",
            color="riesgo_promedio",
            color_continuous_scale=["#f8f3ec", "#d3a21a", "#c62839"],
            labels={"riesgo_promedio": copy["summary_col_mean"], "nombre_entidad": ""},
        )
        fig1.update_layout(
            margin=dict(l=0, r=0, t=0, b=0),
            height=300,
            coloraxis_showscale=False,
            font=dict(family="Inter", size=11, color="rgba(23,32,51,0.7)"),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            xaxis=dict(showgrid=True, gridcolor="rgba(0,0,0,0.05)"),
            yaxis=dict(showgrid=False),
        )
        st.plotly_chart(fig1, use_container_width=True, config={"displayModeBar": False})

# 2. Distribución de Modalidades (Donut or Bar Chart)
with c2:
    st.markdown(f"**{copy['summary_mods']}**")
    if not mod_summary.empty:
        fig2 = px.bar(
            mod_summary.head(8).sort_values("riesgo_promedio", ascending=True),
            x="riesgo_promedio",
            y="modalidad_de_contratacion",
            orientation="h",
            labels={"riesgo_promedio": copy["summary_col_mean"], "modalidad_de_contratacion": ""},
            color="riesgo_promedio",
            color_continuous_scale=["#0d5bd7", "#198754", "#d3a21a"],
        )
        fig2.update_layout(
            margin=dict(l=0, r=0, t=0, b=0),
            height=300,
            coloraxis_showscale=False,
            font=dict(family="Inter", size=11, color="rgba(23,32,51,0.7)"),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            xaxis=dict(showgrid=True, gridcolor="rgba(0,0,0,0.05)"),
            yaxis=dict(showgrid=False),
        )
        st.plotly_chart(fig2, use_container_width=True, config={"displayModeBar": False})

# 3. Evolución Temporal (Line Chart if available, else Risk Distribution)
with c3:
    st.markdown(f"**Distribución de Riesgo**")
    if "risk_score" in df.columns:
        fig3 = px.histogram(
            df.head(2000), # Limit for performance
            x="risk_score",
            nbins=15,
            color_discrete_sequence=["#0d5bd7"],
            labels={"risk_score": "Puntaje de Riesgo", "count": "Contratos"},
        )
        fig3.update_layout(
            margin=dict(l=0, r=0, t=0, b=0),
            height=300,
            font=dict(family="Inter", size=11, color="rgba(23,32,51,0.7)"),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            xaxis=dict(showgrid=False),
            yaxis=dict(showgrid=True, gridcolor="rgba(0,0,0,0.05)"),
            bargap=0.1
        )
        st.plotly_chart(fig3, use_container_width=True, config={"displayModeBar": False})

# ── Table Expander ────────────────────────────────────────────────────────────
with st.expander(copy["table_exp"].format(n=f"{len(df):,}"), expanded=False):
    st.caption(copy["table_cap"])
    display_cols = [c for c in [
        "risk_score", "nombre_entidad", "proveedor_adjudicado",
        "valor_contrato", "modalidad_de_contratacion", "fecha_firma", "departamento",
    ] if c in df.columns]
    if display_cols:
        rename_map = {
            "risk_score": copy["table_col_risk"],
            "nombre_entidad": copy["table_col_entity"],
            "proveedor_adjudicado": copy["table_col_provider"],
            "valor_contrato": copy["table_col_value"],
            "modalidad_de_contratacion": copy["table_col_mod"],
            "fecha_firma": copy["table_col_date"],
            "departamento": copy["table_col_dept"],
        }
        st.dataframe(
            df[display_cols]
            .sort_values("risk_score", ascending=False)
            .rename(columns=rename_map),
            use_container_width=True,
            hide_index=True,
        )

# ── Methodology Expander ──────────────────────────────────────────────────────
with st.expander(copy["method_exp"], expanded=False):
    meta = _load_model_meta()
    n_est    = meta.get("n_estimators", 200)
    cont     = meta.get("contamination_param", 0.05)
    trained  = meta.get("trained_at", meta.get("training_date", copy["unavailable"]))
    val_res  = meta.get("validation_scores", {})
    n_passed = sum(1 for v in val_res.values() if v) if val_res else "—"
    n_total  = len(val_res) if val_res else 3
    n_feats  = meta.get("n_features", 25)

    st.markdown(f"""
**{copy["method_model"]}**
{copy["method_model_body"]}
Parámetros: `n_estimators={n_est}` · `contamination={cont}` · `random_state=42`.

**{copy["method_analyzes"]}**
{n_feats} variables por contrato: valor económico, duración, número de oferentes, modalidad de contratación, historial del proveedor, temporalidad electoral, concentración de mercado.

**{copy["method_score"]}**
{copy["method_score_body"]}
{copy["method_scale"]}

**{copy["method_trained"]}**
`{trained}` — {copy["method_trained_body"]}

**{copy["method_validated"]}**
{copy["method_validated_body"].format(passed=n_passed, total=n_total)}

**{copy["method_limits"]}**
{copy["method_limits_body"]}

**{copy["method_source"]}:** [SECOP II Contratos Electrónicos](https://www.datos.gov.co/resource/jbjy-vk9h.json)
    """)

# ── Ethics Bar ────────────────────────────────────────────────────────────────
st.markdown(f"""
<div class="ethics-bar">
  {copy["ethics_bar"]}
</div>
""", unsafe_allow_html=True)
