# Streamlit Patterns — VeedurIA

Mandatory patterns for all Streamlit pages and components in this project.
Every page and component must follow these conventions consistently.

---

## 1. Caching — Non-Negotiable

```python
# Data loading functions: always cache with 1-hour TTL
@st.cache_data(ttl=3600)
def load_secop_contracts(filters: dict) -> pd.DataFrame:
    ...

# ML model loading: cache as resource (loaded once, reused across sessions)
@st.cache_resource()
def load_isolation_forest_model():
    ...
```

- `st.cache_data(ttl=3600)` on **every** function that reads from disk or makes an API call.
  No exceptions. Without this, each user interaction re-fetches data.
- `st.cache_resource()` for model objects, DB connections, and other singletons.
- Never set `ttl=0` or omit `ttl` — it defeats the cache for live data.

## 2. Fragment Decorator for Heavy Components

```python
@st.fragment
def render_choropleth_map(df: pd.DataFrame):
    # Folium map rendering here
    ...

@st.fragment
def render_network_graph(G: nx.Graph):
    # Plotly graph rendering here
    ...
```

- Use `@st.fragment` on any component that renders a map, network graph, or chart
  that takes > 0.5 seconds to build.
- Fragments re-run independently without triggering a full page rerun — critical
  for interactive filters on heavy visualizations.

## 3. Language Toggle

Every page must include the language toggle in the sidebar:

```python
import streamlit as st
from src.ui.i18n import load_translations

# In every page, at the top of the script body:
st.session_state.setdefault("lang", "es")

with st.sidebar:
    lang = st.selectbox(
        "🌐 Idioma / Language",
        options=["es", "en"],
        index=0 if st.session_state["lang"] == "es" else 1,
        key="lang_selector"
    )
    st.session_state["lang"] = lang

t = load_translations(st.session_state["lang"])
```

- All user-facing strings must go through `t["key"]` — never hardcode UI text in pages.
- Keys must exist in both `/i18n/es.json` and `/i18n/en.json`.

## 4. Filter Forms — Batch Updates Only

```python
with st.form("contract_filters"):
    col1, col2 = st.columns(2)
    with col1:
        dept = st.selectbox(t["filter_dept"], options=dept_list)
    with col2:
        date_range = st.date_input(t["filter_dates"], value=(start, end))
    submitted = st.form_submit_button(t["apply_filters"])

if submitted:
    # Only runs data logic here, after explicit submit
    df = load_secop_contracts({"dept": dept, "dates": date_range})
```

- **Always** wrap filter widgets in `st.form()`.
- **Never** use bare `st.selectbox`, `st.slider`, etc. for filters — they trigger
  a full rerun on every interaction, causing excessive API calls.

## 5. Alert Cards — Always Use Components

```python
from src.ui.components import render_risk_card

# ✅ Correct
render_risk_card(contract=row, lang=st.session_state["lang"])

# ❌ Wrong — never build inline card HTML in pages
st.markdown(f"<div style='border: 1px solid red'>⚠ {row['id']}</div>",
            unsafe_allow_html=True)
```

- Every risk alert card must be built via `src/ui/components.py`.
- This ensures consistent inclusion of: risk score, SHAP factors, SECOP URL, disclaimer.

## 6. Maps

- **Library:** Folium with `streamlit-folium` (`st_folium`)
- **Color scale:** `YlOrRd` (Yellow-Orange-Red) for risk choropleth — consistent
  with semaphore convention.
- **Tile layer:** CartoDB Positron (light, loads fast, Spanish labels available)
- **GeoJSON:** Colombia departments from `/data/reference/` — do not fetch externally
  on every render.
- Always wrap map render in `@st.fragment` (see Section 2).

```python
from folium.plugins import Fullscreen
import folium
from streamlit_folium import st_folium

m = folium.Map(location=[4.5709, -74.2973], zoom_start=5,
               tiles="CartoDB positron")
# ... add choropleth layer ...
st_folium(m, width="100%", height=500)
```

## 7. Network Graphs

- **Library:** `plotly.graph_objects` — not `networkx.draw()` (matplotlib-based,
  too slow and non-interactive).
- Layout algorithm: `networkx.spring_layout()` for position computation,
  then pass node/edge coordinates to Plotly `Scatter` traces.
- Always wrap in `@st.fragment`.

## 8. Stable API Only

- **Never** use `st.experimental_*` functions — they are deprecated/removed.
- Use only the stable Streamlit API (`st.cache_data`, `st.cache_resource`,
  `st.fragment`, `st.dialog`, `st.popover`, etc.).
- Check the Streamlit changelog before using any function added after v1.30.

## 9. Page Configuration

Every page file must start with:

```python
import streamlit as st

st.set_page_config(
    page_title="VeedurIA — [Page Name]",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded"
)
```

- `layout="wide"` is mandatory — the maps and graphs need horizontal space.
- `st.set_page_config()` must be the **first Streamlit call** in the script.

## 10. Error Handling in Pages

```python
try:
    df = load_secop_contracts(filters)
except Exception as e:
    st.error(t["error_loading_data"])
    st.caption(f"Detalle técnico: {type(e).__name__}")
    st.stop()
```

- Never let unhandled exceptions surface raw tracebacks to the public UI.
- Always show a user-friendly error message using the i18n key.
- Use `st.stop()` to halt page execution cleanly after an error.
