"""
Phase 1: ContratoLimpio  v3
Architecture: single-component interactive panel — no ghost buttons, no full reruns on card click.
The risk highlights + detail drawer live in one components.html block.
Filters are always visible as a horizontal bar with native <select> dropdowns.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import streamlit as st
import streamlit.components.v1 as components

from src.models.isolation_forest import RED_THRESHOLD, YELLOW_THRESHOLD
from src.ui.data_loaders import (
    TABLE_PAGE_SIZE,
    get_total_row_count,
    load_full,
    load_preview,
)
from src.ui.maps import build_department_summary, render_plotly_choropleth

# ── Page config ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="ContratoLimpio | VeedurIA",
    page_icon="🚦",
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

# ── Global CSS ────────────────────────────────────────────────────────────────
st.markdown(r"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; }

#MainMenu, footer, header,
[data-testid="stToolbar"], [data-testid="stDecoration"],
[data-testid="stStatusWidget"], [data-testid="stSidebar"],
[data-testid="collapsedControl"], [data-testid="stSidebarNav"],
[data-testid="stSidebarCollapsedControl"],
.stDeployButton,
/* sidebar collapse arrow — multiple Streamlit version selectors */
button[kind="headerNoPadding"],
section[data-testid="stSidebar"] + div > button,
.css-1544g2n, .css-ffhzg2, .css-1rs6os,
div[data-testid="collapsedControl"],
/* Kill any fixed-position button in top-left that isn't a widget */
.stApp > div > button:first-child { display: none !important; }

.stApp {
    font-family: 'Inter', sans-serif !important;
    background: #060810 !important;
    color: #e8eaf0 !important;
}
.block-container {
    padding: 1.2rem 2rem 4rem !important;
    max-width: 1280px !important;
}
/* Expanders */
.stExpander {
    background: rgba(255,255,255,0.018) !important;
    border: 1px solid rgba(255,255,255,0.065) !important;
    border-radius: 16px !important;
}
.stExpander summary {
    color: rgba(180,200,230,0.65) !important;
    font-family: 'Inter', sans-serif !important;
}
/* Dataframe */
[data-testid="stDataFrame"] { border-radius: 12px; overflow: hidden; }
/* All Streamlit buttons */
div[data-testid="stButton"] > button {
    background: rgba(14,165,233,0.08) !important;
    border: 1px solid rgba(14,165,233,0.18) !important;
    color: #38bdf8 !important;
    border-radius: 10px !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 0.85rem !important; font-weight: 600 !important;
    padding: 0.55rem 1.2rem !important;
    transition: background 0.2s, transform 0.2s !important;
}
div[data-testid="stButton"] > button:hover {
    background: rgba(14,165,233,0.16) !important;
    transform: translateY(-2px) !important;
}
/* Dark inputs */
input, textarea, [data-baseweb="select"] > div,
.stTextInput input, [data-testid="stNumberInput"] input {
    background: rgba(255,255,255,0.04) !important;
    border: 1px solid rgba(255,255,255,0.09) !important;
    border-radius: 10px !important;
    color: #e8eaf0 !important;
}
[data-baseweb="popover"] *, [data-baseweb="menu"] {
    background: #0d1117 !important;
    color: #e8eaf0 !important;
}
/* Ethics */
.ethics-bar {
    background: rgba(251,191,36,0.05);
    border: 1px solid rgba(251,191,36,0.13);
    border-radius: 14px; padding: 1.1rem 1.4rem;
    font-size: 0.84rem; color: rgba(251,191,36,0.78); line-height: 1.65;
    margin-top: 1.5rem;
}
</style>
""", unsafe_allow_html=True)

# ── Helpers ───────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"
LAST_RUN_PATH = DATA_PROCESSED / "last_run.json"


def _parse_cop(raw) -> float:
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
            last_dot = s.rfind(".")
            last_comma = s.rfind(",")
            if last_comma > last_dot:
                s = s.replace(".", "").replace(",", ".")
            else:
                s = s.replace(",", "")
        elif "," in s:
            parts = s.split(",")
            if len(parts) == 2 and len(parts[1]) <= 2:
                s = s.replace(",", ".")
            else:
                s = s.replace(",", "")
        return float(s)
    except (ValueError, AttributeError):
        return 0.0


def _fmt_cop(v: float) -> str:
    if v <= 0:
        return "No disponible"
    if v >= 1e12:
        return f"${v/1e12:,.2f}B COP"
    if v >= 1e9:
        return f"${v/1e9:,.2f}MM COP"
    if v >= 1e6:
        return f"${v/1e6:,.2f}M COP"
    return f"${v:,.0f} COP"


