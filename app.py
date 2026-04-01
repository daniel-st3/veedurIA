"""
VeedurIA - Landing Page v2.
Full dark-mode civic-tech design with real GSAP + ScrollTrigger animations.
No sidebar. No Streamlit chrome. Pure components.html() iframe.
"""

import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(
    page_title="VeedurIA - Radar Ciudadano de Contratos Publicos",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Strip ALL Streamlit chrome
st.markdown("""
<style>
#MainMenu, footer, header, [data-testid="stToolbar"],
[data-testid="stDecoration"], [data-testid="stStatusWidget"],
[data-testid="stSidebar"], [data-testid="collapsedControl"],
[data-testid="stSidebarNav"],
.stDeployButton, .stAppViewBlockContainer > div:first-child,
[data-testid="stMainBlockContainer"] { padding: 0 !important; }
.stApp { background: #040608 !important; }
.block-container { padding: 0 !important; max-width: 100% !important; }
iframe { display: block; border: none; }
/* Kill the Streamlit sidebar collapse arrow — always visible even with sidebar collapsed */
[data-testid="collapsedControl"] { display: none !important; }
</style>
""", unsafe_allow_html=True)

LANDING_HTML = r"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VeedurIA</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: 'Inter', -apple-system, sans-serif;
  background: #040608;
  color: #e8eaf0;
  overflow-x: hidden;
}

/* ────── NAVBAR ────── */
.navbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 2.5rem;
  height: 62px;
  background: rgba(4,6,8,0.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255,255,255,0.055);
}
.nav-logo {
  font-family: 'Syne', sans-serif;
  font-weight: 800; font-size: 1.18rem;
  color: #fff; text-decoration: none;
  letter-spacing: -0.02em;
}
.nav-logo span { color: #38bdf8; }
.nav-links {
  display: flex; align-items: center; gap: 1.8rem;
  list-style: none;
}
.nav-links a {
  font-size: 0.88rem; color: rgba(200,215,240,0.6);
  text-decoration: none; font-weight: 500;
  transition: color 0.2s;
}
.nav-links a:hover { color: #fff; }
.nav-cta {
  display: inline-flex; align-items: center; gap: 8px;
  background: linear-gradient(135deg, #0ea5e9, #6366f1);
  color: #fff; text-decoration: none;
  font-size: 0.88rem; font-weight: 600;
  padding: 9px 22px; border-radius: 10px;
  letter-spacing: -0.01em;
  transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease;
  box-shadow: 0 4px 18px rgba(14,165,233,0.28);
}
.nav-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(14,165,233,0.42); }

/* ────── HERO ────── */
.hero {
  min-height: 100vh;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center;
  padding: 8rem 2rem 6rem;
  position: relative; overflow: hidden;
}
.hero-bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 80% 55% at 15% 20%, rgba(14,165,233,0.11) 0%, transparent 55%),
    radial-gradient(ellipse 65% 70% at 85% 75%, rgba(139,92,246,0.10) 0%, transparent 55%),
    radial-gradient(ellipse 100% 80% at 50% 50%, rgba(220,38,38,0.05) 0%, transparent 65%);
  animation: bgPulse 18s ease-in-out infinite alternate;
}
@keyframes bgPulse {
  from { opacity: 1; }
  to   { opacity: 0.75; filter: hue-rotate(12deg); }
}
.hero-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px);
  background-size: 68px 68px;
  mask-image: radial-gradient(ellipse 80% 65% at 50% 50%, black, transparent);
  -webkit-mask-image: radial-gradient(ellipse 80% 65% at 50% 50%, black, transparent);
}
.orb {
  position: absolute; border-radius: 50%;
  filter: blur(80px); pointer-events: none;
}
.orb-1 { width:480px; height:480px; top:-100px; left:-100px; background:radial-gradient(circle,rgba(14,165,233,0.12),transparent 70%); animation: floatA 14s ease-in-out infinite; }
.orb-2 { width:360px; height:360px; bottom:0; right:-60px; background:radial-gradient(circle,rgba(139,92,246,0.10),transparent 70%); animation: floatB 17s ease-in-out infinite; }
.orb-3 { width:260px; height:260px; top:38%; left:42%; background:radial-gradient(circle,rgba(220,38,38,0.08),transparent 70%); animation: floatC 9s ease-in-out infinite; }
@keyframes floatA { 0%,100%{transform:translate(0,0);} 50%{transform:translate(22px,-32px);} }
@keyframes floatB { 0%,100%{transform:translate(0,0);} 50%{transform:translate(-18px,22px);} }
@keyframes floatC { 0%,100%{transform:translate(0,0);} 50%{transform:translate(14px,18px);} }

