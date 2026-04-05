"""
VeedurIA landing page.

Light civic-tech visual system with Colombian flag accents, GSAP reveals,
and a cursor/touch-reactive hero field.
"""

import html

import streamlit as st
import streamlit.components.v1 as components


st.set_page_config(
    page_title="VeedurIA - Radar ciudadano de contratos publicos",
    page_icon="V",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown(
    """
<style>
#MainMenu, footer, header, [data-testid="stToolbar"],
[data-testid="stDecoration"], [data-testid="stStatusWidget"],
[data-testid="stSidebar"], [data-testid="collapsedControl"],
[data-testid="stSidebarNav"], .stDeployButton,
.stAppViewBlockContainer > div:first-child,
[data-testid="stMainBlockContainer"] {
  display: none !important;
}
.stApp { background: #f7f2ea !important; }
.block-container { padding: 0 !important; max-width: 100% !important; }
iframe { display: block; border: none; }
</style>
""",
    unsafe_allow_html=True,
)


SUPPORTED_LANGUAGES = ("es", "en")


def _get_lang() -> str:
    raw = st.query_params.get("lang")
    if isinstance(raw, list):
        raw = raw[0] if raw else None
    lang = raw or st.session_state.get("lang") or "es"
    if lang not in SUPPORTED_LANGUAGES:
        lang = "es"
    st.session_state["lang"] = lang
    return lang


def _render_template(template: str, replacements: dict[str, str]) -> str:
    rendered = template
    for key, value in replacements.items():
        rendered = rendered.replace(f"__{key}__", value)
    return rendered


lang = _get_lang()
is_es = lang == "es"

landing_copy = {
    "es": {
        "nav_model": "Modelo",
        "nav_flow": "Como funciona",
        "nav_roadmap": "Roadmap",
        "nav_cta": "Abrir ContratoLimpio",
        "eyebrow": "SECOP II · Cuentas Claras · Registraduria · IA civica",
        "hero_1": "Contratos, promesas",
        "hero_2a": "dinero",
        "hero_2b": "y redes: todo",
        "hero_3a": "legible",
        "hero_3b": "para",
        "hero_3c": "Colombia",
        "hero_sub": "VeedurIA conecta tres frentes de escrutinio ciudadano: detecta contratos atipicos en SECOP II, mapea redes de financiacion entre donantes y contratistas, y compara promesas electorales con acciones reales. El modelo prioriza. La verificacion sigue siendo tuya.",
        "chip_1": "25 variables por contrato",
        "chip_2": "factores claros, no caja negra",
        "chip_3": "fuente oficial enlazada",
        "cta_primary": "Explorar la plataforma",
        "cta_secondary": "Ver como funciona",
        "scroll": "Baja para ver el sistema",
        "status": "Mueve el cursor o toca la pantalla",
        "signal_source": "Fuente",
        "signal_source_title": "SECOP II",
        "signal_source_body": "Contratos oficiales y trazabilidad directa a la fuente publica.",
        "signal_model": "Modelo",
        "signal_model_title": "Isolation Forest",
        "signal_model_body": "Detecta patrones que rompen el comportamiento historico.",
        "signal_explain": "Explicacion",
        "signal_explain_title": "SHAP + criterio humano",
        "signal_explain_body": "La IA sugiere prioridades. El ciudadano confirma contexto y documentos.",
        "play_caption": "<strong>Campo interactivo.</strong> Acerca el cursor para alterar la red de senales y simular como VeedurIA conecta fuente, modelo y explicacion.",
        "legend_y": "foco",
        "legend_b": "modelo",
        "legend_r": "alerta",
        "stat_1_label": "contratos procesados",
        "stat_1_copy": "Base de trabajo para identificar contratos que rompen el patron historico.",
        "stat_2_label": "variables por contrato",
        "stat_2_copy": "Valor, tiempo, competencia, proveedor, modalidad y contexto electoral.",
        "stat_3_label": "anomalia esperada",
        "stat_3_copy": "El modelo prioriza la franja mas inusual para revisarla primero.",
        "stat_4_label": "tiempo de exploracion",
        "stat_4_copy": "De entrar a la plataforma a revisar una alerta concreta con enlace oficial.",
        "sec_model_eyebrow": "Modelo",
        "sec_model_title": "IA util, <span class=\"flag-word\">explicable</span> y verificable",
        "sec_model_copy": "La plataforma no intenta reemplazar criterio humano. Ordena el universo de contratos, explica por que una alerta sube de prioridad y te manda siempre de vuelta a SECOP II.",
        "ml_1_k": "01 · motor", "ml_1_m": "IF", "ml_1_t": "Isolation Forest", "ml_1_b": "Aprende como luce un contrato tipico y destaca los que se salen de ese comportamiento sin necesidad de etiquetas previas.",
        "ml_2_k": "02 · entrada", "ml_2_m": "25", "ml_2_t": "25 variables por contrato", "ml_2_b": "Monto, plazo, modalidad, numero de oferentes, proveedor, temporalidad y otros indicadores que ayudan a leer rarezas.",
        "ml_3_k": "03 · salida", "ml_3_m": "0-100", "ml_3_t": "Puntaje de 0 a 100", "ml_3_b": "No es una prueba de fraude. Es una medida de que tan inusual se ve ese contrato frente al patron observado.",
        "ml_4_k": "04 · criterio", "ml_4_m": "REV", "ml_4_t": "Rojo no es condena", "ml_4_b": "Rojo solo significa prioridad alta de revision. La lectura responsable exige contexto, documentos y verificacion humana.",
        "sec_flow_eyebrow": "Flujo",
        "sec_flow_title": "Del dato bruto a una alerta que se entiende",
        "sec_flow_copy": "El objetivo no es mostrar tablas gigantes. Es llevarte rapido desde la pregunta inicial hasta el contrato exacto que conviene revisar primero.",
        "flow_1_k": "01 · detectar", "flow_1_m": "ML", "flow_1_t": "El sistema ordena el ruido", "flow_1_b": "ContratoLimpio lee el universo disponible y deja arriba los casos que se apartan con mas fuerza del comportamiento habitual.",
        "flow_2_k": "02 · explicar", "flow_2_m": "SH", "flow_2_t": "Cada alerta trae su por que", "flow_2_b": "El puntaje no queda solo. Ves los factores que elevaron la anomalia y puedes entender por donde empezar la verificacion.",
        "flow_3_k": "03 · verificar", "flow_3_m": "SC", "flow_3_t": "Siempre termina en SECOP II", "flow_3_b": "Cada hallazgo remite a la fuente oficial. La plataforma acompana la lectura; no la sustituye.",
        "sec_product_eyebrow": "Producto",
        "sec_product_title": "Una interfaz hecha para <span class=\"flag-word\">auditar</span>, no para perderse",
        "sec_product_copy": "La experiencia prioriza orientacion, explicabilidad y trazabilidad. Menos dashboard generico. Mas camino claro desde el mapa hasta el contrato puntual.",
        "f1_tag": "mapa nacional", "f1_t": "Colombia como superficie de lectura", "f1_b": "El mapa te deja identificar rapido donde se concentra el riesgo promedio. El click sobre cada departamento redefine el panel derecho y reduce friccion para una primera exploracion.",
        "f2_tag": "explicabilidad", "f2_t": "SHAP en lenguaje entendible", "f2_b": "No basta con decir que un contrato salio raro. La interfaz explica que variables empujaron el puntaje hacia arriba y cuales lo moderan.",
        "f3_tag": "prioridad", "f3_t": "Top alertas claras", "f3_b": "La primera vista no es una tabla cruda. Es una lista priorizada y legible de contratos que vale la pena mirar primero.",
        "f4_tag": "rendimiento", "f4_t": "Carga rapida", "f4_b": "Vista inicial ligera para entrar rapido y opcion de ampliar al historial completo cuando haga falta.",
        "f5_tag": "etica", "f5_t": "Diseno responsable", "f5_b": "Cada pantalla recuerda que la alerta es preventiva. La plataforma esta pensada para escrutinio, no para acusaciones automaticas.",
        "sec_platform_eyebrow": "Plataforma",
        "sec_platform_title": "Tres fases para seguir el rastro completo",
        "sec_platform_copy": "ContratoLimpio ya esta activo. Las siguientes fases conectan dinero, redes y cumplimiento para que la plataforma se lea como un sistema continuo, no como una pagina aislada.",
        "ph1_state": "fase 1 activa", "ph1_name": "ContratoLimpio", "ph1_body": "Deteccion de contratos atipicos en SECOP II. Mapa, lista priorizada, explicacion SHAP y enlace directo a la fuente oficial.",
        "ph2_state": "fase 2 en camino", "ph2_name": "SigueElDinero", "ph2_body": "Relaciones entre contratistas, entidades, flujos economicos y nodos politicos para seguir redes y concentraciones.",
        "ph3_state": "fase 3 activa", "ph3_name": "PromesometroNLP", "ph3_body": "Comparacion entre promesas publicas y ejecucion real con apoyo de NLP y datos abiertos de contratacion.",
        "cta_title": "Empieza por lo que ya esta vivo",
        "cta_copy": "Abre ContratoLimpio, filtra por territorio o nivel de riesgo y revisa una alerta con contexto suficiente para decidir si vale la pena seguir tirando del hilo.",
        "cta_button": "Entrar a ContratoLimpio",
        "footer": "VeedurIA · plataforma civica experimental para lectura responsable de contratacion publica",
        "lang_es": "ES",
        "lang_en": "EN",
    },
    "en": {
        "nav_model": "Model",
        "nav_flow": "How it works",
        "nav_roadmap": "Roadmap",
        "nav_cta": "Open ContratoLimpio",
        "eyebrow": "SECOP II · Cuentas Claras · Registraduria · Civic AI",
        "hero_1": "Contracts, promises,",
        "hero_2a": "money",
        "hero_2b": "and networks: all",
        "hero_3a": "readable",
        "hero_3b": "for",
        "hero_3c": "Colombia",
        "hero_sub": "VeedurIA connects three lines of civic scrutiny: it detects atypical contracts in SECOP II, maps financial networks between donors and contractors, and compares electoral promises against real actions. The model prioritizes. Verification is yours.",
        "chip_1": "25 variables per contract",
        "chip_2": "clear factors, not a black box",
        "chip_3": "official source linked",
        "cta_primary": "Explore the platform",
        "cta_secondary": "See how it works",
        "scroll": "Scroll to see the system",
        "status": "Move the cursor or touch the screen",
        "signal_source": "Source",
        "signal_source_title": "SECOP II",
        "signal_source_body": "Official contracts with direct traceability to the public source.",
        "signal_model": "Model",
        "signal_model_title": "Isolation Forest",
        "signal_model_body": "Detects patterns that break historical behavior.",
        "signal_explain": "Explanation",
        "signal_explain_title": "SHAP + human review",
        "signal_explain_body": "AI suggests priorities. People confirm context and documents.",
        "play_caption": "<strong>Interactive field.</strong> Move the cursor to disturb the signal network and simulate how VeedurIA connects source, model, and explanation.",
        "legend_y": "focus",
        "legend_b": "model",
        "legend_r": "alert",
        "stat_1_label": "contracts processed",
        "stat_1_copy": "Working base used to identify contracts that break the historical pattern.",
        "stat_2_label": "variables per contract",
        "stat_2_copy": "Value, time, competition, provider, modality, and electoral context.",
        "stat_3_label": "expected anomaly band",
        "stat_3_copy": "The model prioritizes the most unusual slice for review first.",
        "stat_4_label": "time to first review",
        "stat_4_copy": "From entering the product to reviewing a specific alert with the official source.",
        "sec_model_eyebrow": "Model",
        "sec_model_title": "Useful AI, <span class=\"flag-word\">explainable</span> and verifiable",
        "sec_model_copy": "The platform does not try to replace human judgment. It orders the contract universe, explains why an alert rises in priority, and always sends you back to SECOP II.",
        "ml_1_k": "01 · engine", "ml_1_m": "IF", "ml_1_t": "Isolation Forest", "ml_1_b": "Learns what a typical contract looks like and highlights the ones that deviate, without needing prior labels.",
        "ml_2_k": "02 · input", "ml_2_m": "25", "ml_2_t": "25 variables per contract", "ml_2_b": "Amount, timeline, modality, bidder count, provider, timing, and other indicators that help read irregularity.",
        "ml_3_k": "03 · output", "ml_3_m": "0-100", "ml_3_t": "Score from 0 to 100", "ml_3_b": "It is not proof of fraud. It is a measure of how unusual the contract looks against the observed pattern.",
        "ml_4_k": "04 · judgment", "ml_4_m": "REV", "ml_4_t": "Red is not a verdict", "ml_4_b": "Red only means high review priority. Responsible reading still requires context, documents, and human verification.",
        "sec_flow_eyebrow": "Flow",
        "sec_flow_title": "From raw data to an alert you can understand",
        "sec_flow_copy": "The goal is not to show giant tables. It is to take you quickly from the first question to the one contract worth checking first.",
        "flow_1_k": "01 · detect", "flow_1_m": "ML", "flow_1_t": "The system orders the noise", "flow_1_b": "ContratoLimpio reads the available universe and keeps the strongest deviations from typical behavior at the top.",
        "flow_2_k": "02 · explain", "flow_2_m": "SH", "flow_2_t": "Every alert comes with a why", "flow_2_b": "The score never stands alone. You see the factors that raised the anomaly and get a clearer starting point for review.",
        "flow_3_k": "03 · verify", "flow_3_m": "SC", "flow_3_t": "It always ends in SECOP II", "flow_3_b": "Every finding points back to the official source. The platform supports reading; it does not replace it.",
        "sec_product_eyebrow": "Product",
        "sec_product_title": "An interface built to <span class=\"flag-word\">audit</span>, not to confuse",
        "sec_product_copy": "The experience prioritizes orientation, explainability, and traceability. Less generic dashboard, more clear path from map to specific contract.",
        "f1_tag": "national map", "f1_t": "Colombia as a reading surface", "f1_b": "The map helps you quickly identify where average risk is concentrated. Clicking a department reorders the right panel and reduces friction in a first review.",
        "f2_tag": "explainability", "f2_t": "SHAP in understandable language", "f2_b": "It is not enough to say a contract looks strange. The interface explains which variables pushed the score up and which ones moderated it.",
        "f3_tag": "priority", "f3_t": "Clear lead cases", "f3_b": "The first view is not a raw table. It is a ranked set of contracts that are worth checking first.",
        "f4_tag": "performance", "f4_t": "Fast load", "f4_b": "Light initial view to enter quickly, with the option to expand into the full history when needed.",
        "f5_tag": "ethics", "f5_t": "Responsible design", "f5_b": "Every screen reminds you that an alert is preventive. The platform is built for scrutiny, not automatic accusations.",
        "sec_platform_eyebrow": "Platform",
        "sec_platform_title": "Three phases to follow the full trail",
        "sec_platform_copy": "ContratoLimpio is already active. The next phases connect money, networks, and delivery so the platform reads as one continuous system rather than an isolated page.",
        "ph1_state": "phase 1 active", "ph1_name": "ContratoLimpio", "ph1_body": "Detection of atypical SECOP II contracts. Map, ranked list, SHAP explanation, and direct link to the official source.",
        "ph2_state": "phase 2 ahead", "ph2_name": "SigueElDinero", "ph2_body": "Relationships among contractors, entities, financial flows, and political nodes to follow networks and concentration.",
        "ph3_state": "phase 3 active", "ph3_name": "PromesometroNLP", "ph3_body": "Comparison between public promises and actual execution with support from NLP and open contracting data.",
        "cta_title": "Start with what is already live",
        "cta_copy": "Open ContratoLimpio, filter by territory or risk level, and review an alert with enough context to decide whether it is worth pulling the thread further.",
        "cta_button": "Enter ContratoLimpio",
        "footer": "VeedurIA · experimental civic platform for responsible reading of public procurement",
        "lang_es": "ES",
        "lang_en": "EN",
    },
}[lang]

replacements = {k.upper(): html.escape(v, quote=False) if "<" not in v else v for k, v in landing_copy.items()}
replacements.update(
    {
        "LANG_SWITCH": (
            f'<div class="lang-switch">'
            f'<a href="/?lang=es" class="lang-link {"active" if is_es else ""}">{landing_copy["lang_es"]}</a>'
            f'<a href="/?lang=en" class="lang-link {"active" if not is_es else ""}">{landing_copy["lang_en"]}</a>'
            f"</div>"
        ),
        "PHASE_URL": f"/ContratoLimpio?lang={lang}",
    }
)


LANDING_HTML = r"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VeedurIA</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@500;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #f7f2ea;
  --bg-2: #f1ebe1;
  --surface: rgba(255, 255, 255, 0.74);
  --surface-strong: #fffdf8;
  --surface-soft: #f8f4ed;
  --border: rgba(22, 28, 45, 0.08);
  --border-strong: rgba(22, 28, 45, 0.14);
  --text: #172033;
  --text-2: rgba(23, 32, 51, 0.68);
  --text-m: rgba(23, 32, 51, 0.42);
  --yellow: #d3a21a;
  --blue: #0d5bd7;
  --blue-2: #2f7cff;
  --red: #c62839;
  --green: #198754;
  --shadow-sm: 0 6px 24px rgba(20, 30, 50, 0.06);
  --shadow-md: 0 18px 50px rgba(20, 30, 50, 0.10);
  --radius-lg: 28px;
  --radius-md: 20px;
  --radius-sm: 14px;
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html { scroll-behavior: smooth; }

body {
  font-family: "Inter", sans-serif;
  color: var(--text);
  background:
    radial-gradient(circle at top left, rgba(211, 162, 26, 0.12), transparent 28%),
    radial-gradient(circle at bottom right, rgba(13, 91, 215, 0.10), transparent 24%),
    linear-gradient(180deg, #f8f3eb 0%, #f6f1e9 45%, #f2ede4 100%);
  overflow-x: hidden;
}

a { color: inherit; }

.page-shell {
  position: relative;
  min-height: 100vh;
}

.noise {
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.13;
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.025) 1px, transparent 1px);
  background-size: 76px 76px;
  mask-image: radial-gradient(circle at center, black 45%, transparent 85%);
  -webkit-mask-image: radial-gradient(circle at center, black 45%, transparent 85%);
}

.navbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 2.4rem;
  backdrop-filter: blur(16px);
  background: rgba(247, 242, 234, 0.78);
  border-bottom: 1px solid rgba(23, 32, 51, 0.06);
}

.nav-logo {
  font-family: "Syne", sans-serif;
  font-size: 1.26rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  text-decoration: none;
}

.nav-logo .y { color: var(--yellow); }
.nav-logo .b { color: var(--blue); }
.nav-logo .r { color: var(--red); }

.nav-links {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  list-style: none;
}

.nav-links a {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-2);
  text-decoration: none;
  transition: color 0.2s ease;
}

.nav-links a:hover { color: var(--blue); }

.nav-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.85rem 1.2rem;
  border-radius: 999px;
  text-decoration: none;
  color: #fff;
  background: linear-gradient(135deg, var(--blue), var(--blue-2));
  box-shadow: 0 10px 22px rgba(13, 91, 215, 0.20);
  font-size: 0.88rem;
  font-weight: 700;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.nav-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 34px rgba(13, 91, 215, 0.28);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.lang-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem;
  border-radius: 999px;
  background: rgba(255,255,255,0.64);
  border: 1px solid var(--border);
}

.lang-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 32px;
  border-radius: 999px;
  text-decoration: none;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.69rem;
  letter-spacing: 0.08em;
  color: var(--text-m);
}