def _staleness() -> tuple[float, bool]:
    if LAST_RUN_PATH.exists():
        try:
            with open(LAST_RUN_PATH) as f:
                data = json.load(f)
            ts = data.get("last_run_ts")
            if ts:
                hours = (
                    datetime.now(timezone.utc) - datetime.fromisoformat(ts)
                ).total_seconds() / 3600
                return hours, hours > 6
        except Exception:
            pass
    return -1, True


# ── Data ──────────────────────────────────────────────────────────────────────
if st.session_state["full_dataset"]:
    df_all = load_full()
    is_preview = False
else:
    df_all = load_preview()
    is_preview = True

# Cache total row count — only read parquet metadata once per session
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
freshness_color = "#fbbf24" if is_stale else "#4ade80"
freshness_label = (
    "Estado desconocido" if hours_ago < 0
    else ("Desactualizado" if is_stale else f"Actualizado hace {hours_ago:.0f}h")
)

# ── Top header via components.html ────────────────────────────────────────────
red_count = int((df_all["risk_score"] >= RED_THRESHOLD).sum()) if has_scores else 0
top_entity = ""
if has_scores and "nombre_entidad" in df_all.columns and red_count > 0:
    top_entity = str(
        df_all.loc[df_all["risk_score"] >= RED_THRESHOLD, "nombre_entidad"]
        .value_counts().index[0]
    )[:30]

