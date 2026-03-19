"""
Centralized config loader for VeedurIA.

Priority order for secret resolution:
  1. st.secrets  — Streamlit Cloud production (and local .streamlit/secrets.toml)
  2. os.getenv   — local development via python-dotenv loading .env

All callers must go through this module. Never call st.secrets or os.getenv
directly in pages/ or in any other src/ module.
"""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

# Load .env for local development. No-op when running on Streamlit Cloud
# (environment variables are already set by the platform).
load_dotenv()


def _get(key: str) -> str:
    """
    Resolve a secret by name.

    Tries st.secrets first so Streamlit Cloud's secret management takes
    precedence. Falls back to environment variables for CLI runs (ingestion,
    model training) where Streamlit is not initialised.

    Raises RuntimeError if the key is absent in both sources so that
    misconfiguration surfaces immediately rather than producing silent
    downstream failures.

    The resolved value is NEVER logged, printed, or stored in an attribute
    visible outside this function.
    """
    # --- Streamlit context (app running or .streamlit/secrets.toml present) ---
    try:
        import streamlit as st  # lazy import — not available in CLI runs

        value = st.secrets.get(key)
        if value:
            return value
    except Exception:
        # ImportError  → Streamlit not installed (shouldn't happen, but safe)
        # RuntimeError → st.secrets not accessible outside a Streamlit app
        # Any other    → treat as unavailable, fall through to os.getenv
        pass

    # --- CLI / local development via .env ----------------------------------------
    value = os.getenv(key)
    if value:
        return value

    raise RuntimeError(
        f"Required secret '{key}' not found. "
        "Set it in .env (local dev) or st.secrets (Streamlit Cloud). "
        "See .env.example for the full list of required keys."
    )


# ---------------------------------------------------------------------------
# Public accessor functions — one per credential family.
# Keep each function single-purpose so callers are explicit about what they need.
# Results are cached per-process to avoid repeated secret lookups.
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def get_socrata_app_token() -> str:
    """App Token for X-App-Token header on all datos.gov.co requests."""
    return _get("SOCRATA_APP_TOKEN")


@lru_cache(maxsize=1)
def get_socrata_client_id() -> str:
    """OAuth2 client ID (for future high-volume or write-access flows)."""
    return _get("SOCRATA_CLIENT_ID")


@lru_cache(maxsize=1)
def get_socrata_client_secret() -> str:
    """OAuth2 client secret. Never log or surface this value."""
    return _get("SOCRATA_CLIENT_SECRET")


@lru_cache(maxsize=1)
def get_socrata_app_secret() -> str:
    """App Secret token. Never log or surface this value."""
    return _get("SOCRATA_APP_SECRET")


@lru_cache(maxsize=1)
def get_supabase_url() -> str:
    return _get("SUPABASE_URL")


@lru_cache(maxsize=1)
def get_supabase_key() -> str:
    return _get("SUPABASE_KEY")


@lru_cache(maxsize=1)
def get_supabase_storage_bucket() -> str:
    return _get("SUPABASE_STORAGE_BUCKET")