.lang-link.active {
  background: rgba(13, 91, 215, 0.10);
  color: var(--blue);
}

.hero {
  position: relative;
  padding: 2rem 2.4rem 1.45rem;
}

.hero-grid {
  max-width: 1220px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(420px, 0.92fr);
  gap: 2rem;
  align-items: center;
}

.hero-copy {
  position: relative;
  z-index: 2;
}

.eyebrow-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(13, 91, 215, 0.12);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.68rem;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: var(--blue);
  margin-bottom: 1rem;
  box-shadow: var(--shadow-sm);
}

.eyebrow-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--blue);
  box-shadow: 0 0 0 0 rgba(13, 91, 215, 0.36);
  animation: pulse-dot 2s infinite;
}

@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 0 0 rgba(13, 91, 215, 0.36); }
  60% { box-shadow: 0 0 0 9px rgba(13, 91, 215, 0); }
}

.hero-title {
  font-family: "Syne", sans-serif;
  font-size: clamp(3.25rem, 6vw, 5.9rem);
  font-weight: 800;
  line-height: 0.98;
  letter-spacing: -0.065em;
  margin-bottom: 0.95rem;
}

.title-line {
  display: block;
  overflow: hidden;
  padding-bottom: 0.08em;
}

.title-line > span {
  display: inline-block;
  transform: translateY(115%);
  opacity: 0;
}

