"""
Contracts API service for the Next.js VeedurIA frontend.

This module exposes a pure-Python read layer over the scored SECOP parquet so
the product shell can move out of Streamlit while the ML/data pipeline remains
in Python.
"""

from __future__ import annotations

import json
import math
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import quote

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import requests
from src.models.isolation_forest import RED_THRESHOLD, YELLOW_THRESHOLD
from src.models.shap_explainer import FEATURE_LABELS
from src.utils.logger import get_logger

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"
DATA_REFERENCE = PROJECT_ROOT / "data" / "reference"
DEFAULT_GEOJSON_PATH = DATA_REFERENCE / "colombia_departments.geojson"
LAST_RUN_PATH = DATA_PROCESSED / "last_run.json"
MODEL_META_DIR = DATA_PROCESSED / "models"
REMOTE_SCORED_CACHE_PATH = DATA_PROCESSED / "scored_contracts.remote.parquet"

SOCRATA_DOMAIN = "www.datos.gov.co"
SOCRATA_CONTRACTS_DATASET = "jbjy-vk9h"
SOCRATA_METADATA_URL = "https://www.datos.gov.co/api/views/metadata/v1/jbjy-vk9h"

SECOP_TO_GEOJSON: dict[str, str] = {
    "BOGOTA": "SANTAFE DE BOGOTA D.C",
    "BOGOTA D.C.": "SANTAFE DE BOGOTA D.C",
    "BOGOTA, D.C.": "SANTAFE DE BOGOTA D.C",
    "BOGOTA D.C": "SANTAFE DE BOGOTA D.C",
    "SANTAFE DE BOGOTA": "SANTAFE DE BOGOTA D.C",
    "DISTRITO CAPITAL": "SANTAFE DE BOGOTA D.C",
    "DISTRITO CAPITAL DE BOGOTA": "SANTAFE DE BOGOTA D.C",
    "SAN ANDRES": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
    "SAN ANDRES Y PROVIDENCIA": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
    "SAN ANDRES, PROVIDENCIA Y SANTA CATALINA": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
    "NARINO": "NARIÑO",
    "GUAJIRA": "LA GUAJIRA",
    "NORTE SANTANDER": "NORTE DE SANTANDER",
}

RISK_LABELS = {
    "es": {
        "high": "Alto",
        "medium": "Medio",
        "low": "Bajo",
        "pick_start": "Empieza aquí",
        "pick_value": "Riesgo alto + monto relevante",
        "pick_recent": "Caso reciente",
        "pick_signal": "Señal fuerte del modelo",
        "signal_fallback": "Se sale del patrón histórico",
        "unavailable": "No disponible",
    },
    "en": {
        "high": "High",
        "medium": "Medium",
        "low": "Low",
        "pick_start": "Start here",
        "pick_value": "High risk + relevant value",
        "pick_recent": "Recent case",
        "pick_signal": "Strong model signal",
        "signal_fallback": "Breaks the historical pattern",
        "unavailable": "Not available",
    },
}

FEATURE_RULES: list[dict[str, Any]] = [
    {"col": "single_bidder", "mode": "bool", "feature": "single_bidder"},
    {"col": "is_direct_award", "mode": "bool", "feature": "is_direct_award"},
    {"col": "advance_payment_ratio", "mode": "high", "feature": "advance_payment_ratio"},
    {"col": "price_ratio_vs_entity_median", "mode": "high", "feature": "price_ratio_vs_entity_median"},
    {"col": "price_ratio_vs_unspsc_median", "mode": "high", "feature": "price_ratio_vs_unspsc_median"},
    {"col": "provider_value_share_entity", "mode": "high", "feature": "provider_value_share_entity"},
    {"col": "provider_contract_count_entity", "mode": "high", "feature": "provider_contract_count_entity"},
    {"col": "provider_age_months", "mode": "low", "feature": "provider_age_months"},
    {"col": "normalized_ofertantes", "mode": "low", "feature": "normalized_ofertantes"},
    {"col": "repeat_provider_flag", "mode": "bool", "feature": "repeat_provider_flag"},
    {"col": "electoral_window", "mode": "bool", "feature": "electoral_window"},
    {"col": "ley_garantias_period", "mode": "bool", "feature": "ley_garantias_period"},
    {"col": "fiscal_year_end_rush", "mode": "bool", "feature": "fiscal_year_end_rush"},
    {"col": "value_vs_additions_ratio", "mode": "high", "feature": "value_vs_additions_ratio"},
]

