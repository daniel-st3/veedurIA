"""
SECOP II Socrata client and ETL pipeline for VeedurIA.

Provides an authenticated sodapy.Socrata client configured for
www.datos.gov.co, plus the full incremental/backfill ingestion pipeline:
  1. Load last_run.json for :updated_at cutoff
  2. Fetch incrementally (paginated, with retry)
  3. Normalize locations and clean NITs
  4. Write Parquet to data/processed/
  5. Upload to Supabase Storage
  6. Atomically update last_run.json

Usage:
    from src.ingestion.secop_client import build_client, DATASETS

    client = build_client()
    rows = client.get(DATASETS["contratos"], where=..., limit=50000)

CLI entry point:
    python -m src.ingestion.secop_client --mode=incremental
    python -m src.ingestion.secop_client --mode=backfill
"""

from __future__ import annotations

import argparse
import json
import os
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pandas as pd
import requests

if TYPE_CHECKING:
    from sodapy import Socrata

from src.processing.entity_resolution import clean_nit, normalize_name
from src.utils.config import get_socrata_app_token
from src.utils.logger import get_logger, log_etl_event
from src.utils.rate_limiter import get_secop_limiter

logger = get_logger(__name__)
_limiter = get_secop_limiter()

# ---------------------------------------------------------------------------
# Constants — public, no secrets here
# ---------------------------------------------------------------------------

SOCRATA_DOMAIN = "www.datos.gov.co"

# Dataset resource IDs
DATASETS: dict[str, str] = {
    "contratos":   "jbjy-vk9h",   # SECOP II Contratos Electrónicos
    "procesos":    "p6dx-8zbt",   # SECOP II Procesos Contratación
    "adiciones":   "cb9c-h8sn",   # SECOP II Adiciones
    "proveedores": "qmzu-gj57",   # SECOP II Proveedores
    "tvec":        "rgxm-mmea",   # TVEC Tienda Virtual Estado
    "siri":        "iaeu-rcn6",   # SIRI Procuraduría antecedentes
}

DEFAULT_PAGE_SIZE = 50_000  # Maximum rows per Socrata request

# Retry configuration for transient failures (504s, timeouts)
MAX_RETRIES = 5
RETRY_BACKOFF_SECONDS = [4, 8, 16, 30, 60]  # Exponential backoff

# Paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"
LAST_RUN_PATH = DATA_PROCESSED / "last_run.json"

# Backfill date range — covers SECOP II history from its public launch year
BACKFILL_START_YEAR = 2018
BACKFILL_END_YEAR = 2026


# ---------------------------------------------------------------------------
# Client factory
# ---------------------------------------------------------------------------

def build_client() -> "Socrata":
    """
    Build and return an authenticated sodapy.Socrata client.

    Authentication uses the App Token only (sufficient for 1,000 req/hour).
    The token is passed via sodapy's `app_token` argument — sodapy sends it
    as an `X-App-Token` header, never in the URL query string.

    Returns:
        sodapy.Socrata: authenticated client. Use as a context manager to
        ensure the underlying session is closed: `with build_client() as c:`
    """
    from sodapy import Socrata  # noqa: PLC0415  (import inside function for testability)

    return Socrata(
        SOCRATA_DOMAIN,
        get_socrata_app_token(),
        timeout=120,
    )


# ---------------------------------------------------------------------------
# last_run.json management — atomic read/write
# ---------------------------------------------------------------------------