.title-yellow { color: var(--yellow); }
.title-blue { color: var(--blue); }
.title-red { color: var(--red); }

.hero-sub {
  max-width: 560px;
  font-size: 1.02rem;
  line-height: 1.72;
  color: var(--text-2);
  margin-bottom: 1.15rem;
  opacity: 0;
}

.hero-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-bottom: 1.25rem;
  opacity: 0;
}

.hero-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 0.82rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid var(--border);
  font-size: 0.82rem;
  color: var(--text-2);
  box-shadow: var(--shadow-sm);
}

.hero-chip strong { color: var(--text); font-weight: 700; }

.cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  opacity: 0;
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.95rem 1.28rem;
  border-radius: 999px;
  text-decoration: none;
  font-weight: 700;
  transition: transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease, background 0.24s ease;
}

.btn-primary {
  color: #fff;
  background: linear-gradient(135deg, var(--blue), var(--blue-2));
  box-shadow: 0 16px 34px rgba(13, 91, 215, 0.22);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 22px 42px rgba(13, 91, 215, 0.26);
}

.btn-secondary {
  color: var(--text);
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  transform: translateY(-2px);
  border-color: rgba(13, 91, 215, 0.28);
  background: rgba(255, 255, 255, 0.92);
}

.hero-visual-wrap {
  position: relative;
  min-height: 470px;
  opacity: 0;
}

.hero-visual {
  position: relative;
  min-height: 470px;
  border-radius: 34px;
  background:
    linear-gradient(160deg, rgba(255, 255, 255, 0.9), rgba(248, 243, 236, 0.84)),
    radial-gradient(circle at top left, rgba(211, 162, 26, 0.12), transparent 36%),
    radial-gradient(circle at bottom right, rgba(13, 91, 215, 0.12), transparent 32%);
  border: 1px solid rgba(13, 91, 215, 0.10);
  box-shadow: 0 28px 60px rgba(31, 41, 55, 0.10);
  overflow: hidden;
}

.hero-visual::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 15% 20%, rgba(211, 162, 26, 0.18), transparent 22%),
    radial-gradient(circle at 85% 18%, rgba(13, 91, 215, 0.14), transparent 22%),
    radial-gradient(circle at 82% 78%, rgba(198, 40, 57, 0.11), transparent 18%);
  opacity: 0.95;
}

.visual-topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--yellow) 0 34%, var(--blue) 34% 68%, var(--red) 68% 100%);
}

.visual-status {
  position: absolute;
  top: 1.1rem;
  left: 1.1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0.7rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid var(--border);
  backdrop-filter: blur(10px);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-2);
  z-index: 3;
}

.visual-status .status-blue,
.visual-status .status-yellow,
.visual-status .status-red {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-yellow { background: var(--yellow); }
.status-blue { background: var(--blue); }
.status-red { background: var(--red); }

.playfield {
  position: absolute;
  inset: 1rem;
  border-radius: 28px;
  overflow: hidden;
}

.play-grid {
  position: absolute;
  inset: 0;
  opacity: 0.16;
  background-image:
    linear-gradient(rgba(23, 32, 51, 0.12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(23, 32, 51, 0.12) 1px, transparent 1px);
  background-size: 44px 44px;
}

.mesh-layer {
  position: absolute;
  inset: 0;
}

.mesh-dot {
  position: absolute;
  width: 10px;
  height: 10px;
  margin-left: -5px;
  margin-top: -5px;
  border-radius: 50%;
  background: rgba(13, 91, 215, 0.18);
  box-shadow: 0 0 0 1px rgba(13, 91, 215, 0.08);
}

.mesh-dot.hot-yellow { background: rgba(211, 162, 26, 0.28); }
.mesh-dot.hot-blue { background: rgba(13, 91, 215, 0.28); }
.mesh-dot.hot-red { background: rgba(198, 40, 57, 0.28); }

.mesh-line {
  position: absolute;
  height: 1px;
  transform-origin: left center;
  background: linear-gradient(90deg, rgba(13, 91, 215, 0.18), rgba(198, 40, 57, 0.12));
  opacity: 0.42;
}

.signal-card {
  position: absolute;
  min-width: 148px;
  padding: 0.95rem 1rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(13, 91, 215, 0.10);
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 30px rgba(19, 29, 45, 0.10);
  z-index: 3;
}

.signal-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 18px 18px 0 0;
}

.signal-card.yellow::before { background: var(--yellow); }
.signal-card.blue::before { background: var(--blue); }
.signal-card.red::before { background: var(--red); }

.signal-card small {
  display: block;
  margin-bottom: 0.35rem;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.63rem;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--text-m);
}

.signal-card strong {
  display: block;
  font-family: "Syne", sans-serif;
  font-size: 1rem;
  letter-spacing: -0.03em;
  margin-bottom: 0.24rem;
}

.signal-card p {
  font-size: 0.75rem;
  line-height: 1.56;
  color: var(--text-2);
}

.card-a { top: 17%; left: 10%; }
.card-b { top: 12%; right: 8%; }
.card-c { bottom: 11%; left: 26%; }

