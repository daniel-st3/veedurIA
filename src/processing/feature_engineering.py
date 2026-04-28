"""
Feature engineering for VeedurIA ContratoLimpio Isolation Forest model.

Builds 25 features from raw SECOP II contract data, organized in 5 groups:
  A. Price / Value (7 features)
  B. Process Structure (6 features)
  C. Provider Behavior (6 features)
  D. Temporal / Electoral (4 features)
  E. Simple Network Proxies (2 features)

Rolling window strategy (Option C — Adaptive):
  - Provider features (14,15,16,18,19,24): 12-month rolling window
  - Entity features (5,7,25): 24-month rolling window

Usage:
    from src.processing.feature_engineering import build_features

    df_features = build_features(df_raw)

All 25 features are:
  - Bounded or log-transformed
  - Imputed to non-null
  - Named with the exact identifiers from the implementation plan
"""

from __future__ import annotations

import json
from datetime import timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from src.utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Paths / constants
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ELECTORAL_CALENDAR_PATH = PROJECT_ROOT / "data" / "reference" / "electoral_calendar.json"

FEATURE_COLUMNS: list[str] = [
    # Group A — Price / Value
    "log_valor_contrato",
    "value_vs_additions_ratio",
    "advance_payment_ratio",
    "log_value_per_day",
    "price_ratio_vs_entity_median",
    "price_ratio_vs_unspsc_median",
    "value_concentration_gini",
    # Group B — Process Structure
    "single_bidder",
    "is_direct_award",
    "duration_days",
    "days_pub_to_award",
    "normalized_ofertantes",
    "object_description_brevity",
    # Group C — Provider Behavior
    "provider_contract_count_entity",
    "provider_value_share_entity",
    "provider_entity_diversity",
    "provider_age_months",
    "provider_modality_mix",
    "repeat_provider_flag",
    # Group D — Temporal / Electoral
    "electoral_window",
    "ley_garantias_period",
    "fiscal_year_end_rush",
    "days_since_last_contract_entity",
    # Group E — Simple Network Proxies
    "provider_degree",
    "entity_provider_herfindahl",
]