def load_last_run() -> dict[str, Any]:
    """
    Load the last run state from data/processed/last_run.json.

    Returns:
        Dict with keys: last_updated_at, last_run_ts, rows_fetched, dataset_key.
        If the file does not exist, returns defaults (nulls/zeros) so that
        the first incremental run fetches everything.
    """
    if not LAST_RUN_PATH.exists():
        logger.warning("last_run.json not found at %s — using defaults", LAST_RUN_PATH)
        return {
            "last_updated_at": None,
            "last_run_ts": None,
            "rows_fetched": 0,
            "dataset_key": "contratos",
        }

    with open(LAST_RUN_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    logger.info("Loaded last_run.json: updated_at=%s, rows=%d",
                data.get("last_updated_at"), data.get("rows_fetched", 0))
    return data


def save_last_run(state: dict[str, Any]) -> None:
    """
    Atomically save the last run state to data/processed/last_run.json.

    Uses write-to-temp-then-os.replace pattern to prevent corruption
    if the process is killed mid-write.

    Args:
        state: Dict to serialize as JSON.
    """
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)

    # Write to a temp file in the same directory (same filesystem = atomic rename)
    fd, tmp_path = tempfile.mkstemp(
        dir=str(DATA_PROCESSED),
        prefix="last_run_",
        suffix=".tmp",
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2, ensure_ascii=False, default=str)
            f.write("\n")
        os.replace(tmp_path, str(LAST_RUN_PATH))
        logger.info("Saved last_run.json atomically")
    except Exception:
        # Clean up temp file on failure
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


# ---------------------------------------------------------------------------
# Incremental pull with pagination and retry
# ---------------------------------------------------------------------------

def _fetch_page_with_retry(
    client: "Socrata",
    dataset_id: str,
    where: str,
    limit: int,
    offset: int,
    order: str = ":updated_at",
) -> list[dict]:
    """
    Fetch a single page from Socrata with exponential-backoff retry.

    Args:
        client:     Authenticated Socrata client.
        dataset_id: The 4x4 dataset resource identifier.
        where:      SoQL $where clause.
        limit:      Maximum rows to retrieve.
        offset:     Row offset for pagination.
        order:      SoQL $order clause (default: :updated_at ascending).

    Returns:
        List of row dicts for this page.

    Raises:
        Exception: Re-raises the last exception after MAX_RETRIES failures.
    """
    last_exc: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            _limiter.acquire()
            rows = client.get(
                dataset_id,
                where=where,
                limit=limit,
                offset=offset,
                order=order,
            )
            return rows
        except Exception as exc:
            last_exc = exc
            if attempt < MAX_RETRIES - 1:
                wait = RETRY_BACKOFF_SECONDS[attempt]
                logger.warning(
                    "Socrata request failed (attempt %d/%d), retrying in %ds: %s",
                    attempt + 1, MAX_RETRIES, wait, exc,
                )
                time.sleep(wait)
            else:
                logger.error(
                    "Socrata request failed after %d attempts: %s",
                    MAX_RETRIES, exc,
                )
    raise last_exc  # type: ignore[misc]


def fetch_incremental(
    dataset_key: str,
    last_updated_at: str,
    client: "Socrata | None" = None,
) -> list[dict]:
    """
    Fetch all rows updated after `last_updated_at` using SoQL :updated_at filter.

    Paginates automatically: loops with $offset until response < DEFAULT_PAGE_SIZE.

    Args:
        dataset_key:     Key from DATASETS dict (e.g. "contratos").
        last_updated_at: ISO 8601 UTC timestamp string, e.g. "2025-01-15T08:00:00.000".
        client:          Optional pre-built Socrata client (creates one if None).

    Returns:
        List of row dicts. May be empty if no updates since last_updated_at.

    Raises:
        KeyError: If dataset_key is not in DATASETS.
    """
    if dataset_key not in DATASETS:
        raise KeyError(
            f"Unknown dataset key '{dataset_key}'. Valid keys: {list(DATASETS.keys())}"
        )

    dataset_id = DATASETS[dataset_key]
    own_client = client is None
    if own_client:
        client = build_client()

    where_clause = f":updated_at > '{last_updated_at}'"
    all_rows: list[dict] = []
    offset = 0

    log_etl_event(
        "secop_fetch_start",
        dataset=dataset_key,
        dataset_id=dataset_id,
        since=last_updated_at,
    )

    try:
        while True:
            page = _fetch_page_with_retry(
                client=client,
                dataset_id=dataset_id,
                where=where_clause,
                limit=DEFAULT_PAGE_SIZE,
                offset=offset,
            )
            page_len = len(page)
            all_rows.extend(page)

            log_etl_event(
                "secop_fetch_page",
                dataset=dataset_key,
                offset=offset,
                page_rows=page_len,
                total_so_far=len(all_rows),
            )

            if page_len < DEFAULT_PAGE_SIZE:
                # Last page — fewer rows than limit means no more data
                break
            offset += DEFAULT_PAGE_SIZE
    finally:
        if own_client and client is not None:
            client.close()

    log_etl_event(
        "secop_fetch_complete",
        dataset=dataset_key,
        total_rows=len(all_rows),
    )
    return all_rows