.play-pointer {
  position: absolute;
  width: 74px;
  height: 74px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(13, 91, 215, 0.18), rgba(13, 91, 215, 0));
  pointer-events: none;
  opacity: 0;
  mix-blend-mode: multiply;
  z-index: 2;
  transform: translate(-50%, -50%);
}

.play-caption {
  position: absolute;
  left: 1.1rem;
  right: 1.1rem;
  bottom: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0.9rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid var(--border);
  backdrop-filter: blur(12px);
  z-index: 3;
}

.play-caption p {
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--text-2);
}

.play-caption strong { color: var(--text); }

.play-legend {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.legend-dot {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: var(--text-m);
}

.legend-dot::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-yellow::before { background: var(--yellow); }
.legend-blue::before { background: var(--blue); }
.legend-red::before { background: var(--red); }

.scroll-cue {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  margin-top: 1rem;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.66rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-m);
  opacity: 0;
}

.scroll-line {
  width: 52px;
  height: 1px;
  background: linear-gradient(90deg, var(--yellow), var(--blue), var(--red));
}

.stats-band {
  max-width: 1220px;
  margin: 0 auto;
  padding: 0 2.4rem 1.65rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.95rem;
}

.stat-card {
  padding: 1.15rem 1.15rem 1rem;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  opacity: 0;
  transform: translateY(34px);
}

.stat-card::before {
  content: "";
  display: block;
  width: 54px;
  height: 3px;
  border-radius: 999px;
  margin-bottom: 0.85rem;
}

.stat-card.yellow::before { background: var(--yellow); }
.stat-card.blue::before { background: var(--blue); }
.stat-card.red::before { background: var(--red); }
.stat-card.green::before { background: var(--green); }

.stat-value {
  font-family: "Syne", sans-serif;
  font-size: clamp(2rem, 4vw, 3.1rem);
  line-height: 0.94;
  letter-spacing: -0.05em;
  margin-bottom: 0.32rem;
}

.stat-value .accent-blue { color: var(--blue); }
.stat-value .accent-red { color: var(--red); }
.stat-value .accent-yellow { color: var(--yellow); }
.stat-value .accent-green { color: var(--green); }

.stat-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.68rem;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: var(--text-m);
  margin-bottom: 0.4rem;
}

.stat-copy {
  font-size: 0.82rem;
  line-height: 1.58;
  color: var(--text-2);
}

.divider {
  height: 1px;
  max-width: 1220px;
  margin: 0 auto;
  background: linear-gradient(90deg, transparent, rgba(23, 32, 51, 0.10), transparent);
}

.section {
  max-width: 1220px;
  margin: 0 auto;
  padding: 4.7rem 2.4rem;
}

.section-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.76fr);
  gap: 1.5rem;
  align-items: end;
  margin-bottom: 2rem;
}

.eyebrow {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--blue);
  margin-bottom: 0.75rem;
}

.section-title {
  font-family: "Syne", sans-serif;
  font-size: clamp(2rem, 4.2vw, 3.35rem);
  font-weight: 800;
  line-height: 0.98;
  letter-spacing: -0.055em;
}

.section-title .flag-word {
  background: linear-gradient(90deg, var(--yellow) 0 30%, var(--blue) 30% 70%, var(--red) 70% 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.section-title::after {
  content: "";
  display: block;
  width: 64px;
  height: 4px;
  border-radius: 999px;
  margin-top: 0.9rem;
  background: linear-gradient(90deg, var(--yellow) 0 34%, var(--blue) 34% 68%, var(--red) 68% 100%);
}

.section-copy {
  font-size: 0.98rem;
  line-height: 1.72;
  color: var(--text-2);
  max-width: 420px;
}

.reveal-head,
.reveal-card,
.reveal-phase,
.reveal-cta {
  opacity: 0;
  transform: translateY(34px);
}

.ml-grid,
.steps-grid,
.feature-grid,
.phases-grid {
  display: grid;
  gap: 1rem;
}

.ml-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.steps-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.feature-grid { grid-template-columns: repeat(12, minmax(0, 1fr)); }
.phases-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }

.ml-card,
.step-card,
.feature-card,
.phase-card,
.cta-panel {
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: var(--shadow-sm);
}

.ml-card,
.step-card,
.phase-card {
  padding: 1.35rem 1.25rem 1.2rem;
}

.ml-card::before,
.step-card::before,
.phase-card::before,
.feature-card::before,
.cta-panel::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
}

.stripe-flag::before {
  background: linear-gradient(90deg, var(--yellow) 0 34%, var(--blue) 34% 68%, var(--red) 68% 100%);
}

.stripe-yellow::before { background: var(--yellow); }
.stripe-blue::before { background: var(--blue); }
.stripe-red::before { background: var(--red); }
.stripe-green::before { background: var(--green); }

.mini-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.62rem;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: var(--text-m);
  margin-bottom: 0.9rem;
}

.card-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 28px;
  padding: 0 0.5rem;
  border-radius: 999px;
  margin-bottom: 0.8rem;
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.82);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.63rem;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: var(--text);
}

.card-title {
  font-family: "Syne", sans-serif;
  font-size: 1.05rem;
  line-height: 1.05;
  letter-spacing: -0.03em;
  margin-bottom: 0.45rem;
}

.card-body {
  font-size: 0.83rem;
  line-height: 1.66;
  color: var(--text-2);
}

.feature-card {
  padding: 1.6rem;
  min-height: 240px;
}

.feature-lg { grid-column: span 7; }
.feature-md { grid-column: span 5; }
.feature-sm { grid-column: span 4; min-height: 200px; }

.feature-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.42rem 0.7rem;
  border-radius: 999px;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 1rem;
  background: rgba(13, 91, 215, 0.08);
  color: var(--blue);
  border: 1px solid rgba(13, 91, 215, 0.10);
}

.feature-card .card-title {
  font-size: 1.18rem;
  margin-bottom: 0.55rem;
}

.feature-glow {
  position: absolute;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.34;
  pointer-events: none;
}

.phase-card.active {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(246, 243, 237, 0.88)),
    linear-gradient(135deg, rgba(13, 91, 215, 0.05), rgba(13, 91, 215, 0.01));
  border-color: rgba(13, 91, 215, 0.16);
}

