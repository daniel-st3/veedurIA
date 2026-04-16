"""
Centralized config loader for VeedurIA.

Priority order for secret resolution:
  1. os.getenv              — local and deployed web/backend runtime
  2. .streamlit/secrets.toml — legacy local fallback if the file exists

All callers must go through this module. Never call os.getenv directly in
other src/ modules.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
import tomllib

from dotenv import load_dotenv

# Load .env for local development. No-op when running on Streamlit Cloud
# (environment variables are already set by the platform).
load_dotenv()


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
STREAMLIT_SECRETS_PATH = PROJECT_ROOT / ".streamlit" / "secrets.toml"


@lru_cache(maxsize=1)
def _load_legacy_streamlit_secrets() -> dict[str, str]:
    if not STREAMLIT_SECRETS_PATH.exists():
        return {}
    try:
        with open(STREAMLIT_SECRETS_PATH, "rb") as handle:
            data = tomllib.load(handle)
    except (OSError, tomllib.TOMLDecodeError):
        return {}
    return {str(key): str(value) for key, value in data.items()}


def _get(key: str) -> str:
    """
    Resolve a secret by name.

    Tries environment variables first for the active Next.js + FastAPI stack.
    Falls back to `.streamlit/secrets.toml` only when that legacy local file
    exists, so old developer setups still resolve credentials without keeping
    Streamlit as an operational dependency.

    Raises RuntimeError if the key is absent in both sources so that
    misconfiguration surfaces immediately rather than producing silent
    downstream failures.

    The resolved value is NEVER logged, printed, or stored in an attribute
    visible outside this function.
    """
    # --- Active runtime: .env / process environment ------------------------------
    value = os.getenv(key)
    if value:
        return value

    # --- Legacy local fallback: .streamlit/secrets.toml --------------------------
    value = _load_legacy_streamlit_secrets().get(key)
    if value:
        return value

    raise RuntimeError(
        f"Required secret '{key}' not found. "
        "Set it in .env / process environment. "
        "See .env.example for the full list of required keys."
    )


def _get_optional(key: str) -> str | None:
    value = os.getenv(key)
    if value:
        return value
    value = _load_legacy_streamlit_secrets().get(key)
    if value:
        return value
    return None


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
def get_optional_socrata_app_token() -> str | None:
    """Optional app token for low-volume public reads against Socrata."""
    return _get_optional("SOCRATA_APP_TOKEN")


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


@lru_cache(maxsize=1)
def get_votometro_storage_bucket() -> str:
    return _get_optional("VOTOMETRO_STORAGE_BUCKET") or "votometro-source-snapshots"