BOOL_FEATURE_BASES = {
    "single_bidder": 0.9,
    "is_direct_award": 0.82,
    "repeat_provider_flag": 0.76,
    "electoral_window": 0.88,
    "ley_garantias_period": 0.96,
    "fiscal_year_end_rush": 0.7,
}

logger = get_logger(__name__)

MODALITY_FAMILY_RULES: list[tuple[tuple[str, ...], str]] = [
    (("directa",), "Contratación directa"),
    (("abreviada", "subasta inversa", "menor cuantia", "menor cuantía"), "Selección abreviada"),
    (("licitacion", "licitación"), "Licitación pública"),
    (("meritos", "méritos", "merito", "mérito"), "Concurso de méritos"),
    (("minima", "mínima"), "Mínima cuantía"),
    (("regimen especial", "régimen especial"), "Régimen especial"),
]


def _strip_accents(value: str) -> str:
    out: list[str] = []
    for char in unicodedata.normalize("NFD", value):
        if unicodedata.category(char) == "Mn":
            if char == "\u0303":
                out.append(char)
        else:
            out.append(char)
    return unicodedata.normalize("NFC", "".join(out))


def normalize_department_name(name: str) -> str:
    if not isinstance(name, str) or not name.strip():
        return ""
    normalized = _strip_accents(name.strip().upper())
    return SECOP_TO_GEOJSON.get(normalized, normalized)


def normalize_modality_family(name: str) -> str:
    if not isinstance(name, str) or not name.strip():
        return "Sin modalidad"

    normalized = _strip_accents(name.strip().lower())
    for patterns, label in MODALITY_FAMILY_RULES:
        if any(pattern in normalized for pattern in patterns):
            return label

    return name.strip().title()


def _resolve_parquet_path() -> Path:
    remote = _resolve_remote_scored_cache()
    if remote and remote.exists():
        return remote
    scored = DATA_PROCESSED / "scored_contracts.parquet"
    if scored.exists():
        return scored
    files = sorted(DATA_PROCESSED.glob("secop_contratos_*.parquet"))
    if files:
        return files[-1]
    raise FileNotFoundError("No scored contracts parquet found")


def _download_remote_scored(remote_path: str) -> Path | None:
    try:
        from supabase import create_client

        from src.utils.config import get_supabase_key, get_supabase_storage_bucket, get_supabase_url

        supabase = create_client(get_supabase_url(), get_supabase_key())
        bucket = get_supabase_storage_bucket()
        payload = supabase.storage.from_(bucket).download(remote_path)
        if not payload:
            return None
        tmp_path = REMOTE_SCORED_CACHE_PATH.with_suffix(".tmp")
        tmp_path.write_bytes(payload)
        tmp_path.replace(REMOTE_SCORED_CACHE_PATH)
        logger.info("Downloaded remote scored parquet from Supabase: %s", remote_path)
        return REMOTE_SCORED_CACHE_PATH
    except Exception as exc:
        logger.warning("Could not download remote scored parquet '%s': %s", remote_path, exc)
        return None


def _resolve_remote_scored_cache() -> Path | None:
    state = load_last_run()
    remote_path = str(state.get("scored_remote_path") or "").strip()
    if not remote_path:
        return None

    uploaded_at = pd.to_datetime(
        state.get("scored_uploaded_at") or state.get("last_run_ts"),
        errors="coerce",
        utc=True,
    )
    needs_refresh = not REMOTE_SCORED_CACHE_PATH.exists()
    if not needs_refresh and pd.notna(uploaded_at):
        cache_mtime = pd.Timestamp(REMOTE_SCORED_CACHE_PATH.stat().st_mtime, unit="s", tz="UTC")
        needs_refresh = cache_mtime < uploaded_at

    if needs_refresh:
        downloaded = _download_remote_scored(remote_path)
        if downloaded:
            return downloaded

    if REMOTE_SCORED_CACHE_PATH.exists():
        return REMOTE_SCORED_CACHE_PATH
    return None


def _schema_names(path: Path) -> set[str]:
    return {field.name for field in pq.read_schema(str(path))}


def _read_tail(path: Path, columns: list[str], nrows: int) -> pd.DataFrame:
    parquet = pq.ParquetFile(str(path))
    total = parquet.metadata.num_rows
    if total <= nrows:
        return parquet.read(columns=columns).to_pandas()
    batches: list[pa.Table] = []
    collected = 0
    for idx in range(parquet.metadata.num_row_groups - 1, -1, -1):
        row_count = parquet.metadata.row_group(idx).num_rows
        batches.append(parquet.read_row_group(idx, columns=columns))
        collected += row_count
        if collected >= nrows:
            break
    batches.reverse()
    df = pa.concat_tables(batches).to_pandas()
    if len(df) > nrows:
        df = df.iloc[-nrows:].reset_index(drop=True)
    return df


