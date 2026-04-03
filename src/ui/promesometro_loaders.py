"""
Data loaders for VeedurIA PromesóMetro UI.

Provides cached Parquet loaders for promises, coherence, and actions tables.
Mirrors the pattern in src/ui/data_loaders.py:
  - Local Parquet first → last_run.json Supabase URL fallback.
  - Column allowlists to minimize memory footprint.
  - st.cache_data(ttl=3600) on every loader.

Usage:
    from src.ui.promesometro_loaders import (
        load_promises, load_coherence, load_actions,
        get_politicians_list, get_coherence_kpis,
    )

    df_coh   = load_coherence()
    df_prom  = load_promises()
    pol_list = get_politicians_list(df_coh)
    kpis     = get_coherence_kpis(df_coh)
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import streamlit as st

from src.utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECT_ROOT   = Path(__file__).resolve().parent.parent.parent
PROMISES_DIR   = PROJECT_ROOT / "data" / "processed" / "promises"
LAST_RUN_PATH  = PROJECT_ROOT / "data" / "processed" / "last_run.json"

# ---------------------------------------------------------------------------
# Column allowlists
# ---------------------------------------------------------------------------

PROMISE_UI_COLUMNS: list[str] = [
    "promise_id",
    "politician_id",
    "politician_name_norm",
    "chamber",
    "party",
    "election_year",
    "source_url",
    "promise_text",
    "promise_text_clean",
    "domain",
    "domain_confidence",
    "extraction_confidence",
]

COHERENCE_UI_COLUMNS: list[str] = [
    "coherence_id",
    "promise_id",
    "action_id",
    "politician_id",
    "domain",
    "similarity_score",
    "status",
    "status_confidence",
    "politician_coherence_score",
    "evidence_snippet",
    "election_year",
    "scored_at",
]

ACTION_UI_COLUMNS: list[str] = [
    "action_id",
    "action_type",
    "action_title",
    "action_text_summary",
    "action_date",
    "source_url",
    "source_system",
    "domain_hint",
]


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------

@st.cache_data(ttl=3600, show_spinner=False)
def load_promises() -> pd.DataFrame:
    """
    Load promises.parquet — column-pruned to PROMISE_UI_COLUMNS.
    Falls back to Supabase URL from last_run.json if local file not found.
    """
    return _load_parquet(
        local_path=PROMISES_DIR / "promises.parquet",
        run_key="promises",
        columns=PROMISE_UI_COLUMNS,
        name="promises",
    )


@st.cache_data(ttl=3600, show_spinner=False)
def load_coherence() -> pd.DataFrame:
    """
    Load coherence.parquet — column-pruned to COHERENCE_UI_COLUMNS.
    Falls back to Supabase URL from last_run.json if local file not found.
    """
    return _load_parquet(
        local_path=PROMISES_DIR / "coherence.parquet",
        run_key="coherence",
        columns=COHERENCE_UI_COLUMNS,
        name="coherence",
    )


@st.cache_data(ttl=3600, show_spinner=False)
def load_actions(action_ids: tuple[str, ...]) -> pd.DataFrame:
    """
    Load action rows for a specific set of action_ids.
    Takes a tuple (not list) so it is hashable by st.cache_data.

    Args:
        action_ids: Tuple of action_id strings to retrieve.

    Returns:
        DataFrame with ACTION_UI_COLUMNS, filtered to the requested IDs.
    """
    df = _load_parquet(
        local_path=PROMISES_DIR / "actions.parquet",
        run_key="promises_actions",
        columns=ACTION_UI_COLUMNS,
        name="actions",
    )
    if df.empty or not action_ids:
        return df
    return df[df["action_id"].isin(set(action_ids))].reset_index(drop=True)


# ---------------------------------------------------------------------------
# Derived helpers
# ---------------------------------------------------------------------------

def get_politicians_list(df_coherence: pd.DataFrame) -> list[str]:
    """
    Return sorted list of politician display strings from the coherence table.

    Format: "NOMBRE NORMALIZADO (partido)" or "NOMBRE NORMALIZADO" if no party.
    Falls back to politician_id if name is unavailable.

    Returns empty list if df_coherence is empty or missing required columns.
    """
    if df_coherence.empty:
        return []
    if "politician_id" not in df_coherence.columns:
        return []

    # Try to enrich with name from promises (if available in cache)
    pol_ids = df_coherence["politician_id"].dropna().unique().tolist()
    return sorted(str(p) for p in pol_ids if p)


def get_coherence_kpis(df_coherence: pd.DataFrame) -> dict:
    """
    Compute the 4 KPI values shown in the PromesóMetro overview panel.

    Returns:
        {
            "politicians_tracked": int,
            "total_promises":      int,
            "coherence_rate_pct":  float (0–100),
            "freshness_label":     str,
        }
    """
    if df_coherence.empty:
        return {
            "politicians_tracked": 0,
            "total_promises":      0,
            "coherence_rate_pct":  0.0,
            "freshness_label":     "Sin datos",
        }

    n_politicians = int(df_coherence["politician_id"].nunique())
    n_promises    = int(len(df_coherence))

    fulfilled_mask = df_coherence["status"] == "con_accion_registrada"
    progress_mask  = df_coherence["status"] == "en_seguimiento"
    active = fulfilled_mask.sum() + progress_mask.sum()
    coherence_rate = round(active / n_promises * 100, 1) if n_promises > 0 else 0.0

    freshness_label = _compute_freshness_label(df_coherence)

    return {
        "politicians_tracked": n_politicians,
        "total_promises":      n_promises,
        "coherence_rate_pct":  coherence_rate,
        "freshness_label":     freshness_label,
    }


def _compute_freshness_label(df: pd.DataFrame) -> str:
    """Return a human-readable freshness label based on scored_at column."""
    if "scored_at" not in df.columns:
        return "Desconocido"
    try:
        latest_str = df["scored_at"].max()
        if not latest_str or pd.isna(latest_str):
            return "Desconocido"
        latest = datetime.fromisoformat(str(latest_str).replace("Z", "+00:00"))
        now    = datetime.now(timezone.utc)
        diff_h = (now - latest).total_seconds() / 3600
        if diff_h < 1:
            return "Actualizado"
        if diff_h < 24:
            return f"Hace {int(diff_h)}h"
        diff_d = int(diff_h / 24)
        return f"Hace {diff_d}d"
    except Exception:
        return "Desconocido"


# ---------------------------------------------------------------------------
# Internal parquet loader with Supabase fallback
# ---------------------------------------------------------------------------

def _load_parquet(
    local_path: Path,
    run_key: str,
    columns: list[str],
    name: str,
) -> pd.DataFrame:
    """
    Try loading a Parquet file locally; fall back to Supabase URL from last_run.json.
    Only loads columns in `columns` (if they exist in the file).
    """
    # 1. Local file
    if local_path.exists():
        try:
            df = pd.read_parquet(local_path, engine="pyarrow")
            df = _prune_columns(df, columns)
            logger.info("Loaded %s from local: %d rows", name, len(df))
            return df
        except Exception as exc:
            logger.warning("Local parquet load failed (%s): %s", name, exc)

    # 2. Supabase URL from last_run.json
    url = _get_supabase_url(run_key)
    if url:
        try:
            df = pd.read_parquet(url, engine="pyarrow")
            df = _prune_columns(df, columns)
            logger.info("Loaded %s from Supabase: %d rows", name, len(df))
            return df
        except Exception as exc:
            logger.warning("Supabase parquet load failed (%s): %s", name, exc)

    logger.warning("%s data not available (local=%s, supabase=%s).", name, local_path, bool(url))
    return pd.DataFrame()


def _prune_columns(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    """Keep only columns that exist in both the allowlist and the DataFrame."""
    available = [c for c in columns if c in df.columns]
    return df[available]


def _get_supabase_url(run_key: str) -> str | None:
    """Read the Supabase parquet URL for run_key from last_run.json."""
    if not LAST_RUN_PATH.exists():
        return None
    try:
        with open(LAST_RUN_PATH, encoding="utf-8") as f:
            data = json.load(f)
        return data.get(run_key, {}).get("parquet_url")
    except (json.JSONDecodeError, OSError):
        return None
