"""
Optimized data loaders for VeedurIA ContratoLimpio UI.

Provides fast, memory-efficient loading of scored contracts by:
  - Reading only the columns needed for the UI (14 of 114)
  - Offering a "quick preview" mode (most recent 50k rows)
  - Caching both preview and full datasets separately

Usage:
    from src.ui.data_loaders import load_preview, load_full, load_scored_data

    df = load_preview()          # Fast: ~50k most recent rows, 14 cols
    df_full = load_full()        # All rows, same 14 cols (cached after first call)
    df = load_scored_data()      # Alias for load_preview() — backward compat

Performance notes (2026-03-23):
  - Preview (50k rows): col-prune via columns=[...] + row-group tail skipping.
    Typical I/O: <2 s on cold cache, <50 ms on warm cache.
  - Full load (2.8M rows × 14 cols): ~5–8 s cold, instant on warm cache.
  - "Load full dataset" button sets session_state["full_dataset"]=True and
    calls st.rerun(); subsequent page run picks up the cached full DataFrame.
  - Table is capped at TABLE_PAGE_SIZE (2 000) rows per page. Neither
    preview nor full data is ever rendered wholesale in st.dataframe.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import streamlit as st

from src.utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"

# ---------------------------------------------------------------------------
# Column allowlist — only what the UI actually needs
# ---------------------------------------------------------------------------

# These 14 columns cover: sidebar filters, KPIs, map, table, detail panel.
# The full Parquet file has 114 columns / 1.15 GB; reading only 14 cuts
# memory by ~85% and load time by ~70%.
UI_COLUMNS: list[str] = [
    # Filters + table + detail
    "nombre_entidad",
    "nombre_entidad_norm",
    "nit_entidad",
    "nit_entidad_clean",
    "proveedor_adjudicado",
    "departamento",
    "modalidad_de_contratacion",
    "fecha_firma",
    "valor_contrato",
    # Risk
    "risk_score",
    "risk_label",
    # Detail panel extras
    "secop_url",
    "shap_explanations",
    # Optional: used by urlproceso link fallback
    "urlproceso",
]

# Preview size — most recent N rows for instant page load
PREVIEW_SIZE = 50_000

# Table page size — max rows rendered at once in st.dataframe
TABLE_PAGE_SIZE = 2_000


def _resolve_parquet_path() -> Path | None:
    """Find the best available Parquet file."""
    scored = DATA_PROCESSED / "scored_contracts.parquet"
    if scored.exists():
        return scored

    # Fallback: latest ingested file
    files = sorted(DATA_PROCESSED.glob("secop_contratos_*.parquet"))
    if files:
        return files[-1]

    return None


def _safe_read(path: Path, columns: list[str] | None = None,
               nrows: int | None = None) -> pd.DataFrame:
    """
    Read a Parquet file, silently dropping columns that don't exist.

    Args:
        path:    Path to Parquet file.
        columns: Desired columns (missing ones are skipped).
        nrows:   If set, read only the last N rows (most recent by position).
                 Uses row-group skipping so that only the trailing row-groups
                 are read from disk — no full-file scan.
    """
    import pyarrow as pa
    import pyarrow.parquet as pq

    schema = pq.read_schema(str(path))
    available = {f.name for f in schema}

    cols = [c for c in (columns or []) if c in available] or None

    if nrows is not None:
        pf = pq.ParquetFile(str(path))
        metadata = pf.metadata
        total = metadata.num_rows

        if total <= nrows:
            # File is small — read everything (columns still pruned)
            df = pf.read(columns=cols).to_pandas()
        else:
            # Walk row groups from the end, accumulating until we have nrows.
            # This avoids loading the full file into memory.
            rg_count = metadata.num_row_groups
            batches: list[pa.Table] = []
            collected = 0
            for rg_idx in range(rg_count - 1, -1, -1):
                rg_rows = metadata.row_group(rg_idx).num_rows
                batches.append(pf.read_row_group(rg_idx, columns=cols))
                collected += rg_rows
                if collected >= nrows:
                    break

            # Reverse so the table is chronological (oldest first within preview)
            batches.reverse()
            table = pa.concat_tables(batches)
            df = table.to_pandas()
            # Keep only the last nrows in case the final row group overshot
            if len(df) > nrows:
                df = df.iloc[-nrows:].reset_index(drop=True)

        logger.info(
            "Loaded %d / %d rows (%d columns) from %s [preview]",
            len(df), total, len(df.columns), path.name,
        )
    else:
        df = pd.read_parquet(path, columns=cols)
        logger.info(
            "Loaded %d rows (%d columns) from %s",
            len(df), len(df.columns), path.name,
        )

    return df


# ---------------------------------------------------------------------------
# Cached loaders
# ---------------------------------------------------------------------------

@st.cache_data(show_spinner="Cargando vista rápida…", max_entries=2, ttl=600)
def load_preview() -> pd.DataFrame:
    """
    Load a fast preview: most recent 50k rows, UI columns only.

    Cached for 10 minutes. First call reads ~50k rows × 14 cols from
    a 114-column / 2.8M-row Parquet file — typically < 2s.
    """
    path = _resolve_parquet_path()
    if path is None:
        return pd.DataFrame()
    return _safe_read(path, columns=UI_COLUMNS, nrows=PREVIEW_SIZE)


@st.cache_data(show_spinner="Cargando historial completo…", max_entries=2, ttl=600)
def load_full() -> pd.DataFrame:
    """
    Load the full dataset: all rows, UI columns only.

    Cached for 10 minutes. First call reads all 2.8M rows × 14 cols —
    typically ~5–8s (vs. 30+ seconds for 114 cols).
    """
    path = _resolve_parquet_path()
    if path is None:
        return pd.DataFrame()
    return _safe_read(path, columns=UI_COLUMNS)


def get_total_row_count() -> int:
    """Return the total number of rows without reading the file."""
    path = _resolve_parquet_path()
    if path is None:
        return 0
    import pyarrow.parquet as pq
    return pq.ParquetFile(str(path)).metadata.num_rows


# ---------------------------------------------------------------------------
# Legacy alias
# ---------------------------------------------------------------------------

@st.cache_data(show_spinner=True, max_entries=2)
def load_scored_data() -> pd.DataFrame:
    """
    Backward-compatible alias for load_preview().

    Decorated with @st.cache_data(show_spinner=True, max_entries=2) as
    specified in the original performance requirements. Internally delegates
    to load_preview() so both share the same 50k-row, 14-column contract.
    """
    return load_preview()