def _parse_cop(raw: Any) -> float:
    if raw is None:
        return 0.0
    if isinstance(raw, (int, float)):
        return float(raw) if pd.notna(raw) else 0.0
    value = str(raw).strip()
    if not value or value.lower() in {"nan", "none", "null"}:
        return 0.0
    cleaned = (
        value.replace("$", "")
        .replace("COP", "")
        .replace(" ", "")
        .replace(",", "")
    )
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _format_cop(value: float, lang: str) -> str:
    if value <= 0:
        return RISK_LABELS[lang]["unavailable"]
    if value >= 1e12:
        return f"${value / 1e12:,.2f}B COP"
    if value >= 1e9:
        return f"${value / 1e9:,.2f}MM COP"
    if value >= 1e6:
        return f"${value / 1e6:,.1f}M COP"
    return f"${value:,.0f} COP"


def _risk_bucket(score: float) -> str:
    if score >= RED_THRESHOLD:
        return "high"
    if score >= YELLOW_THRESHOLD:
        return "medium"
    return "low"


def _extract_url(raw: Any) -> str:
    if isinstance(raw, dict):
        return str(raw.get("url") or "")
    if hasattr(raw, "get"):
        return str(raw.get("url") or "")
    if isinstance(raw, str):
        return raw
    return ""


def _extract_live_contract_url(row: dict[str, Any]) -> str:
    return _extract_url(row.get("urlproceso"))


def _iso_date(raw: Any) -> str:
    dt = pd.to_datetime(raw, errors="coerce", utc=True)
    if pd.isna(dt):
        return ""
    return dt.strftime("%Y-%m-%d")


def _safe_ts(raw: Any) -> pd.Timestamp:
    dt = pd.to_datetime(raw, errors="coerce", utc=True)
    if pd.isna(dt):
        return pd.Timestamp("1970-01-01", tz="UTC")
    return dt


def _compute_source_gap_days(scored_latest: str | None, source_latest: str | None) -> int | None:
    if not scored_latest or not source_latest:
        return None
    scored_ts = pd.to_datetime(scored_latest, errors="coerce", utc=True)
    source_ts = pd.to_datetime(source_latest, errors="coerce", utc=True)
    if pd.isna(scored_ts) or pd.isna(source_ts):
        return None
    return max(0, int((source_ts - scored_ts).days))


@lru_cache(maxsize=1)
def load_live_source_snapshot() -> dict[str, Any]:
    try:
        summary_url = (
            f"https://{SOCRATA_DOMAIN}/resource/{SOCRATA_CONTRACTS_DATASET}.json"
            f"?$select={quote('max(fecha_de_firma) as max_fecha, count(*) as total')}"
            "&$limit=1"
        )
        max_rows = requests.get(summary_url, timeout=8).json()

        latest_date = max_rows[0].get("max_fecha") if max_rows else None
        rows_at_source = int(max_rows[0].get("total", 0)) if max_rows else None
        latest_contracts: list[dict[str, Any]] = []
        if latest_date:
            where_clause = quote(f"fecha_de_firma = '{latest_date}'")
            latest_rows_url = (
                f"https://{SOCRATA_DOMAIN}/resource/{SOCRATA_CONTRACTS_DATASET}.json"
                f"?$select={quote('fecha_de_firma,id_contrato,nombre_entidad,valor_del_contrato,departamento,urlproceso')}"
                f"&$where={where_clause}"
                "&$order=id_contrato ASC"
                "&$limit=5"
            )
            raw_rows = requests.get(latest_rows_url, timeout=4).json()
            for row in raw_rows:
                value = _parse_cop(row.get("valor_del_contrato"))
                latest_contracts.append(
                    {
                        "id": str(row.get("id_contrato") or ""),
                        "entity": str(row.get("nombre_entidad") or ""),
                        "department": str(row.get("departamento") or ""),
                        "date": _iso_date(row.get("fecha_de_firma")),
                        "value": value,
                        "valueLabel": _format_cop(value, "es"),
                        "secopUrl": _extract_live_contract_url(row),
                    }
                )
        return {
            "latestDate": _iso_date(latest_date),
            "rowsAtSource": rows_at_source,
            "contracts": latest_contracts,
        }
    except Exception:
        # Fall back to the last ingestion count so the UI always shows a real number
        fallback_rows = load_last_run().get("rows_fetched") or None
        return {"latestDate": None, "rowsAtSource": fallback_rows, "contracts": []}


