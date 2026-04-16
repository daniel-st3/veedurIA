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
import re
import sys
import unicodedata
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
    canonical = {
        "AMAZONAS": "AMAZONAS",
        "ANTIOQUIA": "ANTIOQUIA",
        "ARAUCA": "ARAUCA",
        "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
        "ATLANTICO": "ATLANTICO",
        "BOLIVAR": "BOLIVAR",
        "BOYACA": "BOYACA",
        "CALDAS": "CALDAS",
        "CAQUETA": "CAQUETA",
        "CASANARE": "CASANARE",
        "CAUCA": "CAUCA",
        "CESAR": "CESAR",
        "CHOCO": "CHOCO",
        "CORDOBA": "CORDOBA",
        "CUNDINAMARCA": "CUNDINAMARCA",
        "GUAINIA": "GUAINIA",
        "GUAVIARE": "GUAVIARE",
        "HUILA": "HUILA",
        "LA GUAJIRA": "LA GUAJIRA",
        "MAGDALENA": "MAGDALENA",
        "META": "META",
        "NARINO": "NARIÑO",
        "NORTE DE SANTANDER": "NORTE DE SANTANDER",
        "PUTUMAYO": "PUTUMAYO",
        "QUINDIO": "QUINDIO",
        "RISARALDA": "RISARALDA",
        "SANTAFE DE BOGOTA D C": "SANTAFE DE BOGOTA D.C",
        "SANTANDER": "SANTANDER",
        "SUCRE": "SUCRE",
        "TOLIMA": "TOLIMA",
        "VALLE DEL CAUCA": "VALLE DEL CAUCA",
        "VAUPES": "VAUPES",
        "VICHADA": "VICHADA",
    }
    aliases = {
        "BOGOTA": "SANTAFE DE BOGOTA D C",
        "BOGOTA D C": "SANTAFE DE BOGOTA D C",
        "BOGOTA D.C": "SANTAFE DE BOGOTA D C",
        "DISTRITO CAPITAL DE BOGOTA": "SANTAFE DE BOGOTA D C",
        "SAN ANDRES": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
        "SAN ANDRES PROVIDENCIA Y SANTA CATALINA": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
        "SAN ANDRES, PROVIDENCIA Y SANTA CATALINA": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
    }

    normalized = unicodedata.normalize("NFD", str(dept or ""))
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    normalized = re.sub(r"[.,]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip().upper()
    normalized = aliases.get(normalized, normalized)
    return canonical.get(normalized, normalized)


def _format_cop(value: float) -> str:
    if value >= 1_000_000_000:
        return f"${value / 1_000_000_000:.1f}B"
    if value >= 1_000_000:
        return f"${value / 1_000_000:.0f}M"
    return f"${value / 1_000:.0f}K"


def _compute_lead_case_signals(row: pd.Series, risk_label: str) -> dict:
    """Derive pickReason, signal, and factors from available contract fields."""
    is_direct = bool(row.get("is_direct_award", False))
    single_b = bool(row.get("single_bidder", False))
    risk_score = float(row.get("risk_score", 0))
    modality = str(row.get("modalidad_de_contratacion", "")).lower()

    # pickReason: short band label
    if risk_label == "risk_rojo":
        pick_reason = "Alerta preventiva alta"
    else:
        pick_reason = "Patrón atípico moderado"

    # signal: 1-line summary of the most salient trait
    signals = []
    if is_direct or "directa" in modality or "direct" in modality:
        signals.append("Contratación directa")
    if single_b:
        signals.append("Oferente único")
    if not signals:
        signals.append("Anomalía estadística global")

    signal = " · ".join(signals)

    # factors: up to 3 heuristic contributions
    factors: list[dict] = []
    if is_direct or "directa" in modality:
        factors.append({
            "key": "direct_award",
            "label": "Modalidad de contratación directa",
            "severity": round(min(1.0, 0.55 + risk_score * 0.35), 3),
        })
    if single_b:
        factors.append({
            "key": "single_bidder",
            "label": "Único oferente habilitado",
            "severity": round(min(1.0, 0.50 + risk_score * 0.30), 3),
        })
    if risk_score >= 0.7:
        factors.append({
            "key": "anomaly_global",
            "label": "Desvío global por encima del umbral de riesgo alto",
            "severity": round(min(1.0, risk_score), 3),
        })
    elif risk_score >= 0.4:
        factors.append({
            "key": "anomaly_moderate",
            "label": "Desvío moderado respecto al patrón típico del corte",
            "severity": round(min(1.0, risk_score), 3),
        })

    return {"pickReason": pick_reason, "signal": signal, "factors": factors[:3]}


def _pad_departments(departments: list[dict]) -> list[dict]:
    """Ensure all 33 canonical GeoJSON departments appear, even those with 0 flagged contracts."""
    ALL_GEO_NAMES = [
        "AMAZONAS", "ANTIOQUIA", "ARAUCA",
        "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
        "ATLANTICO", "BOLIVAR", "BOYACA", "CALDAS", "CAQUETA", "CASANARE",
        "CAUCA", "CESAR", "CHOCO", "CORDOBA", "CUNDINAMARCA", "GUAINIA",
        "GUAVIARE", "HUILA", "LA GUAJIRA", "MAGDALENA", "META", "NARIÑO",
        "NORTE DE SANTANDER", "PUTUMAYO", "QUINDIO", "RISARALDA",
        "SANTAFE DE BOGOTA D.C", "SANTANDER", "SUCRE", "TOLIMA",
        "VALLE DEL CAUCA", "VAUPES", "VICHADA",
    ]
    existing = {d["geoName"] for d in departments}
    for geo in ALL_GEO_NAMES:
        if geo not in existing:
            departments.append({
                "key": geo,
                "label": geo.title(),
                "geoName": geo,
                "avgRisk": 0.0,
                "contractCount": 0,
            })
    return departments


def compute_global_stats(df_flagged: pd.DataFrame, df_all: pd.DataFrame | None = None) -> dict:
    """Compute all stats needed by the overview API route.

    df_flagged — red+yellow contracts only (used for lead cases, risk stats).
    df_all     — full dataset (used for department map stats so every region shows).
    """
    df = df_flagged.copy()
    df["value_num"] = pd.to_numeric(df["valor_del_contrato"], errors="coerce").fillna(0)

    # Use the full dataset for department stats so departments with only low-risk
    # contracts still appear on the map (instead of showing 0 contracts).
    df_for_depts = df_all.copy() if df_all is not None else df
    df_for_depts["value_num"] = pd.to_numeric(df_for_depts["valor_del_contrato"], errors="coerce").fillna(0)

    red = df[df["risk_label"] == "risk_rojo"]
    yellow = df[df["risk_label"] == "risk_amarillo"]

    latest_ts = df["fecha_firma"].max()
    latest_date = latest_ts.strftime("%Y-%m-%d") if pd.notna(latest_ts) else None

    # Department stats — computed from ALL contracts, not just flagged
    dept_grp = (
        df_for_depts.groupby("departamento")
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
    departments = _pad_departments(departments)

    # Top 48 lead cases
    top = df.nlargest(48, "risk_score")
    lead_cases = []
    for _, r in top.iterrows():
        signals = _compute_lead_case_signals(r, str(r.get("risk_label", "")))
        lead_cases.append({
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
            "pickReason": signals["pickReason"],
            "signal": signals["signal"],
            "factors": signals["factors"],
        })

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
    print(f"  Total contracts: {len(df):,}")

    # Keep only red + yellow for the contracts table; full df feeds dept map stats
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
    # Drop duplicate IDs — keep highest risk_score per contract
    flagged = flagged.sort_values("risk_score", ascending=False).drop_duplicates(subset=["id_contrato"])

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

    # Compute + store global stats (dept map uses full df so all 33 regions show)
    print("Computing global stats …")
    stats = compute_global_stats(flagged, df_all=df)
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