def fetch_by_date_range(
    dataset_key: str,
    start_date: str,
    end_date: str,
    client: "Socrata | None" = None,
) -> list[dict]:
    """
    Fetch all rows where fecha_firma falls within [start_date, end_date].
    Used for backfill mode — monthly date-slice loop.

    Args:
        dataset_key: Key from DATASETS dict.
        start_date:  ISO date string (e.g. "2023-01-01").
        end_date:    ISO date string (e.g. "2023-01-31").
        client:      Optional pre-built Socrata client.

    Returns:
        List of row dicts for the date range.
    """
    if dataset_key not in DATASETS:
        raise KeyError(
            f"Unknown dataset key '{dataset_key}'. Valid keys: {list(DATASETS.keys())}"
        )

    dataset_id = DATASETS[dataset_key]
    own_client = client is None
    if own_client:
        client = build_client()

    where_clause = (
        f"fecha_de_firma >= '{start_date}T00:00:00.000' "
        f"AND fecha_de_firma < '{end_date}T00:00:00.000'"
    )
    all_rows: list[dict] = []
    offset = 0

    log_etl_event(
        "secop_backfill_start",
        dataset=dataset_key,
        start_date=start_date,
        end_date=end_date,
    )

    try:
        while True:
            page = _fetch_page_with_retry(
                client=client,
                dataset_id=dataset_id,
                where=where_clause,
                limit=DEFAULT_PAGE_SIZE,
                offset=offset,
                order="fecha_de_firma",
            )
            page_len = len(page)
            all_rows.extend(page)

            log_etl_event(
                "secop_backfill_page",
                dataset=dataset_key,
                offset=offset,
                page_rows=page_len,
                total_so_far=len(all_rows),
            )

            if page_len < DEFAULT_PAGE_SIZE:
                break
            offset += DEFAULT_PAGE_SIZE
    finally:
        if own_client and client is not None:
            client.close()

    log_etl_event(
        "secop_backfill_complete",
        dataset=dataset_key,
        start_date=start_date,
        end_date=end_date,
        total_rows=len(all_rows),
    )
    return all_rows


# ---------------------------------------------------------------------------
# Data normalization
# ---------------------------------------------------------------------------