def _load_electoral_calendar() -> list[dict[str, Any]]:
    """Load electoral events from data/reference/electoral_calendar.json."""
    try:
        with open(ELECTORAL_CALENDAR_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("events", [])
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        logger.warning("Could not load electoral calendar: %s", exc)
        return []


def _safe_to_datetime(series: pd.Series) -> pd.Series:
    """Convert a series to datetime, coercing errors to NaT."""
    return pd.to_datetime(series, errors="coerce", utc=True)


def _safe_to_numeric(series: pd.Series) -> pd.Series:
    """Convert a series to numeric, coercing errors to NaN."""
    return pd.to_numeric(series, errors="coerce")


def _gini_coefficient(values: np.ndarray) -> float:
    """Compute Gini coefficient for a 1-D array of non-negative values."""
    values = np.sort(values)
    n = len(values)
    if n == 0 or values.sum() == 0:
        return 0.0
    index = np.arange(1, n + 1)
    return float(((2 * index - n - 1) * values).sum() / (n * values.sum()))


def _shannon_entropy(counts: pd.Series) -> float:
    """Compute Shannon entropy of a categorical distribution."""
    probs = counts / counts.sum()
    probs = probs[probs > 0]
    return float(-np.sum(probs * np.log2(probs)))


# ---------------------------------------------------------------------------
# Entity-level aggregates (needed for group-relative features)
# ---------------------------------------------------------------------------

def compute_entity_aggregates(
    df: pd.DataFrame,
    entity_window_months: int = 24,
) -> dict[str, pd.DataFrame]:
    """
    Compute entity-level statistics for group-relative features.

    Uses a 24-month rolling window for entity features (5, 7, 25).

    Args:
        df: DataFrame with at minimum: nit_entidad, valor_contrato,
            modalidad_de_contratacion, fecha_firma, nit_proveedor.
        entity_window_months: Rolling window in months (default 24).

    Returns:
        Dict of aggregated DataFrames keyed by aggregate name.
    """
    aggs = {}

    if "fecha_firma" in df.columns:
        df = df.copy()
        df["fecha_firma"] = _safe_to_datetime(df["fecha_firma"])
        cutoff = df["fecha_firma"].max() - pd.DateOffset(months=entity_window_months)
        df_window = df[df["fecha_firma"] >= cutoff].copy()
    else:
        df_window = df.copy()

    # Entity+modality median value (for feature 5)
    if all(c in df_window.columns for c in ("nit_entidad", "modalidad_de_contratacion", "valor_contrato")):
        df_window["valor_contrato"] = _safe_to_numeric(df_window["valor_contrato"])
        entity_mod_median = (
            df_window.groupby(["nit_entidad", "modalidad_de_contratacion"])["valor_contrato"]
            .median()
            .rename("entity_modality_median_valor")
            .reset_index()
        )
        aggs["entity_modality_median"] = entity_mod_median

    # Entity provider HHI (for feature 25)
    if all(c in df_window.columns for c in ("nit_entidad", "nit_proveedor", "valor_contrato")):
        entity_provider = df_window.groupby(["nit_entidad", "nit_proveedor"])["valor_contrato"].sum().reset_index()
        entity_total = df_window.groupby("nit_entidad")["valor_contrato"].sum().rename("entity_total").reset_index()
        entity_provider = entity_provider.merge(entity_total, on="nit_entidad", how="left")
        entity_provider["share"] = entity_provider["valor_contrato"] / entity_provider["entity_total"]
        entity_provider["share_sq"] = entity_provider["share"] ** 2
        hhi = entity_provider.groupby("nit_entidad")["share_sq"].sum().rename("hhi").reset_index()
        aggs["entity_hhi"] = hhi

    # Entity provider Gini (for feature 7)
    if all(c in df_window.columns for c in ("nit_entidad", "nit_proveedor", "valor_contrato")):
        def _entity_gini(group: pd.DataFrame) -> float:
            vals = group["valor_contrato"].dropna().values
            return _gini_coefficient(vals)

        gini_df = (
            df_window.groupby(["nit_entidad", "nit_proveedor"])["valor_contrato"]
            .sum()
            .reset_index()
            .groupby("nit_entidad")
            .apply(_entity_gini, include_groups=False)
            .rename("entity_gini")
            .reset_index()
        )
        aggs["entity_gini"] = gini_df

    return aggs


# ---------------------------------------------------------------------------
# Individual feature builders
# ---------------------------------------------------------------------------

def _build_group_a(df: pd.DataFrame, aggs: dict) -> pd.DataFrame:
    """Group A — Price / Value (features 1–7)."""

    # 1. log_valor_contrato
    df["log_valor_contrato"] = np.log1p(_safe_to_numeric(df.get("valor_contrato", pd.Series(dtype=float))))

    # 2. value_vs_additions_ratio
    val = _safe_to_numeric(df.get("valor_contrato", pd.Series(dtype=float)))
    val_add = _safe_to_numeric(df.get("valor_contrato_con_adiciones", pd.Series(dtype=float)))
    ratio = val_add / val.replace(0, np.nan)
    # Clip at 99th percentile
    p99 = ratio.quantile(0.99) if not ratio.dropna().empty else 10.0
    df["value_vs_additions_ratio"] = ratio.clip(upper=p99).fillna(1.0)

    # 3. advance_payment_ratio
    adv = _safe_to_numeric(df.get("valor_de_pago_adelantado", pd.Series(dtype=float)))
    df["advance_payment_ratio"] = (adv / val.replace(0, np.nan)).clip(0, 1).fillna(0.0)

    # 4. log_value_per_day
    fecha_firma = _safe_to_datetime(df.get("fecha_firma", pd.Series(dtype="datetime64[ns, UTC]")))
    fecha_fin = _safe_to_datetime(df.get("fecha_de_fin_del_contrato", pd.Series(dtype="datetime64[ns, UTC]")))
    duration = (fecha_fin - fecha_firma).dt.days.clip(lower=1).fillna(1)
    df["log_value_per_day"] = np.log1p(val.fillna(0) / duration)

    # 5. price_ratio_vs_entity_median
    if "entity_modality_median" in aggs and all(
        c in df.columns for c in ("nit_entidad", "modalidad_de_contratacion")
    ):
        df = df.merge(
            aggs["entity_modality_median"],
            on=["nit_entidad", "modalidad_de_contratacion"],
            how="left",
        )
        median_val = df["entity_modality_median_valor"].replace(0, np.nan)
        df["price_ratio_vs_entity_median"] = (val / median_val).fillna(1.0).clip(0, 10)
        df.drop(columns=["entity_modality_median_valor"], inplace=True, errors="ignore")
    else:
        df["price_ratio_vs_entity_median"] = 1.0

    # 6. price_ratio_vs_unspsc_median
    if "codigo_unspsc" in df.columns:
        df["_unspsc_class"] = df["codigo_unspsc"].astype(str).str[:4]
        unspsc_median = df.groupby("_unspsc_class")["valor_contrato"].transform("median")
        df["price_ratio_vs_unspsc_median"] = (
            (_safe_to_numeric(df["valor_contrato"]) / unspsc_median.replace(0, np.nan))
            .fillna(1.0)
            .clip(0, 10)
        )
        df.drop(columns=["_unspsc_class"], inplace=True, errors="ignore")
    else:
        df["price_ratio_vs_unspsc_median"] = 1.0

    # 7. value_concentration_gini (entity-level, 24-month window)
    if "entity_gini" in aggs and "nit_entidad" in df.columns:
        df = df.merge(aggs["entity_gini"], on="nit_entidad", how="left")
        df["value_concentration_gini"] = df["entity_gini"].fillna(0.0)
        df.drop(columns=["entity_gini"], inplace=True, errors="ignore")
    else:
        df["value_concentration_gini"] = 0.0

    return df


def _build_group_b(df: pd.DataFrame) -> pd.DataFrame:
    """Group B — Process Structure (features 8–13)."""

    # 8. single_bidder
    ofertantes = _safe_to_numeric(df.get("numero_de_ofertantes", pd.Series(dtype=float)))
    modalidad = df.get("modalidad_de_contratacion", pd.Series(dtype=str)).fillna("")
    is_directa = modalidad.str.contains("DIRECTA", case=False, na=False)
    # Null → 1 for direct awards, 0 otherwise
    ofertantes_filled = ofertantes.fillna(ofertantes.where(~is_directa).fillna(1))
    ofertantes_filled = ofertantes_filled.fillna(1)
    df["single_bidder"] = (ofertantes_filled == 1).astype(int)

    # 9. is_direct_award
    df["is_direct_award"] = modalidad.str.contains(
        "CONTRATACION DIRECTA|CONTRATACIÓN DIRECTA", case=False, na=False
    ).astype(int)

    # 10. duration_days
    fecha_firma = _safe_to_datetime(df.get("fecha_firma", pd.Series(dtype="datetime64[ns, UTC]")))
    fecha_fin = _safe_to_datetime(df.get("fecha_de_fin_del_contrato", pd.Series(dtype="datetime64[ns, UTC]")))
    duration = (fecha_fin - fecha_firma).dt.days.clip(lower=0)
    # Null → modality median
    if "modalidad_de_contratacion" in df.columns:
        df["_dur_raw"] = duration
        modality_median_dur = df.groupby("modalidad_de_contratacion")["_dur_raw"].transform("median")
        df["duration_days"] = duration.fillna(modality_median_dur).fillna(30)
        df.drop(columns=["_dur_raw"], inplace=True, errors="ignore")
    else:
        df["duration_days"] = duration.fillna(30)

    # 11. days_pub_to_award
    fecha_pub = _safe_to_datetime(df.get("fecha_publicacion_proceso", pd.Series(dtype="datetime64[ns, UTC]")))
    df["days_pub_to_award"] = (fecha_firma - fecha_pub).dt.days.fillna(-1)

    # 12. normalized_ofertantes
    df["_ofertantes"] = ofertantes
    if "modalidad_de_contratacion" in df.columns:
        expected = df.groupby("modalidad_de_contratacion")["_ofertantes"].transform("median")
        expected = expected.replace(0, np.nan).fillna(1)
        df["normalized_ofertantes"] = (ofertantes.fillna(1) / expected).clip(0, 3)
    else:
        df["normalized_ofertantes"] = 1.0
    df.drop(columns=["_ofertantes"], inplace=True, errors="ignore")

    # 13. object_description_brevity
    objeto = df.get("objeto_del_contrato", pd.Series(dtype=str)).fillna("")
    obj_len = objeto.str.len()
    if "modalidad_de_contratacion" in df.columns:
        df["_obj_len"] = obj_len
        df["object_description_brevity"] = (
            df.groupby("modalidad_de_contratacion")["_obj_len"]
            .transform(lambda x: x.rank(pct=True))
            .fillna(0.5)
        )
        df.drop(columns=["_obj_len"], inplace=True, errors="ignore")
    else:
        df["object_description_brevity"] = obj_len.rank(pct=True).fillna(0.5)

    return df


def _build_group_c(
    df: pd.DataFrame,
    provider_window_months: int = 12,
) -> pd.DataFrame:
    """Group C — Provider Behavior (features 14–19)."""

    fecha_firma = _safe_to_datetime(df.get("fecha_firma", pd.Series(dtype="datetime64[ns, UTC]")))
    has_dates = fecha_firma.notna().any()
    if has_dates:
        cutoff_provider = fecha_firma.max() - pd.DateOffset(months=provider_window_months)
        provider_mask = fecha_firma >= cutoff_provider
    else:
        provider_mask = pd.Series(True, index=df.index)

    nit_prov = df.get("nit_proveedor", pd.Series(dtype=str)).fillna("UNKNOWN")
    nit_ent = df.get("nit_entidad", pd.Series(dtype=str)).fillna("UNKNOWN")
    val = _safe_to_numeric(df.get("valor_contrato", pd.Series(dtype=float))).fillna(0)

    # Build provider-entity pair counts in rolling window
    df["_pair"] = nit_prov + "___" + nit_ent
    pair_counts_window = df.loc[provider_mask].groupby("_pair").size()
    pair_count_map = pair_counts_window.to_dict()

    # 14. provider_contract_count_entity (12-month)
    df["provider_contract_count_entity"] = df["_pair"].map(pair_count_map).fillna(0).astype(float)

    # 15. provider_value_share_entity (12-month)
    df_window = df.loc[provider_mask]
    if not df_window.empty:
        df_window_val = val.loc[provider_mask]
        df_window_ent = nit_ent.loc[provider_mask]
        
        prov_ent_val = df_window_val.groupby(df_window["_pair"]).sum()
        ent_total = df_window_val.groupby(df_window_ent).sum()
        prov_ent_val_dict = prov_ent_val.to_dict()
        ent_total_dict = ent_total.to_dict()
        df["_prov_ent_val"] = df["_pair"].map(prov_ent_val_dict).fillna(0)
        df["_ent_total"] = nit_ent.map(ent_total_dict).fillna(1)
        df["provider_value_share_entity"] = (df["_prov_ent_val"] / df["_ent_total"].replace(0, 1)).clip(0, 1)
        df.drop(columns=["_prov_ent_val", "_ent_total"], inplace=True, errors="ignore")
    else:
        df["provider_value_share_entity"] = 0.0

    # 16. provider_entity_diversity (12-month)
    df_window_prov = nit_prov.loc[provider_mask]
    df_window_ent = nit_ent.loc[provider_mask]
    prov_diversity = df_window_ent.groupby(df_window_prov).nunique()
    df["provider_entity_diversity"] = nit_prov.map(prov_diversity.to_dict()).fillna(1).astype(float)

    # 17. provider_age_months
    if has_dates:
        prov_first = fecha_firma.groupby(nit_prov).min()
        first_seen = nit_prov.map(prov_first)
        df["provider_age_months"] = (
            ((fecha_firma.max() - first_seen).dt.days / 30.44)
            .fillna(0)
            .clip(lower=0)
        ).fillna(0).clip(lower=0)
    else:
        df["provider_age_months"] = 0.0

    # 18. provider_modality_mix (Shannon entropy, 12-month)
    if "modalidad_de_contratacion" in df.columns:
        prov_mod_counts = (
            df.loc[provider_mask, "modalidad_de_contratacion"]
            .groupby([nit_prov.loc[provider_mask], df.loc[provider_mask, "modalidad_de_contratacion"]])
            .size()
            .rename("count")
            .reset_index()
        )
        if prov_mod_counts.empty:
            df["provider_modality_mix"] = 0.0
        else:
            provider_col = prov_mod_counts.columns[0]
            totals = prov_mod_counts.groupby(provider_col)["count"].transform("sum")
            probs = prov_mod_counts["count"] / totals.replace(0, 1)
            prov_mod_counts["_entropy_part"] = -(probs * np.log2(probs.where(probs > 0, 1)))
            entropy = prov_mod_counts.groupby(provider_col)["_entropy_part"].sum()
            df["provider_modality_mix"] = nit_prov.map(entropy).fillna(0.0)
    else:
        df["provider_modality_mix"] = 0.0

    # 19. repeat_provider_flag (>3 times in 12 months)
    df["repeat_provider_flag"] = (df["provider_contract_count_entity"] > 3).astype(int)

    # Cleanup
    df.drop(columns=["_pair"], inplace=True, errors="ignore")

    return df


def _build_group_d(df: pd.DataFrame) -> pd.DataFrame:
    """Group D — Temporal / Electoral (features 20–23)."""

    fecha_firma = _safe_to_datetime(df.get("fecha_firma", pd.Series(dtype="datetime64[ns, UTC]")))
    events = _load_electoral_calendar()

    # 20. electoral_window (90 days before any election)
    if events:
        electoral_dates = [pd.Timestamp(e["event_date"], tz="UTC") for e in events]
        electoral_window = pd.Series(False, index=df.index)
        for edate in electoral_dates:
            delta = edate - fecha_firma
            electoral_window |= (delta >= timedelta(0)) & (delta <= timedelta(days=90))
        df["electoral_window"] = electoral_window.fillna(False).astype(int)
    else:
        df["electoral_window"] = 0

    # 21. ley_garantias_period (direct award during restriction period)
    is_direct = df.get("is_direct_award", pd.Series(0, index=df.index))
    if events:
        ley_period = pd.Series(False, index=df.index)
        for event in events:
            if "restriction_start" not in event:
                continue
            rstart = pd.Timestamp(event["restriction_start"], tz="UTC")
            edate = pd.Timestamp(event["event_date"], tz="UTC")
            ley_period |= (fecha_firma >= rstart) & (fecha_firma <= edate)
        df["ley_garantias_period"] = (is_direct.astype(int) & ley_period.astype(int)).astype(int)
    else:
        df["ley_garantias_period"] = 0

    # 22. fiscal_year_end_rush (Dec 20–31)
    month = fecha_firma.dt.month.fillna(0).astype(int)
    day = fecha_firma.dt.day.fillna(0).astype(int)
    df["fiscal_year_end_rush"] = ((month == 12) & (day >= 20)).astype(int)

    # 23. days_since_last_contract_entity
    if "nit_entidad" in df.columns and fecha_firma.notna().any():
        df_sorted = df.sort_values(["nit_entidad", "fecha_firma"])
        df["days_since_last_contract_entity"] = (
            df_sorted.groupby("nit_entidad")["fecha_firma"]
            .diff()
            .dt.days
            .fillna(-1)
        )
        # Reindex to match original order
        df["days_since_last_contract_entity"] = df["days_since_last_contract_entity"].fillna(-1)
    else:
        df["days_since_last_contract_entity"] = -1.0

    return df


def _build_group_e(df: pd.DataFrame) -> pd.DataFrame:
    """Group E — Simple Network Proxies (features 24–25)."""

    nit_prov = df.get("nit_proveedor", pd.Series(dtype=str)).fillna("UNKNOWN")

    # 24. provider_degree (all-time distinct entities per provider)
    if "nit_entidad" in df.columns:
        prov_degree = df["nit_entidad"].groupby(nit_prov).nunique()
        df["provider_degree"] = nit_prov.map(prov_degree.to_dict()).fillna(1).astype(float)
    else:
        df["provider_degree"] = 1.0

    # 25. entity_provider_herfindahl (24-month window, already computed in aggs)
    # If not already set by _build_group_a, compute here
    if "entity_provider_herfindahl" not in df.columns:
        if all(c in df.columns for c in ("nit_entidad", "nit_proveedor", "valor_contrato")):
            val = _safe_to_numeric(df["valor_contrato"]).fillna(0)
            ent_prov_sum = val.groupby([df["nit_entidad"], df["nit_proveedor"]]).transform("sum")
            ent_total = val.groupby(df["nit_entidad"]).transform("sum")
            shares = ent_prov_sum / ent_total.replace(0, 1)
            shares_sq = shares ** 2
            hhi = df.assign(_share_sq=shares_sq).groupby("nit_entidad")["_share_sq"].transform("sum")
            df["entity_provider_herfindahl"] = hhi.fillna(1.0).clip(0, 1)
        else:
            df["entity_provider_herfindahl"] = 1.0

    return df


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build all 25 features from a raw SECOP II contracts DataFrame.

    Args:
        df: Raw DataFrame with SECOP II contract columns. Must include
            at minimum: valor_contrato, fecha_firma, nit_entidad,
            nit_proveedor, modalidad_de_contratacion.

    Returns:
        DataFrame with 25 feature columns appended. Original columns
        are preserved. All feature columns are non-null.
    """
    logger.info("Building features for %d contracts...", len(df))

    # Ensure critical columns are the right type
    df = df.copy()
    if "valor_contrato" in df.columns:
        df["valor_contrato"] = _safe_to_numeric(df["valor_contrato"])
    if "valor_contrato_con_adiciones" in df.columns:
        df["valor_contrato_con_adiciones"] = _safe_to_numeric(df["valor_contrato_con_adiciones"])
    if "valor_de_pago_adelantado" in df.columns:
        df["valor_de_pago_adelantado"] = _safe_to_numeric(df["valor_de_pago_adelantado"])
    if "numero_de_ofertantes" in df.columns:
        df["numero_de_ofertantes"] = _safe_to_numeric(df["numero_de_ofertantes"])
    if "fecha_firma" in df.columns:
        df["fecha_firma"] = _safe_to_datetime(df["fecha_firma"])
    if "fecha_de_fin_del_contrato" in df.columns:
        df["fecha_de_fin_del_contrato"] = _safe_to_datetime(df["fecha_de_fin_del_contrato"])
    if "fecha_publicacion_proceso" in df.columns:
        df["fecha_publicacion_proceso"] = _safe_to_datetime(df["fecha_publicacion_proceso"])

    # Compute entity aggregates (24-month window)
    aggs = compute_entity_aggregates(df, entity_window_months=24)

    # Build feature groups
    df = _build_group_a(df, aggs)
    df = _build_group_b(df)
    df = _build_group_c(df, provider_window_months=12)
    df = _build_group_d(df)
    df = _build_group_e(df)

    # Final null sweep — ensure all 25 feature columns have no nulls
    for col in FEATURE_COLUMNS:
        if col in df.columns:
            df[col] = df[col].fillna(0)
        else:
            logger.warning("Missing feature column: %s — filling with 0", col)
            df[col] = 0.0

    logger.info("Feature engineering complete. %d features, %d rows.", len(FEATURE_COLUMNS), len(df))
    return df


def load_features_from_parquet(parquet_path: str | Path) -> pd.DataFrame:
    """
    Load a Parquet file, call build_features(), and return the result.

    Args:
        parquet_path: Path to a Parquet file with raw SECOP II data.

    Returns:
        DataFrame with 25 feature columns.
    """
    df = pd.read_parquet(parquet_path)
    return build_features(df)