@lru_cache(maxsize=1)
def load_live_source_metadata() -> dict[str, Any]:
    try:
        payload = requests.get(SOCRATA_METADATA_URL, timeout=4).json()
    except Exception:
        return {"sourceUpdatedAt": None, "sourceWebUri": None}

    return {
        "sourceUpdatedAt": payload.get("dataUpdatedAt"),
        "sourceWebUri": payload.get("webUri"),
    }


def _resolve_columns(schema: set[str]) -> list[str]:
    preferred = [
        "id_contrato",
        "referencia_del_contrato",
        "nombre_entidad",
        "proveedor_adjudicado",
        "departamento",
        "modalidad_de_contratacion",
        "fecha_firma",
        "valor_contrato",
        "valor_del_contrato",
        "risk_score",
        "risk_label",
        "secop_url",
        "urlproceso",
        "single_bidder",
        "is_direct_award",
        "advance_payment_ratio",
        "price_ratio_vs_entity_median",
        "price_ratio_vs_unspsc_median",
        "provider_value_share_entity",
        "provider_contract_count_entity",
        "provider_age_months",
        "normalized_ofertantes",
        "repeat_provider_flag",
        "electoral_window",
        "ley_garantias_period",
        "fiscal_year_end_rush",
        "value_vs_additions_ratio",
    ]
    return [column for column in preferred if column in schema]


def _normalize_frame(df: pd.DataFrame) -> pd.DataFrame:
    frame = df.copy()
    if "valor_contrato" not in frame.columns and "valor_del_contrato" in frame.columns:
        frame["valor_contrato"] = frame["valor_del_contrato"]
    if "secop_url" not in frame.columns and "urlproceso" in frame.columns:
        frame["secop_url"] = frame["urlproceso"].apply(_extract_url)
    frame["contract_id"] = frame.get("id_contrato", frame.get("referencia_del_contrato", pd.Series(range(len(frame)))))
    frame["valor_num"] = frame.get("valor_contrato", 0).apply(_parse_cop)
    frame["fecha_ts"] = frame.get("fecha_firma", "").apply(_safe_ts)
    frame["fecha_label"] = frame.get("fecha_firma", "").apply(_iso_date)
    frame["departamento"] = frame.get("departamento", "").fillna("").astype(str)
    frame["departamento_geo"] = frame["departamento"].apply(normalize_department_name)
    frame["risk_score"] = pd.to_numeric(frame.get("risk_score", 0), errors="coerce").fillna(0.0)
    frame["risk_bucket"] = frame["risk_score"].apply(_risk_bucket)
    frame["secop_url"] = frame.get("secop_url", "").fillna("").astype(str)
    frame["nombre_entidad"] = frame.get("nombre_entidad", "").fillna("").astype(str)
    frame["proveedor_adjudicado"] = frame.get("proveedor_adjudicado", "").fillna("").astype(str)
    frame["modalidad_de_contratacion"] = frame.get("modalidad_de_contratacion", "").fillna("").astype(str)
    frame["modalidad_family"] = frame["modalidad_de_contratacion"].apply(normalize_modality_family)
    return frame


@lru_cache(maxsize=4)
def load_contracts(full: bool) -> pd.DataFrame:
    path = _resolve_parquet_path()
    schema = _schema_names(path)
    columns = _resolve_columns(schema)
    df = pd.read_parquet(path, columns=columns)
    frame = _normalize_frame(df)
    # The API should always use the full cached dataset to ensure national 
    # aggregations (like the map and summaries) are accurate, avoiding 0s.
    return frame


@lru_cache(maxsize=1)
def get_scored_latest_contract_date() -> str | None:
    path = _resolve_parquet_path()
    schema = _schema_names(path)
    if "fecha_firma" not in schema:
        return None
    df = pd.read_parquet(path, columns=["fecha_firma"])
    series = pd.to_datetime(df["fecha_firma"], errors="coerce", utc=True)
    if series.notna().sum() == 0:
        return None
    return series.max().strftime("%Y-%m-%d")


@lru_cache(maxsize=1)
def get_total_row_count() -> int:
    path = _resolve_parquet_path()
    return pq.ParquetFile(str(path)).metadata.num_rows