.hero-inner { position:relative; z-index:2; max-width:900px; width:100%; }

.live-badge {
  display:inline-flex; align-items:center; gap:8px;
  background:rgba(14,165,233,0.09);
  border:1px solid rgba(14,165,233,0.22);
  border-radius:100px; padding:7px 18px;
  font-family:'JetBrains Mono',monospace;
  font-size:0.68rem; letter-spacing:0.1em; color:#38bdf8; text-transform:uppercase;
  margin-bottom:2.4rem;
  opacity:0; /* GSAP will animate */
}
.live-dot { width:7px; height:7px; border-radius:50%; background:#38bdf8; animation:pulseDot 1.8s ease-in-out infinite; }
@keyframes pulseDot { 0%,100%{box-shadow:0 0 0 0 rgba(56,189,248,0.7);} 50%{box-shadow:0 0 0 7px rgba(56,189,248,0);} }

.hero-title {
  font-family:'Syne',sans-serif;
  font-size: clamp(3rem, 8vw, 7.2rem);
  font-weight:800; line-height:1.05; letter-spacing:-0.045em;
  color:#fff; margin-bottom:1.8rem;
}
.hero-title .word { display:inline-block; }
.hero-title .word span { display:inline-block; opacity:0; transform:translateY(100%); }
.blue { color:#38bdf8; }
.red  { color:#f87171; }

.hero-sub {
  font-size: clamp(1rem, 2vw, 1.2rem);
  color:rgba(200,215,240,0.72); line-height:1.75;
  max-width:560px; margin:0 auto 3rem;
  opacity:0;
}

.cta-row { display:flex; gap:1rem; justify-content:center; flex-wrap:wrap; opacity:0; }
.btn-primary {
  display:inline-flex; align-items:center; gap:10px;
  background:linear-gradient(135deg,#0ea5e9,#6366f1);
  color:#fff; text-decoration:none;
  font-family:'Inter',sans-serif; font-size:1.05rem; font-weight:600;
  padding:15px 36px; border-radius:14px; letter-spacing:-0.01em;
  box-shadow:0 0 0 1px rgba(14,165,233,0.3),0 8px 32px rgba(14,165,233,0.28);
  transition:transform 0.28s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.28s ease;
}
.btn-primary:hover { transform:translateY(-4px) scale(1.03); box-shadow:0 0 0 1px rgba(99,102,241,0.5),0 16px 48px rgba(99,102,241,0.38); }
.btn-secondary {
  display:inline-flex; align-items:center; gap:8px;
  background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.11);
  color:rgba(200,215,240,0.82); text-decoration:none;
  font-family:'Inter',sans-serif; font-size:1rem; font-weight:500;
  padding:15px 28px; border-radius:14px;
  transition:background 0.22s ease,transform 0.22s ease;
}
.btn-secondary:hover { background:rgba(255,255,255,0.1); transform:translateY(-2px); }

.scroll-tip {
  position:absolute; bottom:2.5rem; left:50%; transform:translateX(-50%);
  display:flex; flex-direction:column; align-items:center; gap:7px;
  color:rgba(200,215,240,0.3);
  font-family:'JetBrains Mono',monospace; font-size:0.66rem; letter-spacing:0.14em; text-transform:uppercase;
  opacity:0;
}
.scroll-arrow {
  width:22px; height:22px;
  border-right:1.5px solid rgba(200,215,240,0.25);
  border-bottom:1.5px solid rgba(200,215,240,0.25);
  transform:rotate(45deg);
  animation:arrowBounce 2.4s ease-in-out infinite;
}
@keyframes arrowBounce { 0%,100%{transform:rotate(45deg) translate(0,0);opacity:0.28;} 50%{transform:rotate(45deg) translate(5px,5px);opacity:0.72;} }

/* ────── STATS ────── */
.stats-section {
  border-top:1px solid rgba(255,255,255,0.055);
  border-bottom:1px solid rgba(255,255,255,0.055);
  padding:4rem 2rem;
}
.stats-grid {
  max-width:1060px; margin:0 auto;
  display:grid; grid-template-columns:repeat(4,1fr); gap:1rem;
}
.stat-item { text-align:center; }
.stat-num {
  font-family:'Syne',sans-serif;
  font-size:clamp(2rem,4vw,2.9rem);
  font-weight:800; letter-spacing:-0.04em; color:#fff; line-height:1;
  margin-bottom:0.3rem;
}
.stat-num .accent { color:#38bdf8; }
.stat-lbl { font-size:0.78rem; color:rgba(180,200,225,0.42); text-transform:uppercase; letter-spacing:0.07em; font-weight:500; }

/* ────── SECTION ────── */
.section { padding:6rem 2rem; max-width:1060px; margin:0 auto; }
.eyebrow {
  font-family:'JetBrains Mono',monospace; font-size:0.68rem;
  letter-spacing:0.14em; text-transform:uppercase; color:#38bdf8; margin-bottom:1rem;
  opacity:1; /* CSS fallback; GSAP animates to same on scroll */
}
.sec-title {
  font-family:'Syne',sans-serif;
  font-size:clamp(2rem,4vw,3.1rem);
  font-weight:800; color:#fff; letter-spacing:-0.035em; line-height:1.08;
  margin-bottom:1.2rem; opacity:1;
}
.sec-body { font-size:1.05rem; color:rgba(180,200,225,0.58); line-height:1.78; max-width:490px; opacity:1; }
.divider { height:1px; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.055),transparent); }

/* ────── STEPS ────── */
.steps { display:grid; grid-template-columns:repeat(3,1fr); gap:1.3rem; margin-top:3.5rem; }
.step {
  background:rgba(255,255,255,0.028); border:1px solid rgba(255,255,255,0.065);
  border-radius:20px; padding:2rem 1.8rem; position:relative; overflow:hidden;
  transition:transform 0.38s cubic-bezier(0.34,1.56,0.64,1),border-color 0.25s,background 0.25s;
  opacity:1; /* GSAP overrides this on scroll; CSS fallback = visible */
}
.step::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:var(--line); opacity:0; transition:opacity 0.3s; }
.step:hover { transform:translateY(-9px); border-color:rgba(255,255,255,0.12); background:rgba(255,255,255,0.048); }
.step:hover::before { opacity:1; }
.step-n { font-family:'JetBrains Mono',monospace; font-size:0.66rem; color:rgba(180,200,225,0.28); letter-spacing:0.1em; margin-bottom:1.2rem; }
.step-icon { font-size:2.2rem; display:block; margin-bottom:1rem; }
.step-title { font-family:'Syne',sans-serif; font-size:1.1rem; font-weight:700; color:#fff; margin-bottom:0.5rem; }
.step-body { font-size:0.87rem; color:rgba(180,200,225,0.52); line-height:1.7; }

/* ────── BENTO ────── */
.bento { display:grid; grid-template-columns:repeat(12,1fr); gap:1.1rem; margin-top:3.5rem; }
.bc {
  background:rgba(255,255,255,0.028); border:1px solid rgba(255,255,255,0.065);
  border-radius:22px; padding:2.1rem; position:relative; overflow:hidden;
  transition:transform 0.38s cubic-bezier(0.34,1.56,0.64,1),border-color 0.25s;
  opacity:1; /* GSAP overrides; CSS fallback = visible */
}
.bc:hover { transform:translateY(-5px); border-color:rgba(255,255,255,0.13); }
.bc-lg { grid-column:span 7; }
.bc-md { grid-column:span 5; }
.bc-sm { grid-column:span 4; }
.bc-glow { position:absolute; width:200px; height:200px; border-radius:50%; filter:blur(80px); pointer-events:none; opacity:0; transition:opacity 0.5s; }
.bc:hover .bc-glow { opacity:1; }
.bc-tag { display:inline-block; padding:4px 12px; border-radius:100px; font-size:0.67rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:1rem; }
.tag-b { background:rgba(14,165,233,0.1); color:#38bdf8; border:1px solid rgba(14,165,233,0.18); }
.tag-p { background:rgba(139,92,246,0.1); color:#a78bfa; border:1px solid rgba(139,92,246,0.18); }
.tag-r { background:rgba(239,68,68,0.08); color:#f87171; border:1px solid rgba(239,68,68,0.15); }
.tag-g { background:rgba(34,197,94,0.08); color:#4ade80; border:1px solid rgba(34,197,94,0.15); }
.bc-icon { font-size:2.1rem; display:block; margin-bottom:1.1rem; }
.bc-title { font-family:'Syne',sans-serif; font-size:1.18rem; font-weight:700; color:#fff; margin-bottom:0.5rem; }
.bc-body { font-size:0.87rem; color:rgba(180,200,225,0.52); line-height:1.7; }

/* ────── PHASES ────── */
.phases { display:grid; grid-template-columns:repeat(3,1fr); gap:1.2rem; margin-top:3.5rem; }
.phase {
  border:1px solid rgba(255,255,255,0.065); border-radius:20px; padding:2rem 1.8rem;
  transition:transform 0.38s cubic-bezier(0.34,1.56,0.64,1),border-color 0.25s;
  opacity:1; /* GSAP overrides; CSS fallback = visible */
}
.phase:hover { transform:translateY(-7px); border-color:rgba(255,255,255,0.13); }
.ph-active { background:linear-gradient(135deg,rgba(14,165,233,0.07),rgba(99,102,241,0.05)); border-color:rgba(14,165,233,0.18); }
.ph-soon   { background:rgba(255,255,255,0.018); }
.ph-lbl { font-family:'JetBrains Mono',monospace; font-size:0.65rem; letter-spacing:0.11em; text-transform:uppercase; margin-bottom:1rem; }
.ph-active .ph-lbl { color:#4ade80; }
.ph-soon  .ph-lbl  { color:rgba(180,200,225,0.28); }
.ph-title { font-family:'Syne',sans-serif; font-size:1.2rem; font-weight:700; color:#fff; margin-bottom:0.5rem; }
.ph-body  { font-size:0.87rem; color:rgba(180,200,225,0.5); line-height:1.68; }

/* ────── CTA BANNER ────── */
.cta-wrap { padding:2rem 2rem 6rem; }
.cta-banner {
  max-width:860px; margin:0 auto;
  background:linear-gradient(135deg,rgba(14,165,233,0.09),rgba(99,102,241,0.09));
  border:1px solid rgba(14,165,233,0.18); border-radius:28px;
  padding:4.5rem 3rem; text-align:center; position:relative; overflow:hidden;
  opacity:0;
}
.cta-banner::before { content:''; position:absolute; top:-70px; left:50%; width:450px; height:450px; border-radius:50%; background:radial-gradient(circle,rgba(14,165,233,0.12),transparent 65%); transform:translateX(-50%); pointer-events:none; }
.cta-title { font-family:'Syne',sans-serif; font-size:clamp(2rem,4vw,3rem); font-weight:800; color:#fff; letter-spacing:-0.03em; margin-bottom:1rem; }
.cta-sub   { font-size:1.05rem; color:rgba(180,200,225,0.55); margin-bottom:2.5rem; }

/* ────── FOOTER ────── */
.footer { border-top:1px solid rgba(255,255,255,0.055); padding:2.5rem 2rem; text-align:center; color:rgba(180,200,225,0.25); font-size:0.82rem; letter-spacing:0.02em; }

@media(max-width:760px){
  .steps,.phases{grid-template-columns:1fr;}
  .bento{grid-template-columns:1fr;}
  .bc-lg,.bc-md,.bc-sm{grid-column:span 1;}
  .stats-grid{grid-template-columns:repeat(2,1fr);}
  .navbar{padding:0 1.2rem;}
}
</style>
</head>

<body>

<!-- NAV -->
<nav class="navbar">
  <a href="#inicio" class="nav-logo">Veedur<span>IA</span></a>
  <ul class="nav-links">
    <li><a href="#como-funciona">Como funciona</a></li>
    <li><a href="#caracteristicas">Caracteristicas</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
  </ul>
  <a href="/ContratoLimpio" class="nav-cta">🚦 ContratoLimpio</a>
</nav>

<!-- HERO -->
<section class="hero" id="inicio">
  <div class="hero-bg"></div>
  <div class="hero-grid"></div>
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="orb orb-3"></div>

  <div class="hero-inner">
    <div class="live-badge" id="live-badge">
      <span class="live-dot"></span>
      SECOP II &nbsp;&#183;&nbsp; Analisis en tiempo real
    </div>

    <h1 class="hero-title" id="hero-title">
      <span class="word"><span>El</span></span>
      <span style="display:inline-block;width:0.3em;"></span>
      <span class="word"><span>radar</span></span>
      <span style="display:inline-block;width:0.3em;"></span>
      <span class="word"><span>de</span></span><br>
      <span class="word blue"><span>contratos</span></span>
      <span style="display:inline-block;width:0.3em;"></span>
      <span class="word blue"><span>publicos</span></span><br>
      <span class="word"><span>de</span></span>
      <span style="display:inline-block;width:0.3em;"></span>
      <span class="word red"><span>Colombia</span></span>
    </h1>

    <p class="hero-sub" id="hero-sub">
      Inteligencia artificial que detecta patrones irregulares en millones
      de contratos de SECOP II. Cada alerta explicada, cada fuente verificable.
    </p>

    <div class="cta-row" id="cta-row">
      <a href="/ContratoLimpio" class="btn-primary">🚦 Abrir ContratoLimpio</a>
      <a href="#como-funciona" class="btn-secondary">Como funciona ↓</a>
    </div>
  </div>

  <div class="scroll-tip" id="scroll-tip">
    <span>scroll</span>
    <div class="scroll-arrow"></div>
  </div>
</section>

<!-- STATS -->
<div class="stats-section" id="stats-section">
  <div class="stats-grid">
    <div class="stat-item">
      <div class="stat-num"><span class="accent" data-count="2.8">0</span>M</div>
      <div class="stat-lbl">contratos analizados</div>
    </div>
    <div class="stat-item">
      <div class="stat-num"><span class="accent" data-count="25">0</span></div>
      <div class="stat-lbl">variables por contrato</div>
    </div>
    <div class="stat-item">
      <div class="stat-num"><span class="accent" data-count="5">0</span>%</div>
      <div class="stat-lbl">tasa de anomalias</div>
    </div>
    <div class="stat-item">
      <div class="stat-num"><span class="accent" data-count="3">0</span>s</div>
      <div class="stat-lbl">carga de datos</div>
    </div>
  </div>
</div>
<div class="divider"></div>

<!-- HOW IT WORKS -->
<div class="section" id="como-funciona">
  <p class="eyebrow" id="ey1">Como funciona</p>
  <h2 class="sec-title" id="st1">Tres pasos.<br>De datos a decision.</h2>
  <p class="sec-body" id="sb1">
    VeedurIA automatiza el proceso de veeduria ciudadana
    que antes tomaba semanas.
  </p>

  <div class="steps">
    <div class="step" style="--line:linear-gradient(90deg,#0ea5e9,#38bdf8)">
      <div class="step-n">01 DETECTAR</div>
      <span class="step-icon">🔴</span>
      <div class="step-title">Deteccion automatica</div>
      <div class="step-body">Isolation Forest analiza 25 variables por contrato y genera un puntaje de riesgo de 0 a 100.</div>
    </div>
    <div class="step" style="--line:linear-gradient(90deg,#6366f1,#818cf8)">
      <div class="step-n">02 EXPLICAR</div>
      <span class="step-icon">🔍</span>
      <div class="step-title">Explicacion con SHAP</div>
      <div class="step-body">Cada alerta incluye los factores exactos que elevaron el riesgo. No es una caja negra.</div>
    </div>
    <div class="step" style="--line:linear-gradient(90deg,#10b981,#34d399)">
      <div class="step-n">03 VERIFICAR</div>
      <span class="step-icon">🔗</span>
      <div class="step-title">Enlace a SECOP II</div>
      <div class="step-body">Cada contrato tiene un enlace directo a la fuente oficial. La ultima palabra es tuya.</div>
    </div>
  </div>
</div>
<div class="divider"></div>

<!-- FEATURES BENTO -->
<div class="section" id="caracteristicas">
  <p class="eyebrow" id="ey2">Caracteristicas</p>
  <h2 class="sec-title" id="st2">Todo lo que necesitas<br>para auditar.</h2>

  <div class="bento">
    <div class="bc bc-lg">
      <div class="bc-glow" style="background:rgba(14,165,233,0.28);top:-30px;left:-30px;"></div>
      <span class="bc-tag tag-b">Mapa de riesgo</span>
      <div class="bc-title">Radar nacional departamento por departamento</div>
      <div class="bc-body">Un choropleth interactivo muestra el riesgo promedio por departamento. Haz clic para ver los contratos mas sospechosos de cada region.</div>
    </div>
    <div class="bc bc-md">
      <div class="bc-glow" style="background:rgba(139,92,246,0.28);bottom:-20px;right:-20px;"></div>
      <span class="bc-tag tag-p">ML en produccion</span>
      <div class="bc-title">Isolation Forest reentrenado semanalmente</div>
      <div class="bc-body">200 arboles, scikit-learn, 5% contamination rate. Datos actualizados diariamente desde la API oficial de SECOP.</div>
    </div>
    <div class="bc bc-sm">
      <span class="bc-icon">⚡</span>
      <div class="bc-title">Carga en 3 segundos</div>
      <div class="bc-body">Vista previa de 50k contratos. Historial completo de 2.8M disponible bajo demanda.</div>
    </div>
    <div class="bc bc-sm">
      <span class="bc-icon">🌐</span>
      <div class="bc-title">Espanol y English</div>
      <div class="bc-body">Interfaz completamente bilingue. Cambia el idioma en cualquier momento desde la barra de navegacion.</div>
    </div>
    <div class="bc bc-sm">
      <span class="bc-icon">⚖️</span>
      <div class="bc-title">Etica por diseno</div>
      <div class="bc-body">Cada alerta incluye un aviso etico. El puntaje invita al escrutinio ciudadano, no acusa.</div>
    </div>
  </div>
</div>
<div class="divider"></div>

<!-- PHASES -->
<div class="section" id="roadmap">
  <p class="eyebrow" id="ey3">Roadmap</p>
  <h2 class="sec-title" id="st3">Tres modulos.<br>Un ecosistema de transparencia.</h2>

  <div class="phases">
    <div class="phase ph-active">
      <div class="ph-lbl">● Fase 1 Activa</div>
      <div class="ph-title">🚦 ContratoLimpio</div>
      <div class="ph-body">Semaforo de riesgo ML sobre contratos SECOP II. Identifica patrones atipicos, explica con SHAP, enlaza a la fuente oficial.</div>
    </div>
    <div class="phase ph-soon">
      <div class="ph-lbl">○ Fase 2 Proximamente</div>
      <div class="ph-title">💰 SigueElDinero</div>
      <div class="ph-body">Red de contratistas y donantes politicos vinculados. Grafo interactivo que conecta financiadores con contratos.</div>
    </div>
    <div class="phase ph-soon">
      <div class="ph-lbl">○ Fase 3 Proximamente</div>
      <div class="ph-title">📊 PromesometroNLP</div>
      <div class="ph-body">Verificacion automatica de promesas electorales con NLP. Compara lo prometido con la ejecucion contractual real.</div>
    </div>
  </div>
</div>

<!-- CTA -->
<div class="cta-wrap">
  <div class="cta-banner" id="cta-banner">
    <div class="cta-title">Empieza a auditar ahora.</div>
    <div class="cta-sub">Sin cuenta. Sin registro. Acceso ciudadano total.</div>
    <a href="/ContratoLimpio" class="btn-primary" style="font-size:1.08rem;padding:16px 44px;">🚦 Abrir ContratoLimpio</a>
  </div>
</div>

<footer class="footer">
  VeedurIA &nbsp;&#183;&nbsp; Daniel Steven Rodriguez Sandoval &nbsp;&#183;&nbsp; MIT License
</footer>

<!-- GSAP -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>

<script>
gsap.registerPlugin(ScrollTrigger);

// ─── HERO: word-by-word stagger entrance ───────────────────────────────────
const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

tl.fromTo("#live-badge",
  { autoAlpha: 0, y: 18, scale: 0.9 },
  { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, delay: 0.2 }
)
.fromTo(".hero-title .word span",
  { autoAlpha: 0, y: "100%" },
  { autoAlpha: 1, y: "0%", duration: 0.7, stagger: 0.08 },
  "-=0.4"
)
.fromTo("#hero-sub",
  { autoAlpha: 0, y: 28 },
  { autoAlpha: 1, y: 0, duration: 0.7 },
  "-=0.3"
)
.fromTo("#cta-row",
  { autoAlpha: 0, y: 20 },
  { autoAlpha: 1, y: 0, duration: 0.6 },
  "-=0.3"
)
.fromTo("#scroll-tip",
  { autoAlpha: 0 },
  { autoAlpha: 1, duration: 1 },
  "-=0.2"
);

// ─── STATS: count-up animation ─────────────────────────────────────────────
ScrollTrigger.create({
  trigger: "#stats-section",
  start: "top 98%",
  once: true,
  onEnter: function() {
    document.querySelectorAll("[data-count]").forEach(function(el) {
      var target = parseFloat(el.getAttribute("data-count"));
      var isDecimal = target % 1 !== 0;
      gsap.fromTo(el,
        { innerHTML: 0 },
        {
          innerHTML: target,
          duration: 2.2,
          ease: "power2.out",
          snap: { innerHTML: isDecimal ? 0.1 : 1 },
          onUpdate: function() {
            if (isDecimal) el.innerHTML = parseFloat(el.innerHTML).toFixed(1);
          }
        }
      );
    });
  }
});

// ─── SECTION HEADERS: stagger in per section ───────────────────────────────
[["#ey1","#st1","#sb1"],["#ey2","#st2"],["#ey3","#st3"]].forEach(function(ids){
  gsap.fromTo(ids.join(","),
    { autoAlpha: 0, y: 36 },
    {
      autoAlpha: 1, y: 0,
      duration: 0.8, stagger: 0.12, ease: "power2.out",
      scrollTrigger: {
        trigger: ids[0],
        start: "top 95%",
        once: true
      }
    }
  );
});

// ─── STEP CARDS: batch stagger ─────────────────────────────────────────────
ScrollTrigger.batch(".step", {
  onEnter: function(batch) {
    gsap.fromTo(batch,
      { autoAlpha: 0, y: 55 },
      { autoAlpha: 1, y: 0, stagger: 0.14, duration: 0.75, ease: "power3.out" }
    );
  },
  once: true,
  start: "top 98%"
});

// ─── BENTO CARDS: batch stagger ────────────────────────────────────────────
ScrollTrigger.batch(".bc", {
  onEnter: function(batch) {
    gsap.fromTo(batch,
      { autoAlpha: 0, y: 48, scale: 0.97 },
      { autoAlpha: 1, y: 0, scale: 1, stagger: 0.1, duration: 0.72, ease: "power3.out" }
    );
  },
  once: true,
  start: "top 98%"
});

// ─── PHASES: scrub from left ───────────────────────────────────────────────
ScrollTrigger.batch(".phase", {
  onEnter: function(batch) {
    gsap.fromTo(batch,
      { autoAlpha: 0, x: -40 },
      { autoAlpha: 1, x: 0, stagger: 0.15, duration: 0.8, ease: "back.out(1.4)" }
    );
  },
  once: true,
  start: "top 85%"
});

// ─── CTA BANNER: scale in ─────────────────────────────────────────────────
gsap.fromTo("#cta-banner",
  { autoAlpha: 0, scale: 0.94, y: 40 },
  {
    autoAlpha: 1, scale: 1, y: 0, duration: 1, ease: "back.out(1.2)",
    scrollTrigger: { trigger: "#cta-banner", start: "top 85%", once: true }
  }
);

// ─── NAVBAR: hide/show on scroll ──────────────────────────────────────────
var lastY = 0;
ScrollTrigger.create({
  onUpdate: function(self) {
    var nav = document.querySelector(".navbar");
    if (!nav) return;
    if (self.direction === 1 && self.scroll() > 120) {
      gsap.to(nav, { y: -70, duration: 0.35, ease: "power2.in" });
    } else {
      gsap.to(nav, { y: 0, duration: 0.45, ease: "power2.out" });
    }
  }
});
</script>
</body>
</html>"""

components.html(LANDING_HTML, height=6400, scrolling=True)