.phase-state {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.36rem 0.7rem;
  border-radius: 999px;
  margin-bottom: 0.9rem;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.phase-state.active {
  background: rgba(13, 91, 215, 0.08);
  color: var(--blue);
}

.phase-state.upcoming {
  background: rgba(23, 32, 51, 0.05);
  color: var(--text-m);
}

.phase-name {
  font-family: "Syne", sans-serif;
  font-size: 1.18rem;
  margin-bottom: 0.45rem;
  letter-spacing: -0.03em;
}

.phase-body {
  font-size: 0.84rem;
  line-height: 1.68;
  color: var(--text-2);
}

.cta-wrap {
  max-width: 1220px;
  margin: 0 auto;
  padding: 0 2.4rem 4.6rem;
}

.cta-panel {
  padding: 2.6rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1.2rem;
  align-items: center;
}

.cta-title {
  font-family: "Syne", sans-serif;
  font-size: clamp(2rem, 3.4vw, 3rem);
  line-height: 0.98;
  letter-spacing: -0.05em;
  margin-bottom: 0.5rem;
}

.cta-copy {
  font-size: 0.96rem;
  line-height: 1.68;
  color: var(--text-2);
  max-width: 480px;
}

.footer {
  padding: 2rem 2.4rem 2.6rem;
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-m);
}

@media (max-width: 1080px) {
  .hero-grid,
  .section-head,
  .cta-panel {
    grid-template-columns: 1fr;
  }

  .hero-visual-wrap {
    min-height: 420px;
  }
}

@media (max-width: 900px) {
  .navbar,
  .hero,
  .stats-band,
  .section,
  .cta-wrap,
  .footer {
    padding-left: 1.3rem;
    padding-right: 1.3rem;
  }

  .nav-links { display: none; }
  .hero { padding-top: 1.4rem; }
  .hero-visual,
  .hero-visual-wrap { min-height: 390px; }
  .ml-grid,
  .stats-grid,
  .steps-grid,
  .phases-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .feature-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .feature-lg,
  .feature-md,
  .feature-sm { grid-column: span 1; }
}

