"""
VeedurIA — Import scored contracts (red + yellow) to Supabase Postgres.

Usage
-----
  python scripts/import_contracts_to_postgres.py [--full]

Without --full (default): only upserts contracts that appeared since the
last Postgres sync (reads last_pg_sync from last_run.json).

With --full: re-imports all red+yellow contracts (use for initial load or
after a model retrain that changes scores).

Environment
-----------
  SUPABASE_URL         — e.g. https://xxx.supabase.co
  SUPABASE_KEY         — anon key (RLS is disabled on these tables)

Both vars are read from the .env file in the project root automatically
if python-dotenv is available, or set them as real env vars.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys
from datetime import datetime, timezone
from typing import Any

import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "processed"
LAST_RUN_PATH = DATA / "last_run.json"

# ── load .env automatically if present ───────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    pass

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY", "")

SLIM_COLS = [
    "id_contrato", "nombre_entidad", "nit_entidad", "proveedor_adjudicado",
    "departamento", "modalidad_de_contratacion", "fecha_firma",
    "valor_del_contrato", "risk_score", "risk_label", "urlproceso",
    "sector", "is_direct_award", "single_bidder", "objeto_del_contrato",
]

BATCH = 500


# ── helpers ───────────────────────────────────────────────────────────────────

def _extract_url(raw: Any) -> str:
    if isinstance(raw, dict):
        return str(raw.get("url") or "")
    return str(raw or "")


def _load_last_run() -> dict:
    if LAST_RUN_PATH.exists():
        return json.loads(LAST_RUN_PATH.read_text())
    return {}


def _save_last_run(state: dict) -> None:
    LAST_RUN_PATH.write_text(json.dumps(state, indent=2, default=str))


def _find_parquet() -> pathlib.Path:
    scored = DATA / "scored_contracts.parquet"
    if scored.exists():
        return scored
    files = sorted(DATA.glob("secop_contratos_*.parquet"))
    if files:
        return files[-1]
    sys.exit("No scored parquet found in data/processed/")


# ── stats computation ─────────────────────────────────────────────────────────

def _dept_geo_name(dept: str) -> str:
    mapping = {
        "BOGOTA": "SANTAFE DE BOGOTA D.C",
        "BOGOTÁ": "SANTAFE DE BOGOTA D.C",
        "BOGOTA D.C.": "SANTAFE DE BOGOTA D.C",
        "BOGOTÁ D.C.": "SANTAFE DE BOGOTA D.C",
        "SAN ANDRES": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
    }
    upper = dept.strip().upper()
    return mapping.get(upper, upper)


def _format_cop(value: float) -> str:
    if value >= 1_000_000_000:
        return f"${value / 1_000_000_000:.1f}B"
    if value >= 1_000_000:
        return f"${value / 1_000_000:.0f}M"
    return f"${value / 1_000:.0f}K"


def compute_global_stats(df: pd.DataFrame) -> dict:
    """Compute all stats needed by the overview API route."""
    df = df.copy()
    df["value_num"] = pd.to_numeric(df["valor_del_contrato"], errors="coerce").fillna(0)

    red = df[df["risk_label"] == "risk_rojo"]
    yellow = df[df["risk_label"] == "risk_amarillo"]

    latest_ts = df["fecha_firma"].max()
    latest_date = latest_ts.strftime("%Y-%m-%d") if pd.notna(latest_ts) else None

    # Department stats
    dept_grp = (
        df.groupby("departamento")
        .agg(contract_count=("risk_score", "size"), avg_risk=("risk_score", "mean"))
        .reset_index()
    )
    departments = [
        {
            "key": row["departamento"],
            "label": row["departamento"].title(),
            "geoName": _dept_geo_name(row["departamento"]),
            "avgRisk": round(float(row["avg_risk"]), 4),
            "contractCount": int(row["contract_count"]),
        }
        for _, row in dept_grp.iterrows()
    ]

    # Top 48 lead cases
    top = df.nlargest(48, "risk_score")
    lead_cases = [
        {
            "id": str(r["id_contrato"]),
            "score": int(round(float(r["risk_score"]) * 100)),
            "riskBand": "high" if r["risk_label"] == "risk_rojo" else "medium",
            "entity": str(r["nombre_entidad"] or ""),
            "provider": str(r["proveedor_adjudicado"] or ""),
            "department": str(r["departamento"] or ""),
            "modality": str(r["modalidad_de_contratacion"] or ""),
            "date": r["fecha_firma"].strftime("%Y-%m-%d") if pd.notna(r["fecha_firma"]) else "",
            "value": int(pd.to_numeric(r["valor_del_contrato"], errors="coerce") or 0),
            "valueLabel": _format_cop(float(pd.to_numeric(r["valor_del_contrato"], errors="coerce") or 0)),
            "secopUrl": _extract_url(r["urlproceso"]),
            "pickReason": "",
            "signal": "",
            "factors": [],
        }
        for _, r in top.iterrows()
    ]

    # Top entities
    ent_grp = (
        df.groupby("nombre_entidad")
        .agg(contracts=("risk_score", "size"), meanRisk=("risk_score", "mean"), maxRisk=("risk_score", "max"))
        .sort_values(["contracts", "meanRisk"], ascending=False)
        .head(24)
        .reset_index()
    )
    entities = [
        {
            "nombre_entidad": str(r["nombre_entidad"]),
            "contracts": int(r["contracts"]),
            "meanRisk": round(float(r["meanRisk"]), 4),
            "maxRisk": round(float(r["maxRisk"]), 4),
        }
        for _, r in ent_grp.iterrows()
    ]

    # Modality mix
    mod_grp = (
        df.groupby("modalidad_de_contratacion")
        .agg(contracts=("risk_score", "size"), meanRisk=("risk_score", "mean"))
        .sort_values("contracts", ascending=False)
        .head(12)
        .reset_index()
    )
    modalities = [
        {
            "modalidad_de_contratacion": str(r["modalidad_de_contratacion"]),
            "contracts": int(r["contracts"]),
            "meanRisk": round(float(r["meanRisk"]), 4),
        }
        for _, r in mod_grp.iterrows()
    ]

    # Monthly trend
    df["month"] = df["fecha_firma"].dt.strftime("%Y-%m")
    month_grp = (
        df.groupby("month")
        .agg(contracts=("risk_score", "size"), meanRisk=("risk_score", "mean"))
        .sort_values("month", ascending=False)
        .head(24)
        .reset_index()
    )
    months = [
        {"month": str(r["month"]), "contracts": int(r["contracts"]), "meanRisk": round(float(r["meanRisk"]), 4)}
        for _, r in month_grp.iterrows()
    ]

    # Distinct options
    dept_options = sorted(df["departamento"].dropna().unique().tolist())
    modality_options = sorted(df["modalidad_de_contratacion"].dropna().unique().tolist())

    # Risk bands
    risk_bands = [
        {"riskBand": "high", "contracts": len(red), "meanRisk": round(float(red["risk_score"].mean()), 4) if len(red) else 0},
        {"riskBand": "medium", "contracts": len(yellow), "meanRisk": round(float(yellow["risk_score"].mean()), 4) if len(yellow) else 0},
    ]

    mean_risk = float(df["risk_score"].mean())
    median_value = float(df["value_num"].median())
    dominant_dept = str(df["departamento"].mode().iloc[0]) if not df["departamento"].mode().empty else "Colombia"

    return {
        "totalRows": len(df),
        "redAlerts": len(red),
        "yellowAlerts": len(yellow),
        "meanRisk": round(mean_risk, 4),
        "medianValue": int(median_value),
        "dominantDepartment": dominant_dept,
        "latestDate": latest_date,
        "departments": departments,
        "leadCases": lead_cases,
        "entities": entities,
        "modalities": modalities,
        "months": months,
        "riskBands": risk_bands,
        "deptOptions": dept_options,
        "modalityOptions": modality_options,
    }


# ── main ─────────────────────────────────────────────────────────────────────

def main(full: bool = False) -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        sys.exit(
            "Missing SUPABASE_URL or SUPABASE_KEY.\n"
            "Add them to .env or set as environment variables."
        )

    try:
        from supabase import create_client
    except ImportError:
        sys.exit("supabase not installed. Run: pip install supabase")

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    parquet_path = _find_parquet()
    print(f"Reading {parquet_path.name} …")
    df = pd.read_parquet(str(parquet_path), columns=SLIM_COLS)

    # Keep only red + yellow
    flagged = df[df["risk_label"].isin(["risk_rojo", "risk_amarillo"])].copy()
    print(f"  Red+Yellow: {len(flagged):,} contracts")

    # Transform
    flagged["value_num"] = pd.to_numeric(flagged["valor_del_contrato"], errors="coerce").fillna(0).astype("int64")
    flagged["secop_url"] = flagged["urlproceso"].apply(_extract_url)
    flagged["date_str"] = flagged["fecha_firma"].dt.strftime("%Y-%m-%d")
    flagged["risk_bucket"] = flagged["risk_label"].map({"risk_rojo": "high", "risk_amarillo": "medium"})
    flagged["is_direct_award"] = flagged["is_direct_award"].fillna(0).astype(bool)
    flagged["single_bidder"] = flagged["single_bidder"].fillna(0).astype(bool)
    flagged["object_desc"] = flagged["objeto_del_contrato"].fillna("").str[:512]
    flagged = flagged[flagged["id_contrato"].notna() & (flagged["id_contrato"].astype(str) != "")]

    records = (
        flagged.rename(columns={
            "id_contrato": "id",
            "nombre_entidad": "entity",
            "nit_entidad": "nit_entity",
            "proveedor_adjudicado": "provider",
            "departamento": "department",
            "modalidad_de_contratacion": "modality",
            "date_str": "date",
            "value_num": "value",
            "secop_url": "secop_url",
            "sector": "sector",
            "object_desc": "object_desc",
        })[[
            "id", "entity", "nit_entity", "provider", "department", "modality",
            "date", "value", "risk_score", "risk_bucket", "secop_url",
            "sector", "is_direct_award", "single_bidder", "object_desc",
        ]]
        .to_dict(orient="records")
    )

    # Convert numpy types to native Python (supabase client needs JSON-serialisable values)
    clean = []
    for r in records:
        clean.append({
            k: (bool(v) if isinstance(v, (bool,)) else
                int(v) if hasattr(v, "item") and isinstance(v.item(), int) else
                float(v) if hasattr(v, "item") and isinstance(v.item(), float) else
                str(v) if v is not None else None)
            for k, v in r.items()
        })

    print(f"Upserting {len(clean):,} rows to Supabase …")
    done = 0
    for i in range(0, len(clean), BATCH):
        batch = clean[i: i + BATCH]
        client.table("contracts").upsert(batch, on_conflict="id").execute()
        done += len(batch)
        if done % 10_000 == 0 or done == len(clean):
            pct = done / len(clean) * 100
            print(f"  {done:,} / {len(clean):,}  ({pct:.0f}%)")

    # Compute + store global stats
    print("Computing global stats …")
    stats = compute_global_stats(flagged)
    client.table("contracts_stats").upsert(
        {"key": "global", "data": stats, "updated_at": datetime.now(timezone.utc).isoformat()},
        on_conflict="key",
    ).execute()
    print("  Stats stored.")

    # Persist sync timestamp
    state = _load_last_run()
    state["last_pg_sync"] = datetime.now(timezone.utc).isoformat()
    _save_last_run(state)

    print("Done ✓")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--full", action="store_true", help="Full re-import (default: incremental)")
    args = parser.parse_args()
    main(full=args.full)
