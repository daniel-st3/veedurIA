"""
VeedurIA — Home / Landing Page.

Streamlit entry point for the multi-page app. Features a modern hero
section with an animated Plotly Colombia choropleth map and clear CTA.
"""

import streamlit as st

# ---------------------------------------------------------------------------
# Page config (must be the first Streamlit command)
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="VeedurIA Veeduría Ciudadana Inteligente",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ---------------------------------------------------------------------------
# Language initialization
# ---------------------------------------------------------------------------

if "lang" not in st.session_state:
    st.session_state["lang"] = "es"

from src.ui.i18n import load_translations, t  # noqa: E402

# ---------------------------------------------------------------------------
# Sidebar — Language toggle
# ---------------------------------------------------------------------------

with st.sidebar:
    lang_options = {"Español": "es", "English": "en"}
    selected_lang = st.selectbox(
        t("lang_label"),
        options=list(lang_options.keys()),
        index=0 if st.session_state["lang"] == "es" else 1,
        key="lang_selector",
    )
    st.session_state["lang"] = lang_options[selected_lang]

    st.markdown("---")
    st.caption(t("footer_text"))

# ---------------------------------------------------------------------------
# Global CSS — Modern civic-tech aesthetic
# ---------------------------------------------------------------------------

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

/* Global overrides */
.stApp {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
}

/* Fade-in animation */
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
}

.hero-title {
    animation: fadeInUp 0.7s ease-out both;
}
.hero-subtitle {
    animation: fadeInUp 0.7s ease-out 0.15s both;
}
.hero-cta {
    animation: fadeInUp 0.7s ease-out 0.3s both;
}
.hero-map {
    animation: fadeInUp 0.8s ease-out 0.2s both;
}

/* Phase cards */
.phase-card {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 16px;
    padding: 1.8rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    height: 100%;
}
.phase-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
    border-color: rgba(0, 0, 0, 0.1);
}
.phase-card h3 {
    font-size: 1.2rem;
    font-weight: 700;
    color: #111;
    margin: 0 0 0.6rem 0;
}
.phase-card p {
    font-size: 0.95rem;
    color: #555;
    line-height: 1.5;
    margin: 0;
}
.phase-badge {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    margin-bottom: 0.8rem;
}
.badge-active {
    background: rgba(52, 199, 89, 0.1);
    color: #34C759;
}
.badge-soon {
    background: rgba(0, 0, 0, 0.05);
    color: #8E8E93;
}

/* CTA button style override */
.stPageLink > a {
    background: linear-gradient(135deg, #007AFF, #5856D6) !important;
    color: white !important;
    border: none !important;
    padding: 0.8rem 2rem !important;
    border-radius: 12px !important;
    font-weight: 600 !important;
    font-size: 1.05rem !important;
    transition: all 0.3s ease !important;
    box-shadow: 0 4px 16px rgba(0, 122, 255, 0.25) !important;
}
.stPageLink > a:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 24px rgba(0, 122, 255, 0.35) !important;
}

/* Footer */
.footer-bar {
    margin-top: 5rem;
    padding: 2rem 0;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
    text-align: center;
    color: #8E8E93;
    font-size: 0.85rem;
}
</style>
""", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Hero section
# ---------------------------------------------------------------------------

st.markdown("<br>", unsafe_allow_html=True)
col_left, col_right = st.columns([1, 1], gap="large")

with col_left:
    st.markdown("<br><br>", unsafe_allow_html=True)
    st.markdown(
        f"""
        <div class="hero-title">
            <h1 style="font-size: 3.2rem; font-weight: 800; line-height: 1.08;
                        margin-bottom: 1.2rem; letter-spacing: -0.03em; color: #111;">
                {t('home_hero_title')}
            </h1>
        </div>
        <div class="hero-subtitle">
            <p style="font-size: 1.25rem; color: #555; font-weight: 400;
                       line-height: 1.55; margin-bottom: 2rem; max-width: 95%;">
                {t('home_hero_subtitle')}
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.markdown('<div class="hero-cta">', unsafe_allow_html=True)
    st.page_link("pages/1_ContratoLimpio.py", label=t("home_button_enter"), icon="🚦")
    st.markdown('</div>', unsafe_allow_html=True)

with col_right:
    st.markdown('<div class="hero-map">', unsafe_allow_html=True)
    # Animated Colombia map
    from src.ui.maps import render_hero_colombia_map
    render_hero_colombia_map()
    st.markdown('</div>', unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Phases section
# ---------------------------------------------------------------------------

st.markdown("<br><br>", unsafe_allow_html=True)
st.markdown(
    f"<h2 style='text-align: center; font-size: 1.8rem; font-weight: 700; "
    f"letter-spacing: -0.02em; color: #111; margin-bottom: 2rem;'>"
    f"{t('home_phases_title')}</h2>",
    unsafe_allow_html=True,
)

p1, p2, p3 = st.columns(3, gap="medium")

with p1:
    st.markdown(f"""
    <div class="phase-card">
        <span class="phase-badge badge-active">FASE 1 · ACTIVA</span>
        <h3>🚦 {t('phase_1_title')}</h3>
        <p>{t('phase_1_desc')}</p>
    </div>
    """, unsafe_allow_html=True)

with p2:
    st.markdown(f"""
    <div class="phase-card">
        <span class="phase-badge badge-soon">{t('coming_soon').upper()}</span>
        <h3>💰 {t('phase_2_title')}</h3>
        <p>{t('phase_2_desc')}</p>
    </div>
    """, unsafe_allow_html=True)

with p3:
    st.markdown(f"""
    <div class="phase-card">
        <span class="phase-badge badge-soon">{t('coming_soon').upper()}</span>
        <h3>📊 {t('phase_3_title')}</h3>
        <p>{t('phase_3_desc')}</p>
    </div>
    """, unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Footer
# ---------------------------------------------------------------------------

st.markdown(f"""
<div class="footer-bar">
    {t('home_developed_by')} · {t('footer_text')}
</div>
""", unsafe_allow_html=True)