def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize a raw SECOP II DataFrame:
      - Clean NIT columns (nit_entidad, nit_proveedor)
      - Normalize entity/provider names
      - Convert valor_contrato to numeric
      - Parse date columns

    Args:
        df: Raw DataFrame from Socrata API.

    Returns:
        Cleaned DataFrame (in-place modifications on a copy).
    """
    df = df.copy()

    # Standardize fecha_de_firma to fecha_firma for downstream
    if "fecha_de_firma" in df.columns:
        df.rename(columns={"fecha_de_firma": "fecha_firma"}, inplace=True)
        
    # Clean NITs
    if "nit_entidad" in df.columns:
        df["nit_entidad_clean"] = df["nit_entidad"].apply(clean_nit)
    if "nit_proveedor" in df.columns:
        df["nit_proveedor_clean"] = df["nit_proveedor"].apply(clean_nit)

    # Normalize names
    if "nombre_entidad" in df.columns:
        df["nombre_entidad_norm"] = df["nombre_entidad"].apply(normalize_name)
    if "proveedor_adjudicado" in df.columns:
        df["proveedor_adjudicado_norm"] = df["proveedor_adjudicado"].apply(normalize_name)

    # Numeric conversions — coerce errors to NaN (never drop rows)
    for col in ("valor_contrato", "valor_contrato_con_adiciones",
                "valor_de_pago_adelantado", "numero_de_ofertantes"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Date parsing
    date_cols = [
        "fecha_firma", "fecha_de_fin_del_contrato",
        "fecha_publicacion_proceso", "fecha_de_inicio_del_contrato",
    ]
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce", utc=True)

    return df


# ---------------------------------------------------------------------------
# Parquet I/O
# ---------------------------------------------------------------------------

def write_parquet(df: pd.DataFrame, label: str) -> Path:
    """
    Write a DataFrame to data/processed/ as a Parquet file.

    Args:
        df:    DataFrame to save.
        label: Descriptive label (e.g. "incremental_20250315",
               "backfill_2023_01").

    Returns:
        Path to the written Parquet file.
    """
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    filename = f"secop_contratos_{label}_{ts}.parquet"
    path = DATA_PROCESSED / filename

    df.to_parquet(path, engine="pyarrow", index=False)
    log_etl_event("parquet_written", path=str(path), rows=len(df))
    return path


# ---------------------------------------------------------------------------
# Supabase upload
# ---------------------------------------------------------------------------

def upload_to_supabase(parquet_path: Path) -> dict[str, str] | None:
    """
    Upload a Parquet file to Supabase Storage (veeduria-processed bucket).

    Uses src.utils.config to get Supabase credentials. Logs success/failure
    but does NOT raise on upload failure (non-blocking for the ETL pipeline).

    Returns metadata about the uploaded object when successful so callers can
    persist the remote path in last_run.json and later rehydrate the newest
    scored parquet without committing large binaries to git.
    """
    try:
        from src.utils.config import get_supabase_key, get_supabase_storage_bucket, get_supabase_url

        key = os.getenv("SUPABASE_SERVICE_KEY") or get_supabase_key()
        bucket = get_supabase_storage_bucket()
        remote_path = f"data/{parquet_path.name}"
        file_bytes = parquet_path.read_bytes()
        response = requests.post(
            f"{get_supabase_url().rstrip('/')}/storage/v1/object/{bucket}/{remote_path}",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/octet-stream",
                "x-upsert": "true",
            },
            data=file_bytes,
            timeout=300,
        )
        if response.status_code >= 400:
            raise RuntimeError(f"Storage upload failed: {response.status_code} {response.text[:500]}")

        log_etl_event(
            "supabase_upload_success",
            bucket=bucket,
            remote_path=remote_path,
            size_bytes=len(file_bytes),
        )
        return {"bucket": bucket, "remote_path": remote_path}
    except Exception as exc:
        logger.error("Supabase upload failed (non-blocking): %s", exc)
        log_etl_event("supabase_upload_failed", error=str(exc))
        return None


# ---------------------------------------------------------------------------
# ETL orchestration
# ---------------------------------------------------------------------------

def _generate_monthly_slices(start_year: int, end_year: int) -> list[tuple[str, str]]:
    """Generate (start_date, end_date) tuples for each month in the range."""
    slices = []
    for year in range(start_year, end_year + 1):
        for month in range(1, 13):
            start = f"{year}-{month:02d}-01"
            # End is the first day of next month
            if month == 12:
                end = f"{year + 1}-01-01"
            else:
                end = f"{year}-{month + 1:02d}-01"
            slices.append((start, end))
    return slices


def run_incremental(client: "Socrata") -> None:
    """Run incremental ingestion page-by-page to avoid holding SECOP in memory."""
    state = load_last_run()
    dataset_key = state.get("dataset_key", "contratos")

    # Default cutoff if this is the very first run
    last_updated_at = state.get("last_updated_at") or "2023-01-01T00:00:00.000"
    if dataset_key not in DATASETS:
        raise KeyError(
            f"Unknown dataset key '{dataset_key}'. Valid keys: {list(DATASETS.keys())}"
        )

    log_etl_event("etl_incremental_start", since=last_updated_at)

    dataset_id = DATASETS[dataset_key]
    where_clause = f":updated_at > '{last_updated_at}'"
    run_label = datetime.now(timezone.utc).strftime("%Y%m%d")
    offset = 0
    total_new_rows = 0

    log_etl_event(
        "secop_fetch_start",
        dataset=dataset_key,
        dataset_id=dataset_id,
        since=last_updated_at,
    )

    while True:
        page = _fetch_page_with_retry(
            client=client,
            dataset_id=dataset_id,
            where=where_clause,
            limit=DEFAULT_PAGE_SIZE,
            offset=offset,
        )
        page_len = len(page)

        log_etl_event(
            "secop_fetch_page",
            dataset=dataset_key,
            offset=offset,
            page_rows=page_len,
            total_so_far=total_new_rows + page_len,
        )

        if page_len:
            df = normalize_dataframe(pd.DataFrame(page))
            label = f"incremental_{run_label}_part_{offset // DEFAULT_PAGE_SIZE + 1:04d}"
            write_parquet(df, label)
            total_new_rows += page_len

        if page_len < DEFAULT_PAGE_SIZE:
            break

        offset += DEFAULT_PAGE_SIZE

    log_etl_event(
        "secop_fetch_complete",
        dataset=dataset_key,
        total_rows=total_new_rows,
    )

    if total_new_rows == 0:
        logger.info("No new rows since %s — nothing to do.", last_updated_at)
        state["last_run_ts"] = datetime.now(timezone.utc).isoformat()
        save_last_run(state)
        return

    # Update state
    now = datetime.now(timezone.utc).isoformat()
    state["last_updated_at"] = now
    state["last_run_ts"] = now
    state["rows_fetched"] = state.get("rows_fetched", 0) + total_new_rows
    save_last_run(state)

    log_etl_event("etl_incremental_complete", new_rows=total_new_rows, total=state["rows_fetched"])


def run_backfill(client: "Socrata") -> None:
    """Run backfill: monthly date-slice loop for BACKFILL_START_YEAR–BACKFILL_END_YEAR."""
    dataset_key = "contratos"
    state = load_last_run()
    slices = _generate_monthly_slices(BACKFILL_START_YEAR, BACKFILL_END_YEAR)
    total_rows = state.get("rows_fetched", 0)

    log_etl_event(
        "etl_backfill_start",
        start_year=BACKFILL_START_YEAR,
        end_year=BACKFILL_END_YEAR,
        total_slices=len(slices),
    )

    for i, (start_date, end_date) in enumerate(slices, 1):
        logger.info("Backfill slice %d/%d: %s to %s", i, len(slices), start_date, end_date)

        rows = fetch_by_date_range(dataset_key, start_date, end_date, client=client)

        if not rows:
            logger.info("No rows for %s — %s, skipping.", start_date, end_date)
            continue

        df = pd.DataFrame(rows)
        df = normalize_dataframe(df)

        label = f"backfill_{start_date[:7].replace('-', '_')}"
        parquet_path = write_parquet(df, label)
        upload_result = upload_to_supabase(parquet_path)
        if upload_result:
            state["latest_remote_path"] = upload_result["remote_path"]
            state["latest_uploaded_at"] = datetime.now(timezone.utc).isoformat()

        total_rows += len(rows)
        log_etl_event(
            "backfill_slice_complete",
            slice_num=i,
            start_date=start_date,
            end_date=end_date,
            slice_rows=len(rows),
            total_rows=total_rows,
        )

    # Update last_run state after full backfill
    completed_at = datetime.now(timezone.utc).isoformat()
    final_state = {
        "last_updated_at": completed_at,
        "last_run_ts": completed_at,
        "rows_fetched": total_rows,
        "dataset_key": dataset_key,
    }
    if state.get("latest_remote_path"):
        final_state["latest_remote_path"] = state["latest_remote_path"]
        final_state["latest_uploaded_at"] = state.get("latest_uploaded_at", completed_at)
    save_last_run(final_state)

    log_etl_event("etl_backfill_complete", total_rows=total_rows)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="VeedurIA — SECOP II incremental ingestion"
    )
    parser.add_argument(
        "--mode",
        choices=["incremental", "backfill"],
        default="incremental",
        help="Ingestion mode (default: incremental)",
    )
    return parser.parse_args()


def main() -> None:
    """CLI entry point: python -m src.ingestion.secop_client --mode=incremental"""
    args = _parse_args()

    logger.info("SECOP ingestion starting — mode=%s", args.mode)

    client = build_client()
    try:
        if args.mode == "backfill":
            run_backfill(client)
        else:
            run_incremental(client)
    finally:
        client.close()

    logger.info("SECOP ingestion finished — mode=%s", args.mode)


if __name__ == "__main__":
    main()