header_html = f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&family=Inter:wght@400;600&family=JetBrains+Mono:wght@400;500&display=swap');
*{{box-sizing:border-box;margin:0;padding:0;}}
body{{background:transparent;font-family:'Inter',sans-serif;overflow:hidden;}}
.hdr{{
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;
  background:linear-gradient(135deg,rgba(14,165,233,0.08),rgba(99,102,241,0.06));
  border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:1.3rem 1.8rem;
}}
.hdr-left h1{{font-family:'Syne',sans-serif;font-size:1.65rem;font-weight:800;color:#fff;letter-spacing:-0.025em;margin:0 0 0.15rem;}}
.hdr-left p{{font-size:0.78rem;color:rgba(180,195,220,0.45);margin:0;}}
.kpis{{display:flex;gap:0.6rem;flex-wrap:wrap;align-items:center;}}
.kp{{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:0.5rem 0.9rem;text-align:center;min-width:88px;}}
.kp-l{{font-family:'JetBrains Mono',monospace;font-size:0.58rem;letter-spacing:0.09em;text-transform:uppercase;color:rgba(180,195,220,0.38);margin-bottom:0.18rem;}}
.kp-v{{font-family:'Syne',sans-serif;font-size:1.25rem;font-weight:800;letter-spacing:-0.03em;line-height:1;}}
.kp-s{{font-size:0.72rem;font-weight:600;color:rgba(200,215,235,0.7);line-height:1.3;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}}
.fr{{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:7px;
  font-family:'JetBrains Mono',monospace;font-size:0.6rem;letter-spacing:0.07em;
  background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);}}
.ml-info{{margin-top:0.8rem;font-size:0.8rem;color:rgba(180,195,220,0.6);line-height:1.5;max-width:850px;background:rgba(255,255,255,0.02);border-left:3px solid #38bdf8;padding:0.6rem 0.9rem;border-radius:0 8px 8px 0;}}
</style>
<div class="hdr">
  <div class="hdr-left">
    <h1>🚦 ContratoLimpio</h1>
    <p>Semaforo de riesgo ML &nbsp;&#183;&nbsp; SECOP II &nbsp;&#183;&nbsp; Colombia</p>
  </div>
  <div class="kpis">
    <div class="kp"><div class="kp-l">Total SECOP</div><div class="kp-v" style="color:#38bdf8">{total_in_file:,}</div></div>
    <div class="kp"><div class="kp-l">Muestra</div><div class="kp-v" style="color:#818cf8">{len(df_all):,}</div></div>
    {'<div class="kp"><div class="kp-l">Alertas rojas</div><div class="kp-v" style="color:#f87171">' + f'{red_count:,}' + '</div></div>' if has_scores else ''}
    {'<div class="kp"><div class="kp-l">Top entidad</div><div class="kp-s">' + top_entity + '</div></div>' if top_entity else ''}
    <div class="fr" style="color:{freshness_color}">&#9632; {freshness_label}</div>
    {'<div style="margin-left:0.5rem;"><a href="/" style="font-family:JetBrains Mono,monospace;font-size:0.65rem;color:rgba(56,189,248,0.6);text-decoration:none;letter-spacing:0.08em;">&#8592; Inicio</a></div>' if True else ''}
  </div>
  <div class="ml-info">
    <strong>🧠 ¿Cómo funciona?</strong> Este tablero utiliza un modelo de Machine Learning no supervisado (<em>Isolation Forest</em>) que procesa los contratos de SECOP II en tiempo real. Analiza patrones atípicos multiclasificadores (sobrecostos, plazos irregulares, modalidades inusuales) para asignar un puntaje de riesgo de 0 a 100 automático y neutral.
  </div>
</div>
"""
components.html(header_html, height=180, scrolling=False)

# ── Inline filter bar (always visible, no expander) ──────────────────────────
dept_opts = (
    ["Todos"] + sorted(df_all["departamento"].dropna().unique().tolist())
    if "departamento" in df_all.columns else ["Todos"]
)
mod_opts = (
    ["Todos"] + sorted(df_all["modalidad_de_contratacion"].dropna().unique().tolist())
    if "modalidad_de_contratacion" in df_all.columns else ["Todos"]
)
risk_opts = ["Todos", "🔴 Alto", "🟡 Medio", "🟢 Bajo"]

fc1, fc2, fc3, fc4, fc5 = st.columns([3, 3, 3, 3, 2])
with fc1:
    st.caption("Departamento")
    filter_dept_val = st.selectbox("Dpto", dept_opts, key="f_dept", label_visibility="collapsed")
with fc2:
    st.caption("Buscar entidad")
    filter_entity = st.text_input("Entidad", value="", key="f_entity", label_visibility="collapsed", placeholder="nombre o NIT...")
with fc3:
    st.caption("Modalidad")
    filter_mod_val = st.selectbox("Mod", mod_opts, key="f_mod", label_visibility="collapsed")
with fc4:
    st.caption("Semaforo de riesgo")
    filter_risk_val = st.selectbox("Riesgo", risk_opts, key="f_risk", label_visibility="collapsed")
with fc5:
    st.caption("Dataset")
    load_label = "Vista completa" if is_preview else "Vista rapida"
    if st.button(load_label, key="toggle_full"):
        st.session_state["full_dataset"] = not st.session_state["full_dataset"]
        st.session_state["selected_contract_json"] = None
        st.rerun()

if is_preview and total_in_file > len(df_all):
    st.caption(
        f"⚡ Mostrando {len(df_all):,} contratos recientes de {total_in_file:,} en SECOP II."
        " Cambia a 'Vista completa' para el historial total."
    )

# ── Apply filters ─────────────────────────────────────────────────────────────
df = df_all.copy()
if filter_dept_val and filter_dept_val != "Todos" and "departamento" in df.columns:
    df = df[df["departamento"] == filter_dept_val]
if filter_entity and "nombre_entidad" in df.columns:
    mask = df["nombre_entidad"].astype(str).str.contains(filter_entity, case=False, na=False)
    if "nit_entidad" in df.columns:
        mask |= df["nit_entidad"].astype(str).str.contains(filter_entity, case=False, na=False)
    df = df[mask]
if filter_mod_val and filter_mod_val != "Todos" and "modalidad_de_contratacion" in df.columns:
    df = df[df["modalidad_de_contratacion"] == filter_mod_val]
if filter_risk_val != "Todos" and "risk_label" in df.columns:
    risk_map = {"🔴 Alto": "risk_rojo", "🟡 Medio": "risk_amarillo", "🟢 Bajo": "risk_verde"}
    df = df[df["risk_label"] == risk_map[filter_risk_val]]

if df.empty:
    st.markdown(
        "<div style='text-align:center;padding:3rem;color:rgba(180,195,220,0.35);'>"
        "<div style='font-size:2.2rem'>📭</div>"
        "<div>Sin contratos con estos filtros. Amplia la busqueda.</div></div>",
        unsafe_allow_html=True,
    )
    st.stop()

if not has_scores:
    st.markdown(
        "<div style='text-align:center;padding:3rem;color:rgba(180,195,220,0.35);'>"
        "<div style='font-size:2.2rem'>✨</div>"
        "<div>Los puntajes de riesgo se estan calculando. Recarga en unos minutos.</div></div>",
        unsafe_allow_html=True,
    )
    st.stop()

# ── Map + Interactive panel ───────────────────────────────────────────────────
map_col, panel_col = st.columns([6, 4], gap="medium")

with map_col:
    st.markdown(
        "<p style='font-family:JetBrains Mono,monospace;font-size:0.67rem;"
        "letter-spacing:0.13em;text-transform:uppercase;color:#38bdf8;margin-bottom:0.5rem;'>"
        "MAPA DE RIESGO</p>",
        unsafe_allow_html=True,
    )
    active_dept = st.session_state.get("selected_dept")
    if active_dept:
        cc1, cc2 = st.columns([8, 2])
        with cc1:
            st.markdown(
                f"<p style='font-size:0.78rem;color:rgba(56,189,248,0.7);"
                f"font-family:JetBrains Mono,monospace;margin:0;'>📍 {active_dept}</p>",
                unsafe_allow_html=True,
            )
        with cc2:
            if st.button("✕", key="clear_dept"):
                st.session_state["selected_dept"] = None
                st.session_state["selected_contract_json"] = None
                st.rerun()

    clicked = render_plotly_choropleth(
        df_dept_national,
        active_dept_filter=[filter_dept_val] if filter_dept_val != "Todos" else None,
    )
    if clicked and clicked != st.session_state.get("selected_dept"):
        st.session_state["selected_dept"] = clicked
        st.session_state["selected_contract_json"] = None
        st.rerun()

    st.markdown(
        "<p style='font-size:0.7rem;color:rgba(180,195,220,0.28);text-align:center;"
        "font-family:JetBrains Mono,monospace;letter-spacing:0.04em;margin-top:0.35rem;'>"
        "Haz clic en un departamento para filtrar las alertas</p>",
        unsafe_allow_html=True,
    )

# ── Build top-N list for the panel ───────────────────────────────────────────
hl_source = df.copy()
active_dept = st.session_state.get("selected_dept")
if active_dept and "departamento" in hl_source.columns:
    hl_source = hl_source[
        hl_source["departamento"].str.upper().str.strip() == active_dept.upper().strip()
    ]

top_df = (
    hl_source.sort_values("risk_score", ascending=False).head(50).reset_index(drop=True)
    if "risk_score" in hl_source.columns else pd.DataFrame()
)

# Serialize top-10 for JS
card_data = []
for i, row in top_df.iterrows():
    score = float(row.get("risk_score", 0))
    score_pct = int(score * 100)
    rl = str(row.get("risk_label", "risk_verde"))
    cat = "red" if (rl == "risk_rojo" or score >= RED_THRESHOLD) else (
          "yellow" if (rl == "risk_amarillo" or score >= YELLOW_THRESHOLD) else "green")
    entity = str(row.get("nombre_entidad", "N/A"))
    provider = str(row.get("proveedor_adjudicado", "No disponible"))
    dept_v = str(row.get("departamento", ""))
    fecha = str(row.get("fecha_firma", ""))[:10]
    raw_v = row.get("valor_contrato", 0)
    valor = _fmt_cop(_parse_cop(raw_v))
    mod = str(row.get("modalidad_de_contratacion", "No disponible"))
    secop_url = str(row.get("secop_url") or row.get("urlproceso") or "")
    card_data.append({
        "idx": i,
        "score": score_pct,
        "cat": cat,
        "entity": entity,
        "entity_short": entity[:50] + "..." if len(entity) > 50 else entity,
        "provider": provider,
        "dept": dept_v,
        "fecha": fecha,
        "valor": valor,
        "mod": mod,
        "secop_url": secop_url,
    })

panel_label = f"Resultados principales <span style='opacity:0.5;'>&#183; {active_dept}</span>" if active_dept else "Resultados principales de riesgo"
card_data_json = json.dumps(card_data, ensure_ascii=False)

# ── Single-component interactive panel ───────────────────────────────────────
PANEL_HTML = f"""<!DOCTYPE html>
<html lang='es'><head>
<meta charset='UTF-8'>
<link rel='preconnect' href='https://fonts.googleapis.com'>
<link href='https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap' rel='stylesheet'>
<style>
*{{box-sizing:border-box;margin:0;padding:0;}}
html,body{{background:transparent;font-family:'Inter',sans-serif;color:#e8eaf0;overflow-x:hidden;}}

/* ── Panel header ── */
.ph{{
  font-family:'JetBrains Mono',monospace;font-size:0.67rem;
  letter-spacing:0.13em;text-transform:uppercase;color:#38bdf8;margin-bottom:0.8rem;
}}

/* ── Card ── */
@keyframes cIn{{from{{opacity:0;transform:translateX(18px);}}to{{opacity:1;transform:translateX(0);}}}}
@keyframes glowRed{{0%,100%{{box-shadow:0 0 0 0 rgba(248,113,113,0);}}50%{{box-shadow:0 0 16px 0 rgba(248,113,113,0.18);}}}}

.card{{
  display:flex;align-items:center;gap:0.75rem;
  background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.065);
  border-radius:14px;padding:0.85rem 1rem;margin-bottom:0.45rem;
  cursor:pointer;position:relative;user-select:none;
  transition:background 0.2s,border-color 0.2s,transform 0.28s cubic-bezier(0.34,1.56,0.64,1);
  animation:cIn 0.42s cubic-bezier(0.16,1,0.3,1) both;
}}
.card:hover{{background:rgba(255,255,255,0.042);border-color:rgba(255,255,255,0.12);transform:translateX(4px);}}
.card.active{{border-color:rgba(14,165,233,0.35);background:rgba(14,165,233,0.06);transform:translateX(0);}}
.card.red{{border-left:3px solid #f87171;animation:cIn 0.42s cubic-bezier(0.16,1,0.3,1) both,glowRed 3.8s ease-in-out infinite;}}
.card.yellow{{border-left:3px solid #fbbf24;}}
.card.green{{border-left:3px solid #4ade80;}}

.badge{{
  width:44px;height:44px;border-radius:10px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  font-family:'Syne',sans-serif;font-weight:800;font-size:0.95rem;
}}
.badge.red{{background:rgba(248,113,113,0.12);color:#f87171;}}
.badge.yellow{{background:rgba(251,191,36,0.12);color:#fbbf24;}}
.badge.green{{background:rgba(74,222,128,0.10);color:#4ade80;}}
.card-body{{flex:1;min-width:0;}}
.card-ent{{font-size:0.84rem;font-weight:600;color:#e8eaf0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:0.12rem;}}
.card-meta{{font-size:0.69rem;color:rgba(180,195,220,0.4);font-family:'JetBrains Mono',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}}
.arr{{color:rgba(180,195,220,0.2);font-size:0.9rem;flex-shrink:0;transition:transform 0.2s,color 0.2s;}}
.card.active .arr{{transform:rotate(90deg);color:#38bdf8;}}

/* ── Detail drawer ── */
@keyframes drawerIn{{from{{opacity:0;transform:translateY(-10px);}}to{{opacity:1;transform:translateY(0);}}}}
.drawer{{
  background:rgba(6,8,20,0.92);border:1px solid rgba(14,165,233,0.2);
  border-radius:18px;padding:1.5rem 1.6rem;margin-bottom:0.45rem;
  animation:drawerIn 0.38s cubic-bezier(0.16,1,0.3,1) both;
  display:none;
}}
.drawer.open{{display:block;}}
.dr-top{{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.2rem;}}
.dr-score{{}}
.score-n{{font-family:'Syne',sans-serif;font-size:3.2rem;font-weight:800;letter-spacing:-0.05em;line-height:1;}}
.score-d{{font-size:0.9rem;color:rgba(180,195,220,0.35);}}
.score-lbl{{font-size:0.88rem;font-weight:600;margin-top:0.18rem;}}
.score-r{{color:#f87171;}} .score-y{{color:#fbbf24;}} .score-g{{color:#4ade80;}}
.dr-close{{
  width:30px;height:30px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);
  background:rgba(255,255,255,0.04);color:rgba(180,195,220,0.5);
  display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.9rem;
  flex-shrink:0;transition:background 0.18s;
}}
.dr-close:hover{{background:rgba(255,255,255,0.09);color:#fff;}}
.dr-grid{{display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;}}
.dr-field{{}}
.dr-lbl{{font-family:'JetBrains Mono',monospace;font-size:0.59rem;letter-spacing:0.09em;text-transform:uppercase;color:rgba(180,195,220,0.35);margin-bottom:0.2rem;}}
.dr-val{{font-size:0.86rem;color:#e8eaf0;font-weight:500;word-break:break-word;line-height:1.42;}}
.secop-btn{{
  display:inline-flex;align-items:center;gap:7px;margin-top:1.1rem;
  background:rgba(14,165,233,0.08);border:1px solid rgba(14,165,233,0.2);
  color:#38bdf8;text-decoration:none;border-radius:10px;padding:0.5rem 1.1rem;
  font-size:0.82rem;font-weight:600;font-family:'Inter',sans-serif;
  transition:background 0.2s;
}}
.secop-btn:hover{{background:rgba(14,165,233,0.16);}}

/* ── Empty ── */
.empty{{text-align:center;padding:2.5rem 1rem;color:rgba(180,195,220,0.3);}}
.empty-icon{{font-size:2rem;margin-bottom:0.6rem;}}
.empty-txt{{font-size:0.9rem;}}
</style>
</head>
<body>

<div class="ph">{panel_label}</div>

<div id="list"></div>

<script>
var CARDS = {card_data_json};
var openIdx = null;

function renderLabel(cat, score){{
  if(cat==='red') return '<span class="score-lbl score-r">🔴 Riesgo Alto</span>';
  if(cat==='yellow') return '<span class="score-lbl score-y">🟡 Riesgo Medio</span>';
  return '<span class="score-lbl score-g">🟢 Riesgo Bajo</span>';
}}

function buildDrawer(c){{
  var secopBtn = c.secop_url
    ? '<a href="'+c.secop_url+'" target="_blank" class="secop-btn">Ver en SECOP II &#8599;</a>'
    : '';
  return '<div class="drawer open" id="drawer-'+c.idx+'">'
    +'<div class="dr-top">'
    +  '<div class="dr-score">'
    +    '<div class="score-n '+(c.cat==='red'?'score-r':c.cat==='yellow'?'score-y':'score-g')+'">'+c.score+'<span class="score-d">/100</span></div>'
    +    renderLabel(c.cat, c.score)
    +  '</div>'
    +  '<div class="dr-close" onclick="closeDrawer()">&#215;</div>'
    +'</div>'
    +'<div class="dr-grid">'
    +  '<div class="dr-field"><div class="dr-lbl">Entidad</div><div class="dr-val">'+esc(c.entity)+'</div></div>'
    +  '<div class="dr-field"><div class="dr-lbl">Proveedor</div><div class="dr-val">'+esc(c.provider)+'</div></div>'
    +  '<div class="dr-field"><div class="dr-lbl">Valor del contrato</div><div class="dr-val">'+esc(c.valor)+'</div></div>'
    +  '<div class="dr-field"><div class="dr-lbl">Modalidad</div><div class="dr-val">'+esc(c.mod)+'</div></div>'
    +  '<div class="dr-field"><div class="dr-lbl">Fecha de firma</div><div class="dr-val">'+esc(c.fecha)+'</div></div>'
    +  '<div class="dr-field"><div class="dr-lbl">Departamento</div><div class="dr-val">'+esc(c.dept)+'</div></div>'
    +'</div>'
    + secopBtn
    +'</div>';
}}

function esc(s){{
  var d=document.createElement('div');d.innerText=String(s||'');return d.innerHTML;
}}

function closeDrawer(){{
  openIdx = null;
  render();
}}

function toggleCard(idx){{
  openIdx = (openIdx===idx) ? null : idx;
  render();
}}

function render(){{
  var list = document.getElementById('list');
  if(!CARDS || !CARDS.length){{
    list.innerHTML='<div class="empty"><div class="empty-icon">🗺️</div><div class="empty-txt">Sin datos disponibles.</div></div>';
    return;
  }}
  var html = '';
  CARDS.forEach(function(c,i){{
    var isOpen = openIdx === c.idx;
    var delay = (i*0.055).toFixed(2)+'s';
    html += '<div class="card '+c.cat+(isOpen?' active':'')+'" style="animation-delay:'+delay+'" onclick="toggleCard('+c.idx+')">';
    html +=   '<div class="badge '+c.cat+'">'+c.score+'</div>';
    html +=   '<div class="card-body">';
    html +=     '<div class="card-ent">'+esc(c.entity_short)+'</div>';
    var meta = [c.dept, c.fecha].filter(Boolean).join(' · ');
    html +=     '<div class="card-meta">'+meta+'</div>';
    html +=   '</div>';
    html +=   '<div class="arr">›</div>';
    html += '</div>';
    if(isOpen){{
      html += buildDrawer(c);
    }}
  }});
  list.innerHTML = html;
}}

render();
</script>
</body></html>"""

with panel_col:
    components.html(PANEL_HTML, height=680, scrolling=True)

# ── Ethics ─────────────────────────────────────────────────────────────────────
st.markdown("""
<div class="ethics-bar">
  ⚖️ <strong>Aviso etico:</strong> Este analisis es informativo.
  Un puntaje alto no implica corrupcion. Verifica siempre en la fuente oficial SECOP II.
</div>
""", unsafe_allow_html=True)
