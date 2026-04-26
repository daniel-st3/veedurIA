"""
Phase 2 — SigueElDinero: network graph of contractors, donors, entities and
political connections from Cuentas Claras / SECOP II cross-reference.

The graph starts zoomed-in so the user must pan/scroll to discover its full
complexity. Nodes are sized by contract volume. Edges are coloured by
relationship type.
"""

from __future__ import annotations

import streamlit as st
import streamlit.components.v1 as components
from src.api.network_service import get_version_payload

# ── Page config ────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="SigueElDinero | VeedurIA",
    page_icon="V",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── Language ───────────────────────────────────────────────────────────────────
def _get_lang() -> str:
    raw = st.query_params.get("lang")
    if isinstance(raw, list):
        raw = raw[0] if raw else None
    lang = raw or st.session_state.get("lang") or "es"
    if lang not in ("es", "en"):
        lang = "es"
    st.session_state["lang"] = lang
    return lang

lang = _get_lang()
is_es = lang == "es"

T = {
    "es": {
        "kicker":        "Fase 2 · Redes de financiación",
        "title":         "SigueElDinero",
        "sub":           "Visualiza las conexiones entre entidades públicas, contratistas, donantes y actores políticos. Cada nodo es un actor del sistema. Cada arista, un flujo de dinero o una relación contractual verificada.",
        "legend_title":  "Tipos de relación",
        "leg_contract":  "Contrato adjudicado",
        "leg_donation":  "Donación política",
        "leg_risk":      "Vínculo de riesgo",
        "leg_affil":     "Afiliación política",
        "node_entity":   "Entidad pública",
        "node_company":  "Contratista",
        "node_donor":    "Donante",
        "node_pol":      "Figura política",
        "node_inter":    "Intermediario",
        "hint":          "Arrastra para explorar · Rueda para hacer zoom · Clic en un nodo para ver detalles",
        "stat_nodes":    "nodos",
        "stat_edges":    "conexiones",
        "stat_risk":     "vínculos de riesgo",
        "stat_value":    "valor total analizado",
        "nav_cl":        "ContratoLimpio",
        "nav_sed":       "SigueElDinero",
        "nav_pm":        "PromesóMetro",
        "nav_active":    "activo",
        "nav_soon":      "pronto",
        "methodology":   "Metodología",
        "method_body":   "Los datos provienen del cruce entre Cuentas Claras (donaciones políticas) y SECOP II (contratos públicos). Los vínculos de riesgo señalan casos donde el mismo NIT aparece como donante y como contratista adjudicado en el mismo período electoral. Esta es una señal preventiva, no una confirmación de irregularidad.",
        "ethics":        "Aviso ético: Este análisis es informativo y no constituye prueba de irregularidad. Consulte la fuente oficial antes de concluir.",
        "zoom_hint":     "Vista inicial amplificada — desliza para ver la red completa",
    },
    "en": {
        "kicker":        "Phase 2 · Funding networks",
        "title":         "FollowTheMoney",
        "sub":           "Visualize connections between public entities, contractors, donors, and political actors. Each node is a system actor. Each edge is a verified money flow or contractual relationship.",
        "legend_title":  "Relationship types",
        "leg_contract":  "Awarded contract",
        "leg_donation":  "Political donation",
        "leg_risk":      "Risk link",
        "leg_affil":     "Political affiliation",
        "node_entity":   "Public entity",
        "node_company":  "Contractor",
        "node_donor":    "Donor",
        "node_pol":      "Political figure",
        "node_inter":    "Intermediary",
        "hint":          "Drag to explore · Scroll to zoom · Click a node for details",
        "stat_nodes":    "nodes",
        "stat_edges":    "connections",
        "stat_risk":     "risk links",
        "stat_value":    "total value analyzed",
        "nav_cl":        "ContratoLimpio",
        "nav_sed":       "FollowTheMoney",
        "nav_pm":        "PromesóMetro",
        "nav_active":    "active",
        "nav_soon":      "soon",
        "methodology":   "Methodology",
        "method_body":   "Data comes from crossing Cuentas Claras (political donations) with SECOP II (public contracts). Risk links flag cases where the same NIT appears as a donor and as an awarded contractor in the same electoral period. This is a preventive signal, not a confirmation of wrongdoing.",
        "ethics":        "Ethical notice: This analysis is informational and does not constitute evidence of wrongdoing. Review the official source before concluding.",
        "zoom_hint":     "Initial view zoomed in — scroll to explore the full network",
    },
}[lang]

lang_toggle_href = f"?lang={'en' if is_es else 'es'}"
lang_toggle_lbl  = "EN" if is_es else "ES"

# ── Live graph stats (from network_service / meta JSON) ───────────────────────
@st.cache_data(ttl=3600, show_spinner=False)
def _load_graph_version() -> dict:
    try:
        return get_version_payload()
    except Exception:
        return {}

def _fmt_value(v: float) -> str:
    """Format a COP total into a readable label (e.g. $4.7B COP)."""
    if v <= 0:
        return "—"
    if v >= 1e12:
        return f"${v / 1e12:.1f}B COP"
    if v >= 1e9:
        return f"${v / 1e9:.0f}MM COP"
    return f"${v:,.0f} COP"

_ver = _load_graph_version()
_stat_nodes = str(_ver["entity_count"] + _ver["provider_count"]) if _ver.get("entity_count") else "—"
_stat_edges = str(_ver["edge_count"]) if _ver.get("edge_count") else "—"
_stat_risk  = str(_ver["risk_edge_count"]) if _ver.get("risk_edge_count") else "—"
_stat_value = _fmt_value(_ver.get("total_value", 0))

# ── Base CSS ───────────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg: #f7f2ea;
  --text: #172033;
  --text-2: rgba(23,32,51,0.74);
  --text-m: rgba(23,32,51,0.56);
  --blue: #0d5bd7;
  --yellow: #d3a21a;
  --red: #c62839;
  --green: #198754;
  --border: rgba(22,28,45,0.09);
}
#MainMenu, footer, header,
[data-testid="stToolbar"], [data-testid="stDecoration"],
[data-testid="stSidebar"], [data-testid="collapsedControl"],
[data-testid="stSidebarNav"], .stDeployButton { display: none !important; }

.stApp {
  background:
    radial-gradient(circle at 12% 10%, rgba(211,162,26,0.09), transparent 30%),
    radial-gradient(circle at 88%, rgba(13,91,215,0.07), transparent 26%),
    #f7f2ea !important;
}
[data-testid="stAppViewContainer"] { background: transparent !important; }
[data-testid="stMainBlockContainer"] { background: transparent !important; }
.block-container { padding: 0 !important; max-width: 100% !important; }

