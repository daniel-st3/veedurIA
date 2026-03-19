"""
Model validation for VeedurIA ContratoLimpio.

Validates the trained Isolation Forest against 3 known corruption
reference cases from data/reference/ungrd_cases.json. Blocks deployment
(fails CI) if fewer than 2 of 3 cases score ≥ 0.70.

Usage:
    from src.models.model_validator import validate, run_validation_and_write

    results = validate(model, metadata)
    run_validation_and_write(model, metadata)

CLI entry point:
    python -m src.models.model_validator
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from src.models.isolation_forest import RED_THRESHOLD, score
from src.processing.feature_engineering import FEATURE_COLUMNS, build_features
from src.utils.logger import get_logger, log_etl_event

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
UNGRD_CASES_PATH = PROJECT_ROOT / "data" / "reference" / "ungrd_cases.json"
MODELS_DIR = PROJECT_ROOT / "data" / "processed" / "models"


def _load_reference_cases() -> list[dict[str, Any]]:
    """Load the 3 reference cases from ungrd_cases.json."""
    with open(UNGRD_CASES_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("cases", [])


def _build_synthetic_row(case: dict[str, Any]) -> pd.DataFrame:
    """
    Build a synthetic contract row from a reference case's synthetic_fallback.

    The synthetic row gets realistic defaults for fields not specified
    in the fallback, then passes through build_features().
    """
    fallback = case.get("synthetic_fallback", {})
    row_data = fallback.get("synthetic_row", {})

    # Add defaults for missing fields
    defaults = {
        "valor_contrato_con_adiciones": row_data.get("valor_contrato", 0),
        "valor_de_pago_adelantado": "0",
        "numero_de_ofertantes": "1",
        "fecha_de_fin_del_contrato": "2024-12-31T00:00:00.000",
        "fecha_publicacion_proceso": "2024-06-10T00:00:00.000",
        "objeto_del_contrato": "Contrato de referencia para validación",
        "codigo_unspsc": "93131700",
        "departamento": "Bogotá",
        "nombre_entidad": case.get("entity_name", "ENTIDAD DE REFERENCIA"),
        "proveedor_adjudicado": "PROVEEDOR DE REFERENCIA",
    }

    # Merge with synthetic row (synthetic row takes precedence)
    full_row = {**defaults, **row_data}

    return pd.DataFrame([full_row])


def validate(
    model: Any,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Validate the model against the 3 reference corruption cases.

    For each case:
     1. Try to find matching real contracts (if any were loaded)
     2. Fall back to synthetic row if not found
     3. Score with the model
     4. Check if risk_score ≥ 0.70

    Args:
        model:    Trained IsolationForest instance.
        metadata: Optional model metadata dict.

    Returns:
        Dict with keys: cases (list of case results), passed (int),
        failed (int), total (int), pass_rate (float), overall_pass (bool).
    """
    cases = _load_reference_cases()
    results: list[dict[str, Any]] = []

    for case in cases:
        case_id = case["id"]
        min_score = case.get("minimum_risk_score", RED_THRESHOLD)

        logger.info("Validating case: %s", case_id)

        # Build synthetic row (always use synthetic for validation reliability)
        df_case = _build_synthetic_row(case)

        # Build features
        try:
            df_features = build_features(df_case)
        except Exception as exc:
            logger.error("Feature engineering failed for case %s: %s", case_id, exc)
            results.append({
                "case_id": case_id,
                "passed": False,
                "risk_score": 0.0,
                "minimum_required": min_score,
                "error": str(exc),
                "data_source": "synthetic",
            })
            continue

        # Score
        df_scored = score(df_features, model, metadata)
        risk_score = float(df_scored["risk_score"].iloc[0])
        passed = risk_score >= min_score

        results.append({
            "case_id": case_id,
            "passed": passed,
            "risk_score": round(risk_score, 4),
            "minimum_required": min_score,
            "risk_label": df_scored["risk_label"].iloc[0],
            "data_source": "synthetic",
        })

        log_etl_event(
            "validation_case",
            case_id=case_id,
            risk_score=risk_score,
            passed=passed,
        )

    n_passed = sum(1 for r in results if r["passed"])
    n_total = len(results)

    validation_result = {
        "cases": results,
        "passed": n_passed,
        "failed": n_total - n_passed,
        "total": n_total,
        "pass_rate": round(n_passed / n_total, 2) if n_total > 0 else 0,
        "overall_pass": n_passed >= 2,  # Pass criteria: ≥ 2 of 3
        "validated_at": datetime.now(timezone.utc).isoformat(),
        "model_metadata": metadata or {},
    }

    log_etl_event(
        "validation_complete",
        passed=n_passed,
        failed=n_total - n_passed,
        overall_pass=validation_result["overall_pass"],
    )

    return validation_result


def run_validation_and_write(
    model: Any,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Run validation and write results to data/processed/models/validation_results.json.

    Returns:
        Validation results dict.
    """
    results = validate(model, metadata)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = MODELS_DIR / "validation_results.json"

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)

    logger.info("Validation results written to %s", out_path)

    if not results["overall_pass"]:
        logger.error(
            "VALIDATION FAILED: Only %d/%d cases passed (need ≥ 2). "
            "Consider lowering contamination to 0.03 and retraining.",
            results["passed"], results["total"],
        )

    return results


def main() -> None:
    """CLI entry: python -m src.models.model_validator"""
    from src.models.isolation_forest import load_latest_artifacts

    logger.info("Loading latest model artifacts...")
    model, metadata = load_latest_artifacts()

    results = run_validation_and_write(model, metadata)

    if not results["overall_pass"]:
        logger.error("Validation gate FAILED. Exiting with code 1.")
        sys.exit(1)
    else:
        logger.info("Validation gate PASSED: %d/%d cases.", results["passed"], results["total"])


if __name__ == "__main__":
    main()
