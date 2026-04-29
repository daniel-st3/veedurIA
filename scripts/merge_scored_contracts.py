"""
Merge the previous scored SECOP snapshot from Supabase Storage with the
newly-scored incremental parquet produced by the daily workflow.

GitHub Actions does not keep the large historical parquet files in git. This
script rehydrates the latest scored snapshot from Supabase Storage using
data/processed/last_run.json, appends the new scored rows, deduplicates by
id_contrato, and writes data/processed/scored_contracts.parquet for the
Postgres import step.
"""

from __future__ import annotations

import json
import os
import pathlib
import sys
from typing import Any

import duckdb

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "processed"
STATE_PATH = DATA / "last_run.json"
CURRENT_SCORED = DATA / "scored_contracts.parquet"
REMOTE_CACHE = DATA / "remote_scored_contracts.parquet"
MERGED_TMP = DATA / "scored_contracts.merged.tmp.parquet"

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ImportError:
    pass


def _load_state() -> dict[str, Any]:
    if not STATE_PATH.exists():
        return {}
    return json.loads(STATE_PATH.read_text())


def _download_remote(remote_path: str) -> pathlib.Path | None:
    if not remote_path:
        return None

    from supabase import create_client

    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY", "")
    bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "").strip()
    if not url or not key or not bucket:
        raise RuntimeError("Missing SUPABASE_URL, SUPABASE_KEY/SUPABASE_SERVICE_KEY, or SUPABASE_STORAGE_BUCKET")

    payload = create_client(url, key).storage.from_(bucket).download(remote_path)
    if not payload:
        return None

    REMOTE_CACHE.write_bytes(payload)
    print(f"Downloaded previous scored snapshot: {remote_path} -> {REMOTE_CACHE}")
    return REMOTE_CACHE


def main() -> None:
    if not CURRENT_SCORED.exists():
        sys.exit(f"Current scored parquet not found: {CURRENT_SCORED}")

    state = _load_state()
    remote_path = str(state.get("scored_remote_path") or "").strip()
    remote_scored = _download_remote(remote_path)

    con = duckdb.connect()
    con.execute("set preserve_insertion_order=false")
    con.execute("set threads=1")
    con.execute(f"set temp_directory='{str((DATA / 'duckdb_tmp')).replace("'", "''")}'")
    con.execute("set memory_limit='2GB'")
    current_count = con.execute(
        "select count(*) from read_parquet(?)",
        [str(CURRENT_SCORED)],
    ).fetchone()[0]
    if current_count == 0:
        sys.exit("Current scored parquet is empty; refusing to publish an empty scoring snapshot")

    if remote_scored and remote_scored.exists():
        previous_count = con.execute(
            "select count(*) from read_parquet(?)",
            [str(remote_scored)],
        ).fetchone()[0]
        union_sql = f"""
            select *, 0 as _source_order from read_parquet('{str(remote_scored).replace("'", "''")}')
            union all by name
            select *, 1 as _source_order from read_parquet('{str(CURRENT_SCORED).replace("'", "''")}')
        """
    else:
        previous_count = 0
        union_sql = f"""
            select *, 1 as _source_order from read_parquet('{str(CURRENT_SCORED).replace("'", "''")}')
        """

    columns = con.execute(
        "describe select * from read_parquet(?)",
        [str(CURRENT_SCORED)],
    ).fetchdf()["column_name"].tolist()
    if "id_contrato" not in columns:
        sys.exit("Merged scored parquet does not contain id_contrato")

    before = previous_count + current_count
    con.execute(
        f"""
        copy (
            with combined as ({union_sql}),
            ranked as (
                select
                    * exclude (_source_order),
                    row_number() over (
                        partition by id_contrato
                        order by _source_order desc
                    ) as _rn
                from combined
            )
            select * exclude (_rn)
            from ranked
            where _rn = 1
        )
        to '{str(MERGED_TMP).replace("'", "''")}'
        (format parquet)
        """
    )
    MERGED_TMP.replace(CURRENT_SCORED)
    final_count = con.execute(
        "select count(*) from read_parquet(?)",
        [str(CURRENT_SCORED)],
    ).fetchone()[0]

    print(
        "Merged scored contracts: "
        f"previous={previous_count:,} current={current_count:,} "
        f"combined_before_dedupe={before:,} final={final_count:,}"
    )


if __name__ == "__main__":
    main()