/* ── NAV ── */
.sed-nav {
  display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
  padding: 0.85rem 2rem;
  background: rgba(247,242,234,0.93);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(22,28,45,0.09);
  position: sticky; top: 0; z-index: 100;
  font-family: 'Inter', sans-serif;
}
.sed-nav-brand {
  font: 800 1.12rem/1 'Syne', sans-serif;
  color: #172033; text-decoration: none;
  letter-spacing: -0.03em;
}
.sed-nav-brand .b { color: #0d5bd7; }
.sed-nav-items { display: flex; gap: 0.4rem; align-items: center; margin-left: auto; }
.sed-nav-item {
  font-size: .8rem; padding: .3rem .8rem; border-radius: 8px;
  color: rgba(23,32,51,0.52); text-decoration: none;
}
.sed-nav-item.active {
  color: #0d5bd7; font-weight: 600;
  background: rgba(13,91,215,0.07);
  border-bottom: 2px solid #0d5bd7;
}
.sed-badge {
  font: 500 .58rem/1 'JetBrains Mono',monospace;
  background: rgba(13,91,215,0.10); color: #0d5bd7;
  border-radius: 5px; padding: 2px 6px; margin-left: 3px;
}
.sed-badge-soon {
  background: rgba(211,162,26,0.10); color: #b8890a;
}
.sed-lang {
  font: 500 .72rem/1 'JetBrains Mono',monospace;
  color: rgba(23,32,51,0.45); text-decoration: none;
  margin-left: .5rem; padding: .3rem .6rem;
  border: 1px solid rgba(22,28,45,0.12); border-radius: 6px;
}
.sed-nav::after {
  content: "";
  position: absolute; bottom: -1px; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, #d3a21a 0 33.3%, #0d5bd7 33.3% 66.6%, #c62839 66.6% 100%);
}

/* ── HERO ── */
.sed-hero {
  max-width: 1380px; margin: 0 auto;
  padding: 3.2rem 2rem 0;
}
.sed-kicker {
  font: 500 .7rem/1 'JetBrains Mono',monospace;
  letter-spacing: .16em; text-transform: uppercase;
  color: #0d5bd7; margin-bottom: .75rem;
}
.sed-title {
  font: 800 clamp(2.2rem,5vw,4rem)/0.98 'Syne',sans-serif;
  letter-spacing: -0.055em; color: #172033;
  margin-bottom: .65rem;
}
.sed-title .y { color: #d3a21a; }
.sed-title .b { color: #0d5bd7; }
.sed-title .r { color: #c62839; }
.sed-sub {
  font-size: .97rem; line-height: 1.72; color: rgba(23,32,51,0.72);
  max-width: 660px; margin-bottom: 1.8rem;
}

/* ── STAT ROW ── */
.sed-stats {
  display: flex; gap: .8rem; flex-wrap: wrap;
  max-width: 1380px; margin: 0 auto;
  padding: .8rem 2rem 0;
}
.sed-stat {
  display: flex; align-items: baseline; gap: .4rem;
  padding: .55rem 1rem; border-radius: 999px;
  background: rgba(255,255,255,0.72);
  border: 1px solid rgba(22,28,45,0.09);
  box-shadow: 0 4px 16px rgba(20,30,50,0.06);
}
.sed-stat-n {
  font: 700 1.08rem/1 'Syne',sans-serif;
  letter-spacing: -0.03em;
}
.sed-stat-l {
  font: 500 .68rem/1 'JetBrains Mono',monospace;
  text-transform: uppercase; letter-spacing: .09em;
  color: rgba(23,32,51,0.52);
}

/* ── ZOOM HINT ── */
.sed-zoom-hint {
  display: flex; align-items: center; gap: .5rem;
  max-width: 1380px; margin: 0 auto;
  padding: .5rem 2rem .3rem;
  font: 500 .68rem/1 'JetBrains Mono',monospace;
  letter-spacing: .08em; color: rgba(23,32,51,0.46);
  text-transform: uppercase;
}
.sed-zoom-hint::before {
  content: ""; display: block;
  width: 44px; height: 1px;
  background: linear-gradient(90deg, #d3a21a, #0d5bd7, #c62839);
}

/* ── GRAPH WRAP ── */
.sed-graph-wrap {
  margin: .8rem 0 0;
  padding: 0 2rem;
  max-width: 1380px;
  margin-left: auto; margin-right: auto;
}

/* ── LEGEND ── */
.sed-legend {
  display: flex; flex-wrap: wrap; gap: .6rem 1.4rem; align-items: center;
  padding: .75rem 2rem;
  max-width: 1380px; margin: 0 auto;
  border-top: 1px solid rgba(22,28,45,0.08);
}
.sed-legend-title {
  font: 500 .62rem/1 'JetBrains Mono',monospace;
  text-transform: uppercase; letter-spacing: .1em;
  color: rgba(23,32,51,0.46); margin-right: .5rem;
}
.sed-leg-item {
  display: flex; align-items: center; gap: .35rem;
  font-size: .78rem; color: rgba(23,32,51,0.68);
}
.sed-leg-node {
  width: 11px; height: 11px; border-radius: 50%;
  flex-shrink: 0;
}
.sed-leg-edge {
  width: 22px; height: 3px; border-radius: 3px;
  flex-shrink: 0;
}

/* ── METHODOLOGY / ETHICS ── */
.sed-meta {
  max-width: 1380px; margin: 0 auto;
  padding: 1.4rem 2rem 2.5rem;
}
.sed-method-box {
  background: rgba(255,255,255,0.72);
  border: 1px solid rgba(22,28,45,0.09);
  border-radius: 20px;
  padding: 1.4rem 1.6rem;
  margin-bottom: .9rem;
  box-shadow: 0 6px 24px rgba(20,30,50,0.06);
}
.sed-method-title {
  font: 700 .82rem/1 'JetBrains Mono',monospace;
  letter-spacing: .1em; text-transform: uppercase;
  color: #0d5bd7; margin-bottom: .65rem;
}
.sed-method-body {
  font-size: .88rem; line-height: 1.7; color: rgba(23,32,51,0.72);
}
.sed-ethics {
  background: rgba(211,162,26,0.09);
  border: 1px solid rgba(211,162,26,0.22);
  border-left: 4px solid #d3a21a;
  border-radius: 14px; padding: .9rem 1.2rem;
  font-size: .83rem; color: rgba(95,65,0,0.90); line-height: 1.65;
}

@media (max-width:900px) {
  .sed-nav { padding: .75rem 1.2rem; }
  .sed-hero, .sed-stats, .sed-zoom-hint, .sed-graph-wrap, .sed-legend, .sed-meta {
    padding-left: 1rem; padding-right: 1rem;
  }
  .sed-title { font-size: clamp(1.9rem, 9vw, 2.8rem); }
}
</style>
""", unsafe_allow_html=True)

# ── Navigation ─────────────────────────────────────────────────────────────────
st.markdown(f"""
<nav class="sed-nav">
  <a href="/" class="sed-nav-brand">Veedur<span class="b">IA</span></a>
  <div class="sed-nav-items">
    <a href="/ContratoLimpio" class="sed-nav-item">
      {T['nav_cl']}<span class="sed-badge">{T['nav_active']}</span>
    </a>
    <span class="sed-nav-item active">
      {T['nav_sed']}<span class="sed-badge">{T['nav_active']}</span>
    </span>
    <a href="/PromesometroNLP" class="sed-nav-item">
      {T['nav_pm']}<span class="sed-badge">{T['nav_active']}</span>
    </a>
    <a href="{lang_toggle_href}" class="sed-lang">{lang_toggle_lbl}</a>
  </div>
</nav>
""", unsafe_allow_html=True)

# ── Hero ───────────────────────────────────────────────────────────────────────
st.markdown(f"""
<div class="sed-hero">
  <div class="sed-kicker">{T['kicker']}</div>
  <div class="sed-title">
    <span class="y">Sigue</span><span class="b">El</span><span class="r">Dinero</span>
  </div>
  <div class="sed-sub">{T['sub']}</div>
</div>

<div class="sed-stats">
  <div class="sed-stat"><span class="sed-stat-n" style="color:#0d5bd7;">{_stat_nodes}</span><span class="sed-stat-l">{T['stat_nodes']}</span></div>
  <div class="sed-stat"><span class="sed-stat-n" style="color:#d3a21a;">{_stat_edges}</span><span class="sed-stat-l">{T['stat_edges']}</span></div>
  <div class="sed-stat"><span class="sed-stat-n" style="color:#c62839;">{_stat_risk}</span><span class="sed-stat-l">{T['stat_risk']}</span></div>
  <div class="sed-stat"><span class="sed-stat-n" style="color:#198754;">{_stat_value}</span><span class="sed-stat-l">{T['stat_value']}</span></div>
</div>

<div class="sed-zoom-hint">{T['zoom_hint']}</div>
""", unsafe_allow_html=True)

# ── D3 Force Graph ─────────────────────────────────────────────────────────────
GRAPH_HTML = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{
  width:100%; height:100%;
  background: #070e1a;
  overflow: hidden;
  font-family: 'Inter', sans-serif;
}}
#graph-container {{
  width: 100%; height: 100%;
  position: relative;
}}
svg {{
  width: 100%; height: 100%;
  cursor: grab;
}}
svg:active {{ cursor: grabbing; }}

/* Tooltip */
.tooltip {{
  position: absolute;
  pointer-events: none;
  background: rgba(12,22,40,0.96);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 14px;
  padding: .75rem 1rem;
  min-width: 180px;
  max-width: 240px;
  box-shadow: 0 16px 40px rgba(0,0,0,0.5);
  opacity: 0;
  transition: opacity .18s;
  z-index: 10;
}}
.tt-type {{
  font-size: .6rem; letter-spacing: .12em; text-transform: uppercase;
  color: rgba(180,210,255,0.52); margin-bottom: .3rem;
  font-family: 'JetBrains Mono', monospace;
}}
.tt-name {{
  font-size: .88rem; font-weight: 700; color: #dde8ff;
  margin-bottom: .35rem; line-height: 1.3;
}}
.tt-detail {{
  font-size: .74rem; color: rgba(180,210,255,0.65);
  line-height: 1.55;
}}
.tt-risk {{
  display: inline-flex; align-items: center; gap: .3rem;
  margin-top: .4rem;
  font-size: .68rem; font-weight: 600;
  color: #f87171; background: rgba(248,113,113,0.12);
  border-radius: 6px; padding: .25rem .55rem;
}}
.tt-safe {{
  color: #4ade80; background: rgba(74,222,128,0.10);
}}

/* Instruction overlay */
.hint-bar {{
  position: absolute;
  bottom: 1rem; left: 50%;
  transform: translateX(-50%);
  background: rgba(12,22,40,0.82);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 999px;
  padding: .42rem 1rem;
  font-size: .65rem; letter-spacing: .08em;
  color: rgba(180,210,255,0.52);
  pointer-events: none;
  white-space: nowrap;
  font-family: 'JetBrains Mono', monospace;
  text-transform: uppercase;
}}
</style>
</head>
<body>
<div id="graph-container">
  <svg id="graph-svg"></svg>
  <div class="tooltip" id="tooltip">
    <div class="tt-type" id="tt-type"></div>
    <div class="tt-name" id="tt-name"></div>
    <div class="tt-detail" id="tt-detail"></div>
    <div id="tt-risk-badge"></div>
  </div>
  <div class="hint-bar">{T['hint']}</div>
</div>

<script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"></script>
<script>
(function() {{

// ── PALETTE ────────────────────────────────────────────────────────────────
var COLOR = {{
  entity:  "#60a5fa",  // blue   – public entities
  company: "#34d399",  // teal   – contractors
  donor:   "#fbbf24",  // gold   – donors
  pol:     "#f87171",  // red    – political figures
  inter:   "#a78bfa",  // purple – intermediaries
  // edge types
  contract: "rgba(96,165,250,0.55)",
  donation: "rgba(251,191,36,0.50)",
  risk:     "rgba(248,113,113,0.75)",
  affil:    "rgba(167,139,250,0.40)",
}};

var NODE_LABELS = {{
  entity:  "{T['node_entity']}",
  company: "{T['node_company']}",
  donor:   "{T['node_donor']}",
  pol:     "{T['node_pol']}",
  inter:   "{T['node_inter']}",
}};

// ── SYNTHETIC DATA — realistic Colombian network ───────────────────────────
var nodes = [
  // ── ENTITIES (blue, large) ────────────────────────────────────────────────
  {{ id:"e1",  type:"entity",  label:"Min. Salud y Prot. Social",    size:28, value:980, dept:"Bogotá D.C." }},
  {{ id:"e2",  type:"entity",  label:"Min. Educación Nacional",      size:26, value:820, dept:"Bogotá D.C." }},
  {{ id:"e3",  type:"entity",  label:"Min. de Infraestructura",      size:30, value:1240, dept:"Bogotá D.C." }},
  {{ id:"e4",  type:"entity",  label:"INVIAS",                       size:27, value:1050, dept:"Bogotá D.C." }},
  {{ id:"e5",  type:"entity",  label:"Gobernación del Valle",        size:22, value:560, dept:"Valle del Cauca" }},
  {{ id:"e6",  type:"entity",  label:"Alcaldía de Medellín",         size:24, value:740, dept:"Antioquia" }},
  {{ id:"e7",  type:"entity",  label:"Gobernación de Antioquia",     size:23, value:680, dept:"Antioquia" }},
  {{ id:"e8",  type:"entity",  label:"IDU Bogotá",                   size:25, value:890, dept:"Bogotá D.C." }},
  {{ id:"e9",  type:"entity",  label:"Alcaldía de Cali",             size:20, value:420, dept:"Valle del Cauca" }},
  {{ id:"e10", type:"entity",  label:"Gobernación del Atlántico",    size:19, value:350, dept:"Atlántico" }},
  {{ id:"e11", type:"entity",  label:"ICBF Nacional",                size:22, value:610, dept:"Bogotá D.C." }},
  {{ id:"e12", type:"entity",  label:"Alcaldía de Barranquilla",     size:20, value:380, dept:"Atlántico" }},

  // ── CONTRACTORS (teal, medium) ────────────────────────────────────────────
  {{ id:"c1",  type:"company", label:"Consorcio Vial 2022",          size:18, value:320, nit:"900.112.334" }},
  {{ id:"c2",  type:"company", label:"ConstruVerde S.A.S.",          size:20, value:470, nit:"830.045.219" }},
  {{ id:"c3",  type:"company", label:"Infraestructuras del Norte",   size:17, value:290, nit:"800.122.047" }},
  {{ id:"c4",  type:"company", label:"Salud Integral Ltda.",         size:16, value:210, nit:"900.334.781" }},
  {{ id:"c5",  type:"company", label:"EdTech Colombia S.A.",         size:15, value:190, nit:"900.445.002" }},
  {{ id:"c6",  type:"company", label:"Grupo Constructor Andino",     size:22, value:540, nit:"830.089.117" }},
  {{ id:"c7",  type:"company", label:"Aseo y Ambiente S.A.S.",       size:14, value:145, nit:"900.670.334" }},
  {{ id:"c8",  type:"company", label:"Medicina Preventiva Ltda.",    size:15, value:180, nit:"900.221.448" }},
  {{ id:"c9",  type:"company", label:"Construyendo País S.A.S.",     size:19, value:380, nit:"900.501.229" }},
  {{ id:"c10", type:"company", label:"Tecnología Pública S.A.",      size:16, value:220, nit:"900.334.557" }},
  {{ id:"c11", type:"company", label:"Servicios Integrados Norte",   size:13, value:130, nit:"800.334.112" }},
  {{ id:"c12", type:"company", label:"Vías del Caribe S.A.",         size:18, value:340, nit:"800.229.447" }},
  {{ id:"c13", type:"company", label:"Obras Públicas Andinas",       size:20, value:415, nit:"830.112.004" }},
  {{ id:"c14", type:"company", label:"Consorcio Salud 2023",         size:17, value:260, nit:"900.778.231" }},
  {{ id:"c15", type:"company", label:"DataGov Colombia S.A.S.",      size:14, value:160, nit:"900.881.334" }},
  {{ id:"c16", type:"company", label:"Ingeniería Social Ltda.",      size:15, value:175, nit:"900.441.229" }},
  {{ id:"c17", type:"company", label:"Consorcio Infraestructura 4G", size:23, value:580, nit:"900.009.117" }},
  {{ id:"c18", type:"company", label:"ProSalud Atlántico",           size:14, value:140, nit:"900.334.662" }},
  {{ id:"c19", type:"company", label:"Logística y Transporte S.A.",  size:16, value:195, nit:"800.991.334" }},
  {{ id:"c20", type:"company", label:"EduSoft S.A.S.",               size:13, value:125, nit:"900.771.002" }},
  {{ id:"c21", type:"company", label:"Consorci Vial Pacífico",       size:20, value:450, nit:"800.334.880" }},
  {{ id:"c22", type:"company", label:"Sanidad Integral S.A.",        size:15, value:165, nit:"900.334.119" }},
  {{ id:"c23", type:"company", label:"Infraestructura Sur S.A.",     size:21, value:490, nit:"830.441.334" }},
  {{ id:"c24", type:"company", label:"Tecnología Educativa Ltda.",   size:14, value:148, nit:"900.552.334" }},
  {{ id:"c25", type:"company", label:"Vías Andinas Consorcio",       size:19, value:365, nit:"900.112.771" }},

  // ── DONORS (gold, medium) ──────────────────────────────────────────────────
  {{ id:"d1",  type:"donor",   label:"Fondo Electoral Progreso",     size:16, value:95,  party:"Partido Cambio" }},
  {{ id:"d2",  type:"donor",   label:"Alianza Empresarial Andina",   size:17, value:110, party:"Partido Nacional" }},
  {{ id:"d3",  type:"donor",   label:"Constructores Asociados",      size:15, value:75,  party:"Movimiento Verde" }},
  {{ id:"d4",  type:"donor",   label:"Fundación Infraestructura",    size:18, value:130, party:"Partido Cambio" }},
  {{ id:"d5",  type:"donor",   label:"Red Empresarial Colombia",     size:14, value:65,  party:"Partido Nacional" }},
  {{ id:"d6",  type:"donor",   label:"Grupo Salud Política",         size:15, value:80,  party:"Partido Cambio" }},
  {{ id:"d7",  type:"donor",   label:"Promotores del Desarrollo",    size:16, value:95,  party:"Movimiento Verde" }},
  {{ id:"d8",  type:"donor",   label:"Asociación Contratistas Nac.", size:17, value:115, party:"Partido Nacional" }},
  {{ id:"d9",  type:"donor",   label:"Inversiones Cívicas S.A.",     size:14, value:70,  party:"Partido Cambio" }},
  {{ id:"d10", type:"donor",   label:"Fondo Bienestar Social",       size:15, value:85,  party:"Movimiento Verde" }},
  {{ id:"d11", type:"donor",   label:"Consorcio Donantes Viales",    size:18, value:125, party:"Partido Nacional" }},
  {{ id:"d12", type:"donor",   label:"Iniciativa Salud Pública",     size:14, value:68,  party:"Partido Cambio" }},
  {{ id:"d13", type:"donor",   label:"Red de Apoyo Educativo",       size:15, value:72,  party:"Movimiento Verde" }},
  {{ id:"d14", type:"donor",   label:"Empresarios por Colombia",     size:17, value:108, party:"Partido Nacional" }},
  {{ id:"d15", type:"donor",   label:"Alianza Infraestructura 21",   size:16, value:92,  party:"Partido Cambio" }},

  // ── POLITICAL FIGURES (red, medium-large) ─────────────────────────────────
  {{ id:"p1",  type:"pol",     label:"Senador A. Restrepo",          size:21, value:0,   party:"Partido Cambio" }},
  {{ id:"p2",  type:"pol",     label:"Rep. M. Cardona",              size:18, value:0,   party:"Partido Nacional" }},
  {{ id:"p3",  type:"pol",     label:"Gobernador J. Ospina",         size:19, value:0,   party:"Movimiento Verde" }},
  {{ id:"p4",  type:"pol",     label:"Alcalde R. Montoya",           size:20, value:0,   party:"Partido Cambio" }},
  {{ id:"p5",  type:"pol",     label:"Senadora C. Herrera",          size:18, value:0,   party:"Partido Nacional" }},
  {{ id:"p6",  type:"pol",     label:"Ministro E. Vargas",           size:22, value:0,   party:"Partido Cambio" }},
  {{ id:"p7",  type:"pol",     label:"Rep. L. Bermúdez",             size:17, value:0,   party:"Movimiento Verde" }},
  {{ id:"p8",  type:"pol",     label:"Gobernadora T. Pizarro",       size:19, value:0,   party:"Partido Nacional" }},
  {{ id:"p9",  type:"pol",     label:"Concejal H. Arango",           size:16, value:0,   party:"Partido Cambio" }},
  {{ id:"p10", type:"pol",     label:"Alcaldesa D. Castaño",         size:18, value:0,   party:"Movimiento Verde" }},

  // ── INTERMEDIARIES (purple, small) ────────────────────────────────────────
  {{ id:"i1",  type:"inter",   label:"Consultoría Estratégica S.A.", size:12, value:55 }},
  {{ id:"i2",  type:"inter",   label:"Gestión & Contratos Ltda.",    size:11, value:42 }},
  {{ id:"i3",  type:"inter",   label:"Asesoría Vial Nacional",       size:12, value:48 }},
  {{ id:"i4",  type:"inter",   label:"Centro de Gestión Pública",    size:10, value:38 }},
  {{ id:"i5",  type:"inter",   label:"Nexus Contractual S.A.S.",     size:11, value:44 }},
  {{ id:"i6",  type:"inter",   label:"Plataforma Cívica Ltda.",      size:10, value:36 }},
  {{ id:"i7",  type:"inter",   label:"Intermediación Andina",        size:12, value:50 }},
  {{ id:"i8",  type:"inter",   label:"Red de Enlace Institucional",  size:10, value:40 }},
];

var links = [
  // ── ENTITY → CONTRACTOR (contract awards, blue) ──────────────────────────
  {{ source:"e3",  target:"c1",  type:"contract", value:320, label:"Vía 40E · $320M" }},
  {{ source:"e3",  target:"c6",  type:"contract", value:540, label:"Corredor Norte · $540M" }},
  {{ source:"e3",  target:"c17", type:"contract", value:580, label:"4G Bogotá-Girardot · $580M" }},
  {{ source:"e3",  target:"c9",  type:"contract", value:380, label:"Mantenimiento vial · $380M" }},
  {{ source:"e4",  target:"c1",  type:"contract", value:290, label:"Rehabilitación vías · $290M" }},
  {{ source:"e4",  target:"c3",  type:"contract", value:290, label:"Obras rurales · $290M" }},
  {{ source:"e4",  target:"c12", type:"contract", value:340, label:"Caribe vial · $340M" }},
  {{ source:"e4",  target:"c21", type:"contract", value:450, label:"Pacífico vial · $450M" }},
  {{ source:"e4",  target:"c23", type:"contract", value:490, label:"Sur vial · $490M" }},
  {{ source:"e4",  target:"c25", type:"contract", value:365, label:"Andina vial · $365M" }},
  {{ source:"e8",  target:"c2",  type:"contract", value:470, label:"Ampliación Av. 68 · $470M" }},
  {{ source:"e8",  target:"c13", type:"contract", value:415, label:"Ciclorruta Norte · $415M" }},
  {{ source:"e8",  target:"c25", type:"contract", value:280, label:"Puente Calle 100 · $280M" }},
  {{ source:"e1",  target:"c4",  type:"contract", value:210, label:"Suministros IPS · $210M" }},
  {{ source:"e1",  target:"c8",  type:"contract", value:180, label:"Medicina preventiva · $180M" }},
  {{ source:"e1",  target:"c14", type:"contract", value:260, label:"Consorcio salud · $260M" }},
  {{ source:"e1",  target:"c22", type:"contract", value:165, label:"Sanidad integral · $165M" }},
  {{ source:"e11", target:"c4",  type:"contract", value:190, label:"Bienestar familiar · $190M" }},
  {{ source:"e11", target:"c8",  type:"contract", value:145, label:"Atención integral · $145M" }},
  {{ source:"e2",  target:"c5",  type:"contract", value:190, label:"Plataforma educativa · $190M" }},
  {{ source:"e2",  target:"c20", type:"contract", value:125, label:"EduSoft licencias · $125M" }},
  {{ source:"e2",  target:"c24", type:"contract", value:148, label:"Tecnología educativa · $148M" }},
  {{ source:"e5",  target:"c9",  type:"contract", value:220, label:"Obras Valle · $220M" }},
  {{ source:"e5",  target:"c21", type:"contract", value:300, label:"Vía Pacífico · $300M" }},
  {{ source:"e6",  target:"c13", type:"contract", value:280, label:"Metro cable · $280M" }},
  {{ source:"e6",  target:"c2",  type:"contract", value:320, label:"Parques Medellín · $320M" }},
  {{ source:"e7",  target:"c3",  type:"contract", value:240, label:"Vías Antioquia · $240M" }},
  {{ source:"e7",  target:"c17", type:"contract", value:350, label:"Conexión vial · $350M" }},
  {{ source:"e9",  target:"c21", type:"contract", value:200, label:"Infraestructura Cali · $200M" }},
  {{ source:"e9",  target:"c7",  type:"contract", value:145, label:"Aseo Cali · $145M" }},
  {{ source:"e10", target:"c12", type:"contract", value:240, label:"Vías Atlántico · $240M" }},
  {{ source:"e10", target:"c11", type:"contract", value:130, label:"Servicios Norte · $130M" }},
  {{ source:"e12", target:"c12", type:"contract", value:200, label:"Obras Barranquilla · $200M" }},
  {{ source:"e12", target:"c18", type:"contract", value:140, label:"Salud Barranquilla · $140M" }},

  // ── DONOR → POLITICAL FIGURE (donations, gold) ────────────────────────────
  {{ source:"d1",  target:"p1",  type:"donation", value:35, label:"Donación campaña 2022 · $35M" }},
  {{ source:"d2",  target:"p2",  type:"donation", value:42, label:"Aporte electoral · $42M" }},
  {{ source:"d3",  target:"p3",  type:"donation", value:28, label:"Financiación territorial · $28M" }},
  {{ source:"d4",  target:"p4",  type:"donation", value:55, label:"Apoyo alcaldía · $55M" }},
  {{ source:"d5",  target:"p2",  type:"donation", value:30, label:"Fondo campaña · $30M" }},
  {{ source:"d6",  target:"p6",  type:"donation", value:40, label:"Apoyo ministerio · $40M" }},
  {{ source:"d7",  target:"p3",  type:"donation", value:35, label:"Donación gobernación · $35M" }},
  {{ source:"d8",  target:"p5",  type:"donation", value:48, label:"Financiación senado · $48M" }},
  {{ source:"d9",  target:"p1",  type:"donation", value:32, label:"Aporte cívico · $32M" }},
  {{ source:"d10", target:"p7",  type:"donation", value:38, label:"Apoyo cámara · $38M" }},
  {{ source:"d11", target:"p8",  type:"donation", value:50, label:"Gobernación apoyo · $50M" }},
  {{ source:"d12", target:"p4",  type:"donation", value:30, label:"Salud campaña · $30M" }},
  {{ source:"d13", target:"p10", type:"donation", value:33, label:"Educación electoral · $33M" }},
  {{ source:"d14", target:"p5",  type:"donation", value:46, label:"Empresarios donación · $46M" }},
  {{ source:"d15", target:"p6",  type:"donation", value:42, label:"Infraestructura apoyo · $42M" }},

  // ── DONOR/COMPANY → ENTITY (RISK LINKS, red) ─────────────────────────────
  {{ source:"d4",  target:"e3",  type:"risk", value:80, label:"⚠ NIT donante-contratista INVIAS · $80M" }},
  {{ source:"d11", target:"e4",  type:"risk", value:75, label:"⚠ NIT donante-contratista INVIAS · $75M" }},
  {{ source:"d2",  target:"e8",  type:"risk", value:60, label:"⚠ NIT donante-adjudicado IDU · $60M" }},
  {{ source:"c6",  target:"d4",  type:"risk", value:55, label:"⚠ Mismo NIT donante/contratista · $55M" }},
  {{ source:"c17", target:"d15", type:"risk", value:65, label:"⚠ NIT compartido campaña/contrato · $65M" }},
  {{ source:"c2",  target:"d3",  type:"risk", value:48, label:"⚠ Vínculo financiero detectado · $48M" }},
  {{ source:"c23", target:"d11", type:"risk", value:72, label:"⚠ Cruce SECOP/Cuentas Claras · $72M" }},
  {{ source:"c13", target:"d14", type:"risk", value:58, label:"⚠ Período electoral coincidente · $58M" }},
  {{ source:"c9",  target:"d7",  type:"risk", value:44, label:"⚠ Patrón atípico detectado · $44M" }},
  {{ source:"c21", target:"d4",  type:"risk", value:68, label:"⚠ Vinculo donante-adjudicado · $68M" }},

  // ── INTERMEDIARIES (purple) ───────────────────────────────────────────────
  {{ source:"i1",  target:"e3",  type:"contract", value:55, label:"Asesoría estratégica · $55M" }},
  {{ source:"i1",  target:"c6",  type:"affil",    value:30, label:"Vínculo consultoría" }},
  {{ source:"i2",  target:"e4",  type:"contract", value:42, label:"Gestión contratos · $42M" }},
  {{ source:"i2",  target:"c17", type:"affil",    value:25, label:"Vínculo contractual" }},
  {{ source:"i3",  target:"e8",  type:"contract", value:48, label:"Asesoría vial · $48M" }},
  {{ source:"i3",  target:"c2",  type:"affil",    value:28, label:"Enlace vial" }},
  {{ source:"i4",  target:"e1",  type:"contract", value:38, label:"Gestión salud · $38M" }},
  {{ source:"i5",  target:"e3",  type:"contract", value:44, label:"Nexus vial · $44M" }},
  {{ source:"i5",  target:"c23", type:"affil",    value:22, label:"Nexus contratista" }},
  {{ source:"i6",  target:"p1",  type:"affil",    value:20, label:"Plataforma cívica" }},
  {{ source:"i7",  target:"e7",  type:"contract", value:50, label:"Intermediación Antioquia · $50M" }},
  {{ source:"i7",  target:"c3",  type:"affil",    value:24, label:"Enlace Antioquia" }},
  {{ source:"i8",  target:"p6",  type:"affil",    value:18, label:"Red enlace ministerio" }},
  {{ source:"i8",  target:"d6",  type:"affil",    value:20, label:"Red enlace donante" }},

  // ── POLITICAL → ENTITY (political affiliation) ────────────────────────────
  {{ source:"p1",  target:"e3",  type:"affil", value:0, label:"Comisión senado infraestructura" }},
  {{ source:"p2",  target:"e1",  type:"affil", value:0, label:"Comisión salud cámara" }},
  {{ source:"p3",  target:"e5",  type:"affil", value:0, label:"Gobernación Valle afiliación" }},
  {{ source:"p4",  target:"e6",  type:"affil", value:0, label:"Alcaldía Medellín afiliación" }},
  {{ source:"p5",  target:"e2",  type:"affil", value:0, label:"Comisión educación senado" }},
  {{ source:"p6",  target:"e3",  type:"affil", value:0, label:"Min. infraestructura" }},
  {{ source:"p6",  target:"e4",  type:"affil", value:0, label:"Supervisión INVIAS" }},
  {{ source:"p7",  target:"e11", type:"affil", value:0, label:"Comisión ICBF cámara" }},
  {{ source:"p8",  target:"e10", type:"affil", value:0, label:"Gobernación Atlántico afiliación" }},
  {{ source:"p9",  target:"e9",  type:"affil", value:0, label:"Concejo Cali" }},
  {{ source:"p10", target:"e6",  type:"affil", value:0, label:"Alcaldía afiliación" }},

  // ── COMPANY → COMPANY (consortium / subcontract) ──────────────────────────
  {{ source:"c6",  target:"c1",  type:"affil", value:30, label:"Consorcio compartido" }},
  {{ source:"c17", target:"c3",  type:"affil", value:25, label:"Subcontrato 4G" }},
  {{ source:"c23", target:"c9",  type:"affil", value:20, label:"Consorcio Sur" }},
  {{ source:"c21", target:"c12", type:"affil", value:22, label:"Consorcio Pacífico" }},
  {{ source:"c2",  target:"c13", type:"affil", value:18, label:"Consorcio urbano" }},
  {{ source:"c25", target:"c1",  type:"affil", value:15, label:"Andina-Vías" }},
];

// ── D3 SETUP ────────────────────────────────────────────────────────────────
var W = window.innerWidth  || document.documentElement.clientWidth;
var H = window.innerHeight || document.documentElement.clientHeight;
var svg = d3.select("#graph-svg");
var g   = svg.append("g");

// ── DEFS: arrow markers, glow filters ────────────────────────────────────────
var defs = svg.append("defs");
// Glow filter
var glow = defs.append("filter").attr("id","glow").attr("x","-40%").attr("y","-40%").attr("width","180%").attr("height","180%");
glow.append("feGaussianBlur").attr("stdDeviation","3.5").attr("result","coloredBlur");
var feMerge = glow.append("feMerge");
feMerge.append("feMergeNode").attr("in","coloredBlur");
feMerge.append("feMergeNode").attr("in","SourceGraphic");

// Arrow markers per edge type
var arrowColors = {{ contract:"#60a5fa", donation:"#fbbf24", risk:"#f87171", affil:"#a78bfa" }};
Object.entries(arrowColors).forEach(function([type, color]) {{
  defs.append("marker")
    .attr("id", "arrow-" + type)
    .attr("viewBox", "0 -4 8 8")
    .attr("refX", 10).attr("refY", 0)
    .attr("markerWidth", 4).attr("markerHeight", 4)
    .attr("orient", "auto")
    .append("path")
      .attr("d", "M0,-4L8,0L0,4")
      .attr("fill", color)
      .attr("opacity", type === "risk" ? 0.9 : 0.6);
}});

// ── BACKGROUND GRID ─────────────────────────────────────────────────────────
var gridG = g.append("g").attr("class","grid-layer");
var gridSize = 60; var gridCols = Math.ceil(W * 3 / gridSize); var gridRows = Math.ceil(H * 3 / gridSize);
for (var gx = -gridCols; gx <= gridCols; gx++) {{
  gridG.append("line")
    .attr("x1", gx*gridSize).attr("y1", -H*1.5)
    .attr("x2", gx*gridSize).attr("y2",  H*1.5)
    .attr("stroke","rgba(255,255,255,0.028)").attr("stroke-width","1");
}}
for (var gy = -gridRows; gy <= gridRows; gy++) {{
  gridG.append("line")
    .attr("x1", -W*1.5).attr("y1", gy*gridSize)
    .attr("x2",  W*1.5).attr("y2", gy*gridSize)
    .attr("stroke","rgba(255,255,255,0.028)").attr("stroke-width","1");
}}

// ── FORCE SIMULATION ─────────────────────────────────────────────────────────
var simulation = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(links).id(function(d){{ return d.id; }})
    .distance(function(d) {{
      if (d.type === "risk")     return 90;
      if (d.type === "contract") return 110;
      if (d.type === "donation") return 120;
      return 100;
    }})
    .strength(function(d) {{
      if (d.type === "risk")     return 0.7;
      if (d.type === "contract") return 0.5;
      return 0.3;
    }})
  )
  .force("charge", d3.forceManyBody()
    .strength(function(d) {{
      var base = -280;
      if (d.type === "entity")  return base * 1.8;
      if (d.type === "pol")     return base * 1.3;
      if (d.type === "company") return base * 1.1;
      if (d.type === "donor")   return base * 0.9;
      return base * 0.7;
    }})
    .distanceMax(500)
  )
  .force("center", d3.forceCenter(0, 0).strength(0.08))
  .force("collision", d3.forceCollide().radius(function(d){{ return d.size + 8; }}).strength(0.85))
  .force("x", d3.forceX(0).strength(0.04))
  .force("y", d3.forceY(0).strength(0.04))
  .alpha(1)
  .alphaDecay(0.018)
  .velocityDecay(0.38);

// ── EDGES ─────────────────────────────────────────────────────────────────────
var edgeColors = {{ contract:"rgba(96,165,250,0.45)", donation:"rgba(251,191,36,0.45)", risk:"rgba(248,113,113,0.80)", affil:"rgba(167,139,250,0.28)" }};
var edgeWidths  = {{ contract:1.8, donation:1.6, risk:2.8, affil:1.2 }};

var link = g.append("g").attr("class","links")
  .selectAll("line")
  .data(links)
  .enter().append("line")
    .attr("stroke", function(d) {{ return edgeColors[d.type] || "rgba(255,255,255,0.2)"; }})
    .attr("stroke-width", function(d) {{
      var w = edgeWidths[d.type] || 1.5;
      if (d.value > 400) w *= 1.6;
      else if (d.value > 200) w *= 1.3;
      else if (d.value > 100) w *= 1.1;
      return w;
    }})
    .attr("stroke-dasharray", function(d) {{ return d.type === "affil" ? "5,4" : "none"; }})
    .attr("opacity", function(d) {{ return d.type === "risk" ? 0.85 : 0.60; }})
    .attr("marker-end", function(d) {{ return "url(#arrow-" + d.type + ")"; }});

// ── RISK PULSE RINGS (animated rings around risk edges source) ─────────────
var riskNodes = new Set(links.filter(function(l){{ return l.type === "risk"; }}).map(function(l){{ return l.source.id || l.source; }}));

// ── NODE GROUPS ─────────────────────────────────────────────────────────────
var node = g.append("g").attr("class","nodes")
  .selectAll("g")
  .data(nodes)
  .enter().append("g")
    .attr("class", function(d) {{ return "node-g node-" + d.type; }})
    .call(d3.drag()
      .on("start", function(event, d) {{
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      }})
      .on("drag", function(event, d) {{ d.fx = event.x; d.fy = event.y; }})
      .on("end", function(event, d) {{
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      }})
    )
    .on("mouseover", showTooltip)
    .on("mousemove", moveTooltip)
    .on("mouseout",  hideTooltip)
    .on("click",     function(event, d) {{ event.stopPropagation(); highlightNode(d); }});

// Outer pulse ring for risk nodes
node.filter(function(d) {{ return riskNodes.has(d.id); }})
  .append("circle")
    .attr("class","pulse-ring")
    .attr("r", function(d) {{ return d.size + 10; }})
    .attr("fill","none")
    .attr("stroke","rgba(248,113,113,0.35)")
    .attr("stroke-width","1.5");

// Glow halo
node.append("circle")
  .attr("r", function(d) {{ return d.size + 5; }})
  .attr("fill", function(d) {{ return COLOR[d.type]; }})
  .attr("opacity", 0.08)
  .attr("filter","url(#glow)");

// Main circle
node.append("circle")
  .attr("r", function(d) {{ return d.size; }})
  .attr("fill", function(d) {{ return COLOR[d.type]; }})
  .attr("stroke","rgba(255,255,255,0.18)")
  .attr("stroke-width","1.5")
  .attr("filter", function(d) {{ return d.type === "entity" || d.type === "pol" ? "url(#glow)" : "none"; }});

// Inner dot
node.append("circle")
  .attr("r", function(d) {{ return Math.max(3, d.size * 0.28); }})
  .attr("fill","rgba(255,255,255,0.72)")
  .attr("pointer-events","none");

// Label (only for large nodes)
node.filter(function(d) {{ return d.size >= 16; }})
  .append("text")
    .attr("dy", function(d) {{ return d.size + 13; }})
    .attr("text-anchor","middle")
    .attr("fill","rgba(210,225,255,0.78)")
    .attr("font-size","9px")
    .attr("font-family","'Inter',sans-serif")
    .attr("pointer-events","none")
    .text(function(d) {{
      var lbl = d.label;
      return lbl.length > 22 ? lbl.slice(0,21) + "…" : lbl;
    }});

// ── PULSE ANIMATION ─────────────────────────────────────────────────────────
function animatePulse() {{
  d3.selectAll(".pulse-ring")
    .attr("r", function(d) {{ return d.size + 10; }})
    .attr("opacity", 0.35)
    .transition().duration(1600).ease(d3.easeLinear)
    .attr("r", function(d) {{ return d.size + 26; }})
    .attr("opacity", 0)
    .on("end", animatePulse);
}}
animatePulse();

// ── SIMULATION TICK ──────────────────────────────────────────────────────────
simulation.on("tick", function() {{
  link
    .attr("x1", function(d) {{ return d.source.x; }})
    .attr("y1", function(d) {{ return d.source.y; }})
    .attr("x2", function(d) {{
      var dx = d.target.x - d.source.x, dy = d.target.y - d.source.y;
      var dist = Math.sqrt(dx*dx + dy*dy) || 1;
      return d.target.x - (dx/dist) * (d.target.size + 6);
    }})
    .attr("y2", function(d) {{
      var dx = d.target.x - d.source.x, dy = d.target.y - d.source.y;
      var dist = Math.sqrt(dx*dx + dy*dy) || 1;
      return d.target.y - (dy/dist) * (d.target.size + 6);
    }});
  node.attr("transform", function(d) {{ return "translate(" + d.x + "," + d.y + ")"; }});
}});

// ── ZOOM BEHAVIOR — start zoomed in (scale 1.9) centered on dense cluster ──
var initialScale = 1.85;
var zoom = d3.zoom()
  .scaleExtent([0.18, 6.0])
  .on("zoom", function(event) {{ g.attr("transform", event.transform); }});
svg.call(zoom);
var initTransform = d3.zoomIdentity
  .translate(W/2 - 40, H/2 + 30)
  .scale(initialScale);
svg.call(zoom.transform, initTransform);

// ── TOOLTIP ──────────────────────────────────────────────────────────────────
var tooltip = document.getElementById("tooltip");
var ttType  = document.getElementById("tt-type");
var ttName  = document.getElementById("tt-name");
var ttDetail= document.getElementById("tt-detail");
var ttRisk  = document.getElementById("tt-risk-badge");

function showTooltip(event, d) {{
  ttType.textContent = NODE_LABELS[d.type] || d.type;
  ttName.textContent = d.label;
  var detail = "";
  if (d.value > 0)   detail += "Valor: $" + d.value + "M COP\\n";
  if (d.dept)        detail += "Dpto: " + d.dept;
  if (d.nit)         detail += "NIT: " + d.nit;
  if (d.party)       detail += "Partido: " + d.party;
  ttDetail.innerHTML = detail.replace(/\\n/g,"<br>");
  var isRisk = riskNodes.has(d.id);
  ttRisk.innerHTML = isRisk
    ? '<span class="tt-risk">⚠ Vínculo de riesgo detectado</span>'
    : '<span class="tt-risk tt-safe">✓ Sin vínculos de riesgo</span>';
  tooltip.style.opacity = "1";
  moveTooltip(event);
}}
function moveTooltip(event) {{
  var x = event.offsetX + 14, y = event.offsetY - 14;
  if (x + 250 > W) x = event.offsetX - 260;
  if (y < 0) y = event.offsetY + 14;
  tooltip.style.left = x + "px";
  tooltip.style.top  = y + "px";
}}
function hideTooltip() {{ tooltip.style.opacity = "0"; }}

// ── HIGHLIGHT on click ───────────────────────────────────────────────────────
var highlighted = null;
function highlightNode(d) {{
  if (highlighted === d.id) {{ resetHighlight(); highlighted = null; return; }}
  highlighted = d.id;
  var connected = new Set([d.id]);
  links.forEach(function(l) {{
    var sid = l.source.id || l.source, tid = l.target.id || l.target;
    if (sid === d.id) connected.add(tid);
    if (tid === d.id) connected.add(sid);
  }});
  node.attr("opacity", function(n) {{ return connected.has(n.id) ? 1.0 : 0.18; }});
  link.attr("opacity", function(l) {{
    var sid = l.source.id || l.source, tid = l.target.id || l.target;
    return (sid === d.id || tid === d.id) ? (l.type === "risk" ? 1.0 : 0.75) : 0.05;
  }});
}}
function resetHighlight() {{
  node.attr("opacity", 1.0);
  link.attr("opacity", function(d) {{ return d.type === "risk" ? 0.85 : 0.60; }});
}}
svg.on("click", function() {{ resetHighlight(); highlighted = null; }});

// ── RESIZE ───────────────────────────────────────────────────────────────────
window.addEventListener("resize", function() {{
  W = window.innerWidth; H = window.innerHeight;
  initTransform = d3.zoomIdentity.translate(W/2-40, H/2+30).scale(initialScale);
}});

}})();
</script>
</body>
</html>
"""

# ── Render graph ───────────────────────────────────────────────────────────────
st.markdown('<div class="sed-graph-wrap">', unsafe_allow_html=True)
components.html(GRAPH_HTML, height=640, scrolling=False)
st.markdown('</div>', unsafe_allow_html=True)

# ── Legend ─────────────────────────────────────────────────────────────────────
st.markdown(f"""
<div class="sed-legend">
  <span class="sed-legend-title">{T['legend_title']}</span>

  <span class="sed-leg-item"><span class="sed-leg-node" style="background:#60a5fa;"></span>{T['node_entity']}</span>
  <span class="sed-leg-item"><span class="sed-leg-node" style="background:#34d399;"></span>{T['node_company']}</span>
  <span class="sed-leg-item"><span class="sed-leg-node" style="background:#fbbf24;"></span>{T['node_donor']}</span>
  <span class="sed-leg-item"><span class="sed-leg-node" style="background:#f87171;"></span>{T['node_pol']}</span>
  <span class="sed-leg-item"><span class="sed-leg-node" style="background:#a78bfa;"></span>{T['node_inter']}</span>

  <span style="width:1px;height:18px;background:rgba(22,28,45,0.14);margin:0 .3rem;"></span>

  <span class="sed-leg-item"><span class="sed-leg-edge" style="background:rgba(96,165,250,0.70);"></span>{T['leg_contract']}</span>
  <span class="sed-leg-item"><span class="sed-leg-edge" style="background:rgba(251,191,36,0.70);"></span>{T['leg_donation']}</span>
  <span class="sed-leg-item"><span class="sed-leg-edge" style="background:rgba(248,113,113,0.85);"></span>{T['leg_risk']}</span>
  <span class="sed-leg-item"><span class="sed-leg-edge" style="background:rgba(167,139,250,0.55);border-top:2px dashed rgba(167,139,250,0.55);"></span>{T['leg_affil']}</span>
</div>
""", unsafe_allow_html=True)

# ── Methodology + Ethics ───────────────────────────────────────────────────────
st.markdown(f"""
<div class="sed-meta">
  <div class="sed-method-box">
    <div class="sed-method-title">{T['methodology']}</div>
    <div class="sed-method-body">{T['method_body']}</div>
  </div>
  <div class="sed-ethics">{T['ethics']}</div>
</div>
""", unsafe_allow_html=True)
