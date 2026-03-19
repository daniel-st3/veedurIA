"""
VeedurIA — Home / Landing Page.

Streamlit entry point for the multi-page app. Shows the 3-phase roadmap
and provides navigation to each module.
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
# Semantic Modern Hero section
# ---------------------------------------------------------------------------

st.markdown("<br><br>", unsafe_allow_html=True)
col_left, col_right = st.columns([1, 1], gap="large")

with col_left:
    st.markdown("<br><br>", unsafe_allow_html=True)
    st.markdown(
        f"""
        <div style="text-align: left;">
            <h1 style="font-size: 3.5rem; font-weight: 800; line-height: 1.1; margin-bottom: 1.5rem; letter-spacing: -0.02em; color: #111;">
                {t('home_hero_title')}
            </h1>
            <p style="font-size: 1.3rem; color: #555; font-weight: 400; line-height: 1.5; margin-bottom: 2.5rem; max-width: 90%;">
                {t('home_hero_subtitle')}
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.page_link("pages/1_ContratoLimpio.py", label=t("home_button_enter"), icon="🚦")

with col_right:
    st.markdown("""
        <div style="border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.15); border: 1px solid rgba(0,0,0,0.05); transform: perspective(1000px) rotateY(-5deg);">
            <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=1200" style="width: 100%; height: 450px; object-fit: cover; display: block;" alt="Dashboard aesthetic" />
        </div>
    """, unsafe_allow_html=True)

# Footer
st.markdown('<div style="margin-top: 6rem; border-top: 1px solid #eaeaea; padding-top: 2rem;">', unsafe_allow_html=True)
st.caption(t("home_developed_by"))
st.markdown('</div>', unsafe_allow_html=True)
