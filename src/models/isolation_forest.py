"""
Isolation Forest model for VeedurIA ContratoLimpio.

Trains an Isolation Forest on the 25 features from feature_engineering.py,
scores contracts with a 0.0–1.0 risk score, and manages model artifacts
(joblib + metadata JSON) for Supabase Storage upload.

Usage:
    from src.models.isolation_forest import train, score, load_latest_artifacts

    model, metadata = train(df_features)
    df_scored = score(df_features, model)

CLI entry point:
    python -m src.models.isolation_forest --action=train
    python -m src.models.isolation_forest --action=score
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from sklearn.ensemble import IsolationForest

from src.processing.feature_engineering import FEATURE_COLUMNS, build_features
from src.utils.logger import get_logger, log_etl_event

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
MODELS_DIR = PROJECT_ROOT / "data" / "processed" / "models"

# ---------------------------------------------------------------------------
# Model parameters
# ---------------------------------------------------------------------------

DEFAULT_CONTAMINATION = 0.05
FALLBACK_CONTAMINATION = 0.03  # Used if validation fails with default
RANDOM_STATE = 42
N_ESTIMATORS = 200
MAX_SAMPLES = "auto"

# Risk score thresholds
RED_THRESHOLD = 0.70
YELLOW_THRESHOLD = 0.40


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train(
    df: pd.DataFrame,
    contamination: float = DEFAULT_CONTAMINATION,
    n_estimators: int = N_ESTIMATORS,
) -> tuple[IsolationForest, dict[str, Any]]:
    """
    Train an Isolation Forest on the 25 feature columns.

    Args:
        df:            DataFrame with all 25 FEATURE_COLUMNS present.
        contamination: Expected proportion of anomalies (default 0.05).
        n_estimators:  Number of trees (default 200).

    Returns:
        Tuple of (trained IsolationForest model, metadata dict).
    """
    # Ensure feature columns exist
    missing = [c for c in FEATURE_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing feature columns: {missing}")

    X = df[FEATURE_COLUMNS].values
    n_samples = len(X)

    log_etl_event(
        "model_train_start",
        n_samples=n_samples,
        contamination=contamination,
        n_estimators=n_estimators,
    )

    model = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination,
        max_samples=MAX_SAMPLES,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    model.fit(X)

    # Compute training statistics
    raw_scores = model.decision_function(X)
    predictions = model.predict(X)
    n_anomalies = int((predictions == -1).sum())
    anomaly_rate = n_anomalies / n_samples if n_samples > 0 else 0

    metadata = {
        "model_type": "IsolationForest",
        "n_estimators": n_estimators,
        "contamination": contamination,
        "random_state": RANDOM_STATE,
        "n_samples_train": n_samples,
        "n_features": len(FEATURE_COLUMNS),
        "feature_columns": FEATURE_COLUMNS,
        "n_anomalies_train": n_anomalies,
        "anomaly_rate_train": round(anomaly_rate, 4),
        "decision_function_min": float(raw_scores.min()),
        "decision_function_max": float(raw_scores.max()),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "red_threshold": RED_THRESHOLD,
        "yellow_threshold": YELLOW_THRESHOLD,
    }

    log_etl_event(
        "model_train_complete",
        n_anomalies=n_anomalies,
        anomaly_rate=anomaly_rate,
    )

    return model, metadata


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def score(
    df: pd.DataFrame,
    model: IsolationForest,
    metadata: dict[str, Any] | None = None,
) -> pd.DataFrame:
    """
    Score contracts with the trained Isolation Forest.

    The raw decision_function output is inverted and min-max scaled to
    produce a 0.0–1.0 risk_score (higher = more anomalous).

    Args:
        df:       DataFrame with 25 FEATURE_COLUMNS.
        model:    Trained IsolationForest instance.
        metadata: Optional metadata dict from training to use for global min-max scaling.

    Returns:
        DataFrame with additional columns: risk_score, risk_label.
    """
    df = df.copy()
    X = df[FEATURE_COLUMNS].values

    # decision_function: higher = more normal. Invert for risk.
    raw_scores = model.decision_function(X)

    # Min-max scale inverted scores to [0, 1]
    inverted = -raw_scores
    if metadata and "decision_function_min" in metadata and "decision_function_max" in metadata:
        # Inverted scores mean min becomes -max, max becomes -min
        s_min = -metadata["decision_function_max"]
        s_max = -metadata["decision_function_min"]
    else:
        s_min, s_max = inverted.min(), inverted.max()
        
    if s_max - s_min > 0:
        risk_scores = (inverted - s_min) / (s_max - s_min)
    else:
        risk_scores = np.zeros_like(inverted)

    df["risk_score"] = np.round(risk_scores, 4)

    # Assign risk labels
    df["risk_label"] = "risk_verde"
    df.loc[df["risk_score"] >= YELLOW_THRESHOLD, "risk_label"] = "risk_amarillo"
    df.loc[df["risk_score"] >= RED_THRESHOLD, "risk_label"] = "risk_rojo"

    return df


def score_parquet_files(
    parquet_files: list[Path],
    model: IsolationForest,
    metadata: dict[str, Any] | None,
    out_path: Path,
) -> int:
    """
    Score raw SECOP parquet files one at a time and stream the result to disk.

    The daily SECOP snapshot is too large to concatenate in memory. Each raw
    parquet is feature-engineered, scored, and appended to a single parquet
    writer so GitHub Actions and local runs can complete with bounded memory.
    """
    writer: pq.ParquetWriter | None = None
    tmp_path = out_path.with_suffix(".tmp.parquet")
    total_rows = 0

    if tmp_path.exists():
        tmp_path.unlink()

    try:
        for idx, parquet_file in enumerate(parquet_files, start=1):
            logger.info(
                "Scoring parquet %d/%d: %s",
                idx,
                len(parquet_files),
                parquet_file.name,
            )
            df_raw = pd.read_parquet(parquet_file, engine="pyarrow")
            if df_raw.empty:
                logger.info("Skipping empty parquet: %s", parquet_file.name)
                continue

            df_features = build_features(df_raw)
            df_scored = score(df_features, model, metadata=metadata)
            table = pa.Table.from_pandas(df_scored, preserve_index=False)

            if writer is None:
                writer = pq.ParquetWriter(tmp_path, table.schema)
            else:
                for field in writer.schema:
                    if field.name not in table.column_names:
                        table = table.append_column(
                            field.name,
                            pa.nulls(len(table), type=field.type),
                        )
                table = table.select(writer.schema.names)
                table = table.cast(writer.schema)

            writer.write_table(table)
            total_rows += len(df_scored)
            logger.info("Scored %d rows so far", total_rows)

        if writer is None:
            raise RuntimeError("No rows were scored; refusing to write an empty scored parquet")
    finally:
        if writer is not None:
            writer.close()

    tmp_path.replace(out_path)
    return total_rows


# ---------------------------------------------------------------------------
# Artifact management
# ---------------------------------------------------------------------------

def save_artifacts(
    model: IsolationForest,
    metadata: dict[str, Any],
    label: str | None = None,
) -> tuple[Path, Path]:
    """
    Save model and metadata to data/processed/models/.

    Args:
        model:    Trained IsolationForest.
        metadata: Training metadata dict.
        label:    Optional label for the filename.

    Returns:
        Tuple of (model_path, metadata_path).
    """
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    label = label or ts

    model_path = MODELS_DIR / f"isolation_forest_{label}.joblib"
    meta_path = MODELS_DIR / f"isolation_forest_{label}_metadata.json"

    joblib.dump(model, model_path)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False, default=str)

    log_etl_event("model_artifacts_saved", model_path=str(model_path), meta_path=str(meta_path))
    return model_path, meta_path


def load_latest_artifacts() -> tuple[IsolationForest, dict[str, Any]]:
    """
    Load the most recent model and metadata from data/processed/models/.

    Returns:
        Tuple of (model, metadata).

    Raises:
        FileNotFoundError: If no model artifacts exist.
    """
    model_files = sorted(MODELS_DIR.glob("isolation_forest_*.joblib"))
    if not model_files:
        raise FileNotFoundError(f"No model artifacts found in {MODELS_DIR}")

    model_path = model_files[-1]  # Most recent by filename sort
    meta_path = model_path.with_name(
        model_path.stem + "_metadata.json"
    )

    model = joblib.load(model_path)

    metadata = {}
    if meta_path.exists():
        with open(meta_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)

    logger.info("Loaded model from %s", model_path)
    return model, metadata


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="VeedurIA — Isolation Forest model training and scoring"
    )
    parser.add_argument(
        "--action",
        choices=["train", "score"],
        default="train",
        help="Action to perform (default: train)",
    )
    parser.add_argument(
        "--contamination",
        type=float,
        default=DEFAULT_CONTAMINATION,
        help=f"Contamination rate (default: {DEFAULT_CONTAMINATION})",
    )
    return parser.parse_args()


def main() -> None:
    """CLI entry: python -m src.models.isolation_forest --action=train"""
    args = _parse_args()

    if args.action == "train":
        logger.info("Loading feature data for training...")
        # Load all parquet files from data/processed/
        data_dir = PROJECT_ROOT / "data" / "processed"
        parquet_files = list(data_dir.glob("secop_contratos_*.parquet"))
        if not parquet_files:
            logger.error("No Parquet files found in %s", data_dir)
            return

        dfs = [pd.read_parquet(f) for f in parquet_files]
        df = pd.concat(dfs, ignore_index=True)
        logger.info("Loaded %d rows from %d Parquet files", len(df), len(parquet_files))

        df = build_features(df)
        model, metadata = train(df, contamination=args.contamination)
        model_path, meta_path = save_artifacts(model, metadata)
        logger.info("Model saved: %s", model_path)

    elif args.action == "score":
        logger.info("Loading model and data for scoring...")
        model, metadata = load_latest_artifacts()
        data_dir = PROJECT_ROOT / "data" / "processed"
        parquet_files = sorted(data_dir.glob("secop_contratos_*.parquet"))
        if not parquet_files:
            logger.error("No Parquet files found")
            return

        out_path = data_dir / "scored_contracts.parquet"
        total_rows = score_parquet_files(parquet_files, model, metadata, out_path)
        logger.info("Scored %d contracts → %s", total_rows, out_path)


if __name__ == "__main__":
    main()