@media (max-width: 640px) {
  .hero-title { font-size: clamp(2.55rem, 13vw, 4rem); }
  .hero-sub { font-size: 0.95rem; }
  .ml-grid,
  .stats-grid,
  .steps-grid,
  .phases-grid,
  .feature-grid,
  .cta-panel {
    grid-template-columns: 1fr;
  }
  .signal-card { min-width: 132px; }
  .card-a { top: 16%; left: 8%; }
  .card-b { top: 12%; right: 6%; }
  .card-c { bottom: 14%; left: 16%; }
  .play-caption {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
</style>
</head>
<body>
<div class="page-shell">
  <div class="noise"></div>

  <nav class="navbar">
    <a href="#top" class="nav-logo">
      Veedur<span class="y">I</span><span class="b">A</span><span class="r">.</span>
    </a>
    <ul class="nav-links">
      <li><a href="#modelo">__NAV_MODEL__</a></li>
      <li><a href="#flujo">__NAV_FLOW__</a></li>
      <li><a href="#roadmap">__NAV_ROADMAP__</a></li>
    </ul>
    <div class="nav-actions">
      __LANG_SWITCH__
      <a href="__PHASE_URL__" class="nav-cta">__NAV_CTA__</a>
    </div>
  </nav>

  <section class="hero" id="top">
    <div class="hero-grid">
      <div class="hero-copy">
        <div class="eyebrow-pill" id="hero-pill">
          <span class="eyebrow-dot"></span>
          __EYEBROW__
        </div>

        <h1 class="hero-title">
          <span class="title-line"><span>__HERO_1__</span></span>
          <span class="title-line"><span class="title-blue">__HERO_2A__</span> <span>__HERO_2B__</span></span>
          <span class="title-line"><span class="title-yellow">__HERO_3A__</span> <span>__HERO_3B__</span> <span class="title-red">__HERO_3C__</span></span>
        </h1>

        <p class="hero-sub" id="hero-sub">
          __HERO_SUB__
        </p>

        <div class="hero-metrics" id="hero-metrics">
          <div class="hero-chip"><strong>Isolation Forest</strong> __CHIP_1__</div>
          <div class="hero-chip"><strong>SHAP</strong> __CHIP_2__</div>
          <div class="hero-chip"><strong>SECOP II</strong> __CHIP_3__</div>
        </div>

        <div class="cta-row" id="hero-cta">
          <a href="__PHASE_URL__" class="btn-primary">__CTA_PRIMARY__</a>
          <a href="#modelo" class="btn-secondary">__CTA_SECONDARY__</a>
        </div>

        <div class="scroll-cue" id="scroll-cue">
          <span class="scroll-line"></span>
          __SCROLL__
        </div>
      </div>

      <div class="hero-visual-wrap" id="hero-visual-wrap">
        <div class="hero-visual" style="min-height:470px;padding:1.6rem 1.4rem;display:flex;flex-direction:column;gap:1rem;justify-content:center;" id="hero-visual">
          <div class="visual-topbar"></div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(23,32,51,.38);margin-bottom:.2rem;">Plataforma · 3 fases</div>

          <a href="/ContratoLimpio" style="position:relative;text-decoration:none;display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;padding:2rem;border-radius:24px;background:rgba(255,255,255,0.85);border:1px solid rgba(13,91,215,0.2);box-shadow:0 12px 40px rgba(20,30,50,0.08);transition:transform 0.3s, box-shadow 0.3s;overflow:hidden;" target="_self" onmouseover="this.style.transform='translateY(-6px)';this.style.boxShadow='0 20px 50px rgba(20,30,50,0.12)';" onmouseout="this.style.transform='';this.style.boxShadow='0 12px 40px rgba(20,30,50,0.08)';">
            
            <!-- Minimal Map SVG -->
            <svg width="180" height="180" viewBox="0 0 100 120" style="margin-bottom:1.5rem;opacity:0.9;filter:drop-shadow(0 8px 16px rgba(13,91,215,0.2));">
              <path d="M30,10 L45,5 L60,15 L70,10 L85,25 L90,45 L80,65 L75,90 L60,110 L45,115 L35,100 L25,85 L15,75 L10,50 L20,30 Z" fill="url(#mapGrad)" stroke="rgba(13,91,215,0.4)" stroke-width="1.5" stroke-linejoin="round"/>
              <circle cx="45" cy="45" r="3" fill="#c62839" />
              <circle cx="35" cy="35" r="2" fill="#d3a21a" />
              <circle cx="65" cy="70" r="2.5" fill="#c62839" />
              <defs>
                <linearGradient id="mapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="rgba(13,91,215,0.15)" />
                  <stop offset="100%" stop-color="rgba(13,91,215,0.02)" />
                </linearGradient>
              </defs>
            </svg>

            <div style="font-family:'Syne',sans-serif;font-size:1.4rem;font-weight:800;color:#172033;margin-bottom:0.5rem;text-align:center;letter-spacing:-0.03em;">Radar Nacional</div>
            <div style="font-size:0.9rem;color:rgba(23,32,51,0.65);line-height:1.6;text-align:center;max-width:280px;margin-bottom:1.5rem;">
              Mapeo ciudadano de SECOP II. Conecta datos oficiales para encontrar contratos irregulares e identificar redes de financiación al instante.
            </div>

            <div style="display:inline-flex;align-items:center;gap:0.5rem;padding:0.6rem 1.2rem;border-radius:999px;background:linear-gradient(135deg,rgba(13,91,215,0.1),rgba(13,91,215,0.05));color:#0d5bd7;font-weight:700;font-size:0.85rem;">
              Entrar a ContratoLimpio <span style="font-size:1.1rem;line-height:0;">→</span>
            </div>
            
            <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#d3a21a 0 34%, #0d5bd7 34% 68%, #c62839 68% 100%);"></div>
          </a>
        </div>
      </div>
    </div>
  </section>

  <section class="stats-band">
    <div class="stats-grid">
      <article class="stat-card yellow">
        <div class="stat-label">__STAT_1_LABEL__</div>
        <div class="stat-value"><span class="accent-yellow" data-count="2.8">2.8</span>M</div>
        <p class="stat-copy">__STAT_1_COPY__</p>
      </article>
      <article class="stat-card blue">
        <div class="stat-label">__STAT_2_LABEL__</div>
        <div class="stat-value"><span class="accent-blue" data-count="25">25</span></div>
        <p class="stat-copy">__STAT_2_COPY__</p>
      </article>
      <article class="stat-card red">
        <div class="stat-label">__STAT_3_LABEL__</div>
        <div class="stat-value"><span class="accent-red" data-count="5">5</span>%</div>
        <p class="stat-copy">__STAT_3_COPY__</p>
      </article>
      <article class="stat-card green">
        <div class="stat-label">__STAT_4_LABEL__</div>
        <div class="stat-value"><span class="accent-green" data-count="3">3</span>s</div>
        <p class="stat-copy">__STAT_4_COPY__</p>
      </article>
    </div>
  </section>

  <div class="divider"></div>

  <section class="section" id="modelo">
    <div class="section-head reveal-head">
      <div>
        <p class="eyebrow">__SEC_MODEL_EYEBROW__</p>
        <h2 class="section-title">__SEC_MODEL_TITLE__</h2>
      </div>
      <p class="section-copy">__SEC_MODEL_COPY__</p>
    </div>

    <div class="ml-grid">
      <article class="ml-card stripe-yellow reveal-card">
        <div class="mini-label">__ML_1_K__</div>
        <div class="card-mark">__ML_1_M__</div>
        <h3 class="card-title">__ML_1_T__</h3>
        <p class="card-body">__ML_1_B__</p>
      </article>
      <article class="ml-card stripe-blue reveal-card">
        <div class="mini-label">__ML_2_K__</div>
        <div class="card-mark">__ML_2_M__</div>
        <h3 class="card-title">__ML_2_T__</h3>
        <p class="card-body">__ML_2_B__</p>
      </article>
      <article class="ml-card stripe-blue reveal-card">
        <div class="mini-label">__ML_3_K__</div>
        <div class="card-mark">__ML_3_M__</div>
        <h3 class="card-title">__ML_3_T__</h3>
        <p class="card-body">__ML_3_B__</p>
      </article>
      <article class="ml-card stripe-red reveal-card">
        <div class="mini-label">__ML_4_K__</div>
        <div class="card-mark">__ML_4_M__</div>
        <h3 class="card-title">__ML_4_T__</h3>
        <p class="card-body">__ML_4_B__</p>
      </article>
    </div>
  </section>

  <div class="divider"></div>

  <section class="section" id="flujo">
    <div class="section-head reveal-head">
      <div>
        <p class="eyebrow">__SEC_FLOW_EYEBROW__</p>
        <h2 class="section-title">__SEC_FLOW_TITLE__</h2>
      </div>
      <p class="section-copy">__SEC_FLOW_COPY__</p>
    </div>

    <div class="steps-grid">
      <article class="step-card stripe-red reveal-card">
        <div class="mini-label">__FLOW_1_K__</div>
        <div class="card-mark">__FLOW_1_M__</div>
        <h3 class="card-title">__FLOW_1_T__</h3>
        <p class="card-body">__FLOW_1_B__</p>
      </article>
      <article class="step-card stripe-blue reveal-card">
        <div class="mini-label">__FLOW_2_K__</div>
        <div class="card-mark">__FLOW_2_M__</div>
        <h3 class="card-title">__FLOW_2_T__</h3>
        <p class="card-body">__FLOW_2_B__</p>
      </article>
      <article class="step-card stripe-green reveal-card">
        <div class="mini-label">__FLOW_3_K__</div>
        <div class="card-mark">__FLOW_3_M__</div>
        <h3 class="card-title">__FLOW_3_T__</h3>
        <p class="card-body">__FLOW_3_B__</p>
      </article>
    </div>
  </section>

  <div class="divider"></div>

  <section class="section" id="caracteristicas">
    <div class="section-head reveal-head">
      <div>
        <p class="eyebrow">__SEC_PRODUCT_EYEBROW__</p>
        <h2 class="section-title">__SEC_PRODUCT_TITLE__</h2>
      </div>
      <p class="section-copy">__SEC_PRODUCT_COPY__</p>
    </div>

    <div class="feature-grid">
      <article class="feature-card feature-lg stripe-blue reveal-card">
        <div class="feature-glow" style="top:-44px;left:-18px;background:rgba(13, 91, 215, 0.18);"></div>
        <span class="feature-tag">__F1_TAG__</span>
        <h3 class="card-title">__F1_T__</h3>
        <p class="card-body">__F1_B__</p>
      </article>

      <article class="feature-card feature-md stripe-yellow reveal-card">
        <div class="feature-glow" style="top:-30px;right:-18px;background:rgba(211, 162, 26, 0.18);"></div>
        <span class="feature-tag" style="background:rgba(211, 162, 26, 0.08);color:var(--yellow);border-color:rgba(211, 162, 26, 0.12);">__F2_TAG__</span>
        <h3 class="card-title">__F2_T__</h3>
        <p class="card-body">__F2_B__</p>
      </article>

      <article class="feature-card feature-sm stripe-red reveal-card">
        <span class="feature-tag" style="background:rgba(198, 40, 57, 0.08);color:var(--red);border-color:rgba(198, 40, 57, 0.12);">__F3_TAG__</span>
        <h3 class="card-title">__F3_T__</h3>
        <p class="card-body">__F3_B__</p>
      </article>

      <article class="feature-card feature-sm stripe-blue reveal-card">
        <span class="feature-tag">__F4_TAG__</span>
        <h3 class="card-title">__F4_T__</h3>
        <p class="card-body">__F4_B__</p>
      </article>

      <article class="feature-card feature-sm stripe-green reveal-card">
        <span class="feature-tag" style="background:rgba(25, 135, 84, 0.08);color:var(--green);border-color:rgba(25, 135, 84, 0.12);">__F5_TAG__</span>
        <h3 class="card-title">__F5_T__</h3>
        <p class="card-body">__F5_B__</p>
      </article>
    </div>
  </section>

  <div class="divider"></div>

  <section class="section" id="roadmap">
    <div class="section-head reveal-head">
      <div>
        <p class="eyebrow">__SEC_PLATFORM_EYEBROW__</p>
        <h2 class="section-title">__SEC_PLATFORM_TITLE__</h2>
      </div>
      <p class="section-copy">__SEC_PLATFORM_COPY__</p>
    </div>

    <div class="phases-grid">
      <article class="phase-card active stripe-blue reveal-phase">
        <div class="phase-state active">__PH1_STATE__</div>
        <h3 class="phase-name">__PH1_NAME__</h3>
        <p class="phase-body">__PH1_BODY__</p>
      </article>
      <article class="phase-card stripe-yellow reveal-phase">
        <div class="phase-state upcoming">__PH2_STATE__</div>
        <h3 class="phase-name">__PH2_NAME__</h3>
        <p class="phase-body">__PH2_BODY__</p>
      </article>
      <article class="phase-card active stripe-red reveal-phase" style="border-color:rgba(198,40,57,.16);">
        <div class="phase-state active" style="background:rgba(198,40,57,.07);color:#c62839;">__PH3_STATE__</div>
        <h3 class="phase-name">__PH3_NAME__</h3>
        <p class="phase-body">__PH3_BODY__</p>
        <a href="/PromesometroNLP" style="display:inline-flex;align-items:center;gap:.4rem;margin-top:.9rem;font-size:.8rem;font-weight:700;color:#c62839;text-decoration:none;">Abrir PromesóMetro →</a>
      </article>
    </div>
  </section>

  <div class="cta-wrap">
    <div class="cta-panel stripe-flag reveal-cta">
      <div>
        <h2 class="cta-title">__CTA_TITLE__</h2>
        <p class="cta-copy">__CTA_COPY__</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:.7rem;">
        <a href="__PHASE_URL__" class="btn-primary">__CTA_BUTTON__</a>
        <a href="/PromesometroNLP" style="display:inline-flex;align-items:center;gap:.5rem;padding:.85rem 1.2rem;border-radius:999px;border:1px solid rgba(198,40,57,.18);background:rgba(198,40,57,.06);color:#c62839;font-weight:700;font-size:.88rem;text-decoration:none;transition:transform .2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">Abrir PromesóMetro →</a>
      </div>
    </div>
  </div>

  <footer class="footer">
    __FOOTER__
  </footer>
</div>

<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
<script>
(function() {
  var hasMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cards = [];

  if (window.gsap) {
    gsap.registerPlugin(ScrollTrigger);

    gsap.set(".reveal-head, .reveal-card, .reveal-phase, .reveal-cta", { autoAlpha: 0, y: 34 });
    gsap.set(".stat-card", { autoAlpha: 0, y: 34 });

    var heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
    heroTl
      .fromTo("#hero-pill", { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.55, delay: 0.12 })
      .fromTo(".title-line > span", { autoAlpha: 0, y: "120%" }, { autoAlpha: 1, y: "0%", duration: 0.74, stagger: 0.10 }, "-=0.18")
      .fromTo("#hero-sub", { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.52 }, "-=0.32")
      .fromTo("#hero-metrics", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.48 }, "-=0.26")
      .fromTo("#hero-cta", { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.48 }, "-=0.24")
      .fromTo("#scroll-cue", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.46 }, "-=0.10");

    gsap.fromTo("#hero-visual-wrap", { autoAlpha: 0, y: 36, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.9, ease: "power3.out", delay: 0.26 });

    ScrollTrigger.batch(".stat-card", {
      start: "top 92%",
      once: true,
      onEnter: function(batch) {
        gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.62, stagger: 0.10, ease: "power3.out" });
      }
    });

    ScrollTrigger.create({
      trigger: ".stats-band",
      start: "top 92%",
      once: true,
      onEnter: function() {
        document.querySelectorAll("[data-count]").forEach(function(node) {
          var target = parseFloat(node.getAttribute("data-count"));
          var decimals = target % 1 !== 0 ? 1 : 0;
          gsap.fromTo(node, { textContent: 0 }, {
            textContent: target,
            duration: 1.8,
            ease: "power2.out",
            snap: { textContent: decimals ? 0.1 : 1 },
            onUpdate: function() {
              node.textContent = Number(node.textContent).toFixed(decimals);
            }
          });
        });
      }
    });

    ScrollTrigger.batch(".reveal-head", {
      start: "top 90%",
      once: true,
      onEnter: function(batch) {
        gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.68, stagger: 0.12, ease: "power3.out" });
      }
    });

    ScrollTrigger.batch(".reveal-card", {
      start: "top 92%",
      once: true,
      onEnter: function(batch) {
        gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.66, stagger: 0.09, ease: "power3.out" });
      }
    });

    ScrollTrigger.batch(".reveal-phase", {
      start: "top 88%",
      once: true,
      onEnter: function(batch) {
        gsap.fromTo(batch, { autoAlpha: 0, y: 26, scale: 0.98 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.72, stagger: 0.11, ease: "back.out(1.2)" });
      }
    });

    gsap.to(".reveal-cta", {
      autoAlpha: 1,
      y: 0,
      duration: 0.72,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ".reveal-cta",
        start: "top 88%",
        once: true
      }
    });
  }

  if (!window.gsap) {
    document.querySelectorAll(".title-line > span, #hero-pill, #hero-sub, #hero-metrics, #hero-cta, #scroll-cue, #hero-visual-wrap, .stat-card, .reveal-head, .reveal-card, .reveal-phase, .reveal-cta").forEach(function(el) {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
  }
})();
</script>
<noscript>
<style>
  .title-line > span,
  #hero-pill,
  #hero-sub,
  #hero-metrics,
  #hero-cta,
  #scroll-cue,
  #hero-visual-wrap,
  .stat-card,
  .reveal-head,
  .reveal-card,
  .reveal-phase,
  .reveal-cta {
    opacity: 1 !important;
    transform: none !important;
  }
</style>
</noscript>
</body>
</html>
"""


LANDING_HTML = _render_template(LANDING_HTML, replacements)

components.html(LANDING_HTML, height=5200, scrolling=True)