@lru_cache(maxsize=1)
def load_geojson() -> dict[str, Any]:
    with open(DEFAULT_GEOJSON_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


@lru_cache(maxsize=1)
def load_model_metadata() -> dict[str, Any]:
    files = sorted(MODEL_META_DIR.glob("*_metadata.json"))
    if not files:
        return {}
    with open(files[-1], "r", encoding="utf-8") as handle:
        return json.load(handle)


@lru_cache(maxsize=1)
def load_last_run() -> dict[str, Any]:
    if not LAST_RUN_PATH.exists():
        return {}
    with open(LAST_RUN_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def _filter_frame(
    df: pd.DataFrame,
    *,
    department: str | None = None,
    risk: str | None = None,
    modality: str | None = None,
    query: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> pd.DataFrame:
    frame = df
    if department:
        frame = frame[frame["departamento_geo"] == department]
    if risk and risk != "all":
        frame = frame[frame["risk_bucket"] == risk]
    if modality:
        frame = frame[frame["modalidad_de_contratacion"] == modality]
    if query:
        mask = frame["nombre_entidad"].str.contains(query, case=False, na=False)
        mask |= frame["proveedor_adjudicado"].str.contains(query, case=False, na=False)
        frame = frame[mask]
    if date_from:
        start = pd.to_datetime(date_from, errors="coerce", utc=True)
        if not pd.isna(start):
            frame = frame[frame["fecha_ts"] >= start]
    if date_to:
        end = pd.to_datetime(date_to, errors="coerce", utc=True)
        if not pd.isna(end):
            frame = frame[frame["fecha_ts"] <= end + pd.Timedelta(days=1) - pd.Timedelta(seconds=1)]
    return frame


def _latest_date_from_frame(df: pd.DataFrame) -> str | None:
    if df.empty or "fecha_ts" not in df.columns:
        return None
    series = df["fecha_ts"]
    if series.notna().sum() == 0:
        return None
    return series.max().strftime("%Y-%m-%d")


def _build_department_summary(df: pd.DataFrame) -> list[dict[str, Any]]:
    if df.empty:
        return []
    grouped = (
        df[df["departamento_geo"] != ""]
        .groupby(["departamento_geo", "departamento"])
        .agg(avg_risk=("risk_score", "mean"), contract_count=("risk_score", "size"))
        .reset_index()
        .sort_values(["avg_risk", "contract_count"], ascending=[False, False])
    )
    best_labels = (
        grouped.groupby("departamento_geo")["departamento"]
        .agg(lambda values: values.mode().iloc[0] if not values.mode().empty else values.iloc[0])
        .to_dict()
    )
    collapsed = (
        grouped.groupby("departamento_geo")
        .agg(avg_risk=("avg_risk", "max"), contract_count=("contract_count", "sum"))
        .reset_index()
    )
    result = [
        {
            "key": row["departamento_geo"],
            "label": best_labels.get(row["departamento_geo"], row["departamento_geo"]).title(),
            "geoName": row["departamento_geo"],
            "avgRisk": round(float(row["avg_risk"]), 4),
            "contractCount": int(row["contract_count"]),
        }
        for _, row in collapsed.iterrows()
    ]
    # Pad missing GeoJSON departments so the map paints all 33 regions
    geojson = load_geojson()
    all_geo_names = {
        feat["properties"]["NOMBRE_DPT"]
        for feat in geojson.get("features", [])
        if "NOMBRE_DPT" in feat.get("properties", {})
    }
    existing_keys = {r["geoName"] for r in result}
    for geo_name in sorted(all_geo_names - existing_keys):
        result.append({
            "key": geo_name,
            "label": geo_name.title(),
            "geoName": geo_name,
            "avgRisk": 0.0,
            "contractCount": 0,
        })
    return sorted(result, key=lambda item: (-item["contractCount"], -item["avgRisk"], item["label"]))


def _slice_stats(df: pd.DataFrame, lang: str) -> dict[str, Any]:
    red = df[df["risk_score"] >= RED_THRESHOLD]
    dominant = (
        df["departamento"].mode().iloc[0]
        if "departamento" in df.columns and not df["departamento"].mode().empty
        else "Colombia"
    )
    return {
        "totalContracts": int(len(df)),
        "redAlerts": int(len(red)),
        "prioritizedValue": float(red["valor_num"].sum()) if not red.empty else 0.0,
        "prioritizedValueLabel": _format_cop(float(red["valor_num"].sum()) if not red.empty else 0.0, lang),
        "dominantDepartment": dominant,
    }


def _decorate_priority(df: pd.DataFrame) -> pd.DataFrame:
    frame = df.copy()
    frame["_value_rank"] = frame["valor_num"].rank(pct=True, method="max") if frame["valor_num"].max() > 0 else 0.0
    frame["_recent_rank"] = frame["fecha_ts"].rank(pct=True, method="max")
    frame["_priority"] = (
        frame["risk_score"] * 0.56
        + frame["_recent_rank"] * 0.27
        + frame["_value_rank"] * 0.17
    )
    return frame


def _quantiles(df: pd.DataFrame) -> dict[str, tuple[float, float]]:
    stats: dict[str, tuple[float, float]] = {}
    for rule in FEATURE_RULES:
        column = rule["col"]
        if column not in df.columns:
            continue
        series = pd.to_numeric(df[column], errors="coerce").dropna()
        if series.empty:
            continue
        stats[column] = (float(series.quantile(0.10)), float(series.quantile(0.90)))
    return stats


def _build_factors(row: pd.Series, stats: dict[str, tuple[float, float]], lang: str) -> list[dict[str, Any]]:
    factors: list[dict[str, Any]] = []
    label_key = f"label_{lang}"
    for rule in FEATURE_RULES:
        column = rule["col"]
        if column not in row or pd.isna(row[column]):
            continue
        value = float(row[column])
        q10, q90 = stats.get(column, (math.nan, math.nan))
        severity = 0.0
        if rule["mode"] == "bool":
            severity = BOOL_FEATURE_BASES.get(rule["feature"], 0.78) if value >= 1 else 0.0
        elif rule["mode"] == "high" and not math.isnan(q90) and q90 > 0 and value >= q90:
            severity = min(1.0, 0.52 + ((value - q90) / max(abs(q90), 1e-6)) * 0.38)
        elif rule["mode"] == "low" and not math.isnan(q10) and value <= q10:
            baseline = max(abs(q10), 0.01)
            severity = min(1.0, 0.52 + ((q10 - value) / baseline) * 0.38)
        if severity <= 0:
            continue
        labels = FEATURE_LABELS.get(rule["feature"], {})
        factors.append(
            {
                "key": rule["feature"],
                "label": labels.get(label_key, labels.get("label_es", rule["feature"])),
                "severity": round(float(severity), 3),
            }
        )
    factors.sort(key=lambda item: item["severity"], reverse=True)
    return factors[:4]


def _lead_cases(df: pd.DataFrame, lang: str, limit: int) -> list[dict[str, Any]]:
    if df.empty:
        return []
    frame = _decorate_priority(df)
    top = frame.sort_values(
        ["_priority", "fecha_ts", "risk_score", "valor_num"],
        ascending=[False, False, False, False],
    ).head(limit)
    stats = _quantiles(frame)
    copy = RISK_LABELS[lang]
    value_median = float(top["valor_num"].median()) if not top.empty else 0.0
    recent_cut = top["fecha_ts"].quantile(0.7) if not top.empty else pd.Timestamp("1970-01-01", tz="UTC")
    cases: list[dict[str, Any]] = []
    for index, (_, row) in enumerate(top.iterrows()):
        factors = _build_factors(row, stats, lang)
        signal = factors[0]["label"] if factors else copy["signal_fallback"]
        if index == 0:
            pick_reason = copy["pick_start"]
        elif row["risk_score"] >= RED_THRESHOLD and row["valor_num"] >= value_median and value_median > 0:
            pick_reason = copy["pick_value"]
        elif row["fecha_ts"] >= recent_cut:
            pick_reason = copy["pick_recent"]
        else:
            pick_reason = copy["pick_signal"]
        cases.append(
            {
                "id": str(row["contract_id"]),
                "score": int(round(float(row["risk_score"]) * 100)),
                "riskBand": row["risk_bucket"],
                "entity": row["nombre_entidad"],
                "provider": row["proveedor_adjudicado"] or copy["unavailable"],
                "department": row["departamento"],
                "modality": row["modalidad_de_contratacion"] or copy["unavailable"],
                "date": row["fecha_label"],
                "value": float(row["valor_num"]),
                "valueLabel": _format_cop(float(row["valor_num"]), lang),
                "secopUrl": row["secop_url"],
                "pickReason": pick_reason,
                "signal": signal,
                "factors": factors,
            }
        )
    return cases


def _entity_summary(df: pd.DataFrame, limit: int = 8) -> list[dict[str, Any]]:
    if df.empty:
        return []
    grouped = (
        df.groupby("nombre_entidad")
        .agg(contracts=("risk_score", "size"), meanRisk=("risk_score", "mean"), maxRisk=("risk_score", "max"))
        .sort_values(["contracts", "meanRisk", "maxRisk"], ascending=[False, False, False])
        .head(limit)
        .reset_index()
    )
    return grouped.to_dict(orient="records")


def _modality_summary(df: pd.DataFrame, limit: int = 8) -> list[dict[str, Any]]:
    if df.empty:
        return []
    grouped = (
        df.groupby("modalidad_family")
        .agg(contracts=("risk_score", "size"), meanRisk=("risk_score", "mean"))
        .sort_values(["contracts", "meanRisk"], ascending=[False, False])
        .head(limit)
        .reset_index()
    )
    grouped = grouped.rename(columns={"modalidad_family": "modalidad_de_contratacion"})
    return grouped.to_dict(orient="records")


def _monthly_summary(df: pd.DataFrame, limit: int = 18) -> list[dict[str, Any]]:
    if df.empty:
        return []

    frame = df.copy()
    frame["month"] = frame["fecha_label"].astype(str).str.slice(0, 7)
    frame = frame[frame["month"].str.match(r"^\d{4}-\d{2}$", na=False)]
    if frame.empty:
        return []

    grouped = (
        frame.groupby("month")
        .agg(contracts=("risk_score", "size"), meanRisk=("risk_score", "mean"))
        .reset_index()
        .sort_values("month")
    )
    if len(grouped) > limit:
        grouped = grouped.tail(limit)
    return grouped.to_dict(orient="records")


def _risk_band_summary(df: pd.DataFrame) -> list[dict[str, Any]]:
    if df.empty:
        return []

    grouped = (
        df.groupby("risk_bucket")
        .agg(contracts=("risk_score", "size"), meanRisk=("risk_score", "mean"))
        .reset_index()
    )
    order = {"high": 0, "medium": 1, "low": 2}
    grouped["risk_order"] = grouped["risk_bucket"].map(order).fillna(99)
    grouped = grouped.sort_values(["risk_order", "contracts"], ascending=[True, False])
    return [
        {
            "riskBand": row["risk_bucket"],
            "contracts": int(row["contracts"]),
            "meanRisk": round(float(row["meanRisk"]), 4),
        }
        for _, row in grouped.iterrows()
    ]


def _analytics_summary(df_slice: pd.DataFrame) -> dict[str, Any]:
    departments = _build_department_summary(df_slice)
    return {
        "departments": departments[:10],
        "modalities": _modality_summary(df_slice, limit=8),
        "entities": _entity_summary(df_slice, limit=8),
        "months": _monthly_summary(df_slice, limit=18),
        "riskBands": _risk_band_summary(df_slice),
    }


def _options(df: pd.DataFrame) -> dict[str, list[dict[str, str]]]:
    departments = (
        df[df["departamento_geo"] != ""]
        .groupby(["departamento_geo", "departamento"])
        .size()
        .reset_index(name="count")
        .sort_values(["count", "departamento"], ascending=[False, True])
    )
    dept_seen: set[str] = set()
    dept_options: list[dict[str, str]] = []
    for _, row in departments.iterrows():
        if row["departamento_geo"] in dept_seen:
            continue
        dept_seen.add(row["departamento_geo"])
        dept_options.append({"value": row["departamento_geo"], "label": row["departamento"]})
    modality_options = sorted(
        {
            value
            for value in df["modalidad_de_contratacion"].dropna().astype(str).tolist()
            if value.strip()
        }
    )
    return {
        "departments": dept_options,
        "modalities": [{"value": item, "label": item} for item in modality_options],
    }


def _freshness() -> dict[str, Any]:
    data = load_last_run()
    source_meta = load_live_source_metadata()
    last_run_ts = data.get("last_run_ts")
    return {
        "lastRunTs": last_run_ts,
        "sourceUpdatedAt": source_meta.get("sourceUpdatedAt"),
    }


def _benchmarks(df_all: pd.DataFrame, df_context: pd.DataFrame, df_slice: pd.DataFrame, department: str | None) -> dict[str, Any]:
    national_mean = float(df_all["risk_score"].mean()) if not df_all.empty else 0.0
    slice_mean = float(df_slice["risk_score"].mean()) if not df_slice.empty else national_mean
    department_mean = None
    if department:
        dept_frame = df_context[df_context["departamento_geo"] == department]
        if not dept_frame.empty:
            department_mean = float(dept_frame["risk_score"].mean())

    slice_median_value = float(df_slice["valor_num"].median()) if not df_slice.empty else 0.0
    return {
        "nationalMeanRisk": round(national_mean, 3),
        "sliceMeanRisk": round(slice_mean, 3),
        "departmentMeanRisk": round(department_mean, 3) if department_mean is not None else None,
        "sliceMedianValue": slice_median_value,
    }


def get_overview_payload(
    *,
    lang: str = "es",
    full: bool = False,
    department: str | None = None,
    risk: str | None = None,
    modality: str | None = None,
    query: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 6,
) -> dict[str, Any]:
    effective_full = full or bool(date_from or date_to)
    df_all = load_contracts(effective_full)
    scored_latest = _latest_date_from_frame(df_all)
    df_context = _filter_frame(
        df_all,
        risk=risk,
        modality=modality,
        query=query,
        date_from=date_from,
        date_to=date_to,
    )
    df_slice = _filter_frame(df_context, department=department)
    meta = load_model_metadata()
    return {
        "meta": {
            "lang": lang,
            "fullDataset": effective_full,
            "totalRows": int(len(df_all)),
            "shownRows": int(len(df_all)),
            "previewRows": int(len(df_all)),
            "latestContractDate": scored_latest,
            "sourceLatestContractDate": None,
            "sourceRows": load_last_run().get("rows_fetched") or None,
            "sourceFreshnessGapDays": None,
            "dateRange": {
                "from": date_from,
                "to": date_to,
            },
            **_freshness(),
        },
        "options": _options(df_context if not df_context.empty else df_all),
        "map": {
            "departments": _build_department_summary(df_context),
        },
        "slice": _slice_stats(df_slice, lang),
        "benchmarks": _benchmarks(df_all, df_context, df_slice, department),
        "leadCases": _lead_cases(df_slice, lang, limit),
        "summaries": {
            "entities": _entity_summary(df_slice),
            "modalities": _modality_summary(df_slice),
        },
        "analytics": _analytics_summary(df_slice),
        "methodology": {
            "modelType": meta.get("model_type", "IsolationForest"),
            "nEstimators": meta.get("n_estimators", 200),
            "contamination": meta.get("contamination", meta.get("contamination_param", 0.05)),
            "nFeatures": meta.get("n_features", 25),
            "trainedAt": meta.get("trained_at"),
            "redThreshold": meta.get("red_threshold", RED_THRESHOLD),
            "yellowThreshold": meta.get("yellow_threshold", YELLOW_THRESHOLD),
        },
        "liveFeed": {"latestDate": None, "rowsAtSource": None, "contracts": []},
    }


def get_freshness_payload() -> dict[str, Any]:
    scored_latest = get_scored_latest_contract_date()
    live_source = load_live_source_snapshot()
    source_meta = load_live_source_metadata()
    gap_days = _compute_source_gap_days(scored_latest, live_source.get("latestDate"))
    return {
        "latestContractDate": scored_latest,
        "sourceLatestContractDate": live_source.get("latestDate"),
        "sourceFreshnessGapDays": gap_days,
        "sourceRows": live_source.get("rowsAtSource"),
        "sourceUpdatedAt": source_meta.get("sourceUpdatedAt"),
        "liveFeed": live_source,
    }


def get_table_payload(
    *,
    lang: str = "es",
    full: bool = False,
    department: str | None = None,
    risk: str | None = None,
    modality: str | None = None,
    query: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    offset: int = 0,
    limit: int = 50,
) -> dict[str, Any]:
    effective_full = full or bool(date_from or date_to)
    df_all = load_contracts(effective_full)
    df_slice = _filter_frame(
        df_all,
        department=department,
        risk=risk,
        modality=modality,
        query=query,
        date_from=date_from,
        date_to=date_to,
    )
    ordered = (
        _decorate_priority(df_slice)
        .sort_values(["_priority", "fecha_ts", "risk_score", "valor_num"], ascending=[False, False, False, False])
        .iloc[offset:offset + limit]
    )
    rows = [
        {
            "id": str(row["contract_id"]),
            "score": int(round(float(row["risk_score"]) * 100)),
            "riskBand": row["risk_bucket"],
            "entity": row["nombre_entidad"],
            "provider": row["proveedor_adjudicado"] or RISK_LABELS[lang]["unavailable"],
            "department": row["departamento"],
            "modality": row["modalidad_de_contratacion"] or RISK_LABELS[lang]["unavailable"],
            "date": row["fecha_label"],
            "value": float(row["valor_num"]),
            "valueLabel": _format_cop(float(row["valor_num"]), lang),
            "secopUrl": row["secop_url"],
        }
        for _, row in ordered.iterrows()
    ]
    return {"total": int(len(df_slice)), "rows": rows}
