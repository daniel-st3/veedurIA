"""
SHAP TreeExplainer wrapper for VeedurIA ContratoLimpio.

Produces top-5 SHAP feature contributions per contract, formatted as
i18n-ready explanation dicts for the UI risk cards.

Usage:
    from src.models.shap_explainer import explain, format_explanation

    explanations = explain(df_features, model)
    formatted = format_explanation(explanations[0])
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from src.processing.feature_engineering import FEATURE_COLUMNS
from src.utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Feature label templates (ES / EN)
# ---------------------------------------------------------------------------

FEATURE_LABELS: dict[str, dict[str, str]] = {
    "log_valor_contrato": {
        "label_es": "Valor del contrato atípico",
        "label_en": "Atypical contract value",
    },
    "value_vs_additions_ratio": {
        "label_es": "Valor inflado por adiciones al contrato",
        "label_en": "Contract value inflated by amendments",
    },
    "advance_payment_ratio": {
        "label_es": "Anticipo inusualmente alto",
        "label_en": "Unusually high advance payment",
    },
    "log_value_per_day": {
        "label_es": "Costo diario atípico del contrato",
        "label_en": "Atypical daily contract cost",
    },
    "price_ratio_vs_entity_median": {
        "label_es": "Precio superior al promedio de la entidad",
        "label_en": "Price above entity's historical average",
    },
    "price_ratio_vs_unspsc_median": {
        "label_es": "Precio atípico para esta categoría de bienes/servicios",
        "label_en": "Atypical price for this goods/services category",
    },
    "value_concentration_gini": {
        "label_es": "Alta concentración de valor en pocos proveedores",
        "label_en": "High value concentration in few providers",
    },
    "single_bidder": {
        "label_es": "Proceso adjudicado con un único oferente",
        "label_en": "Process awarded to a single bidder",
    },
    "is_direct_award": {
        "label_es": "Contratación directa (sin licitación competitiva)",
        "label_en": "Direct award (no competitive bidding)",
    },
    "duration_days": {
        "label_es": "Duración del contrato atípica",
        "label_en": "Atypical contract duration",
    },
    "days_pub_to_award": {
        "label_es": "Tiempo excepcionalmente corto entre publicación y adjudicación",
        "label_en": "Exceptionally short time from publication to award",
    },
    "normalized_ofertantes": {
        "label_es": "Número de oferentes inferior al esperado",
        "label_en": "Number of bidders below expected",
    },
    "object_description_brevity": {
        "label_es": "Descripción del objeto inusualmente breve",
        "label_en": "Unusually brief contract object description",
    },
    "provider_contract_count_entity": {
        "label_es": "Proveedor con múltiples contratos en la misma entidad",
        "label_en": "Provider with multiple contracts at the same entity",
    },
    "provider_value_share_entity": {
        "label_es": "Proveedor concentra alto porcentaje del gasto de la entidad",
        "label_en": "Provider captures high share of entity spending",
    },
    "provider_entity_diversity": {
        "label_es": "Proveedor trabaja con muy pocas entidades",
        "label_en": "Provider works with very few entities",
    },
    "provider_age_months": {
        "label_es": "Proveedor de reciente creación con contrato grande",
        "label_en": "Newly created provider with large contract",
    },
    "provider_modality_mix": {
        "label_es": "Proveedor gana exclusivamente por contratación directa",
        "label_en": "Provider wins exclusively through direct awards",
    },
    "repeat_provider_flag": {
        "label_es": "Misma combinación proveedor-entidad adjudicada repetidamente",
        "label_en": "Same provider-entity pair awarded repeatedly",
    },
    "electoral_window": {
        "label_es": "Firmado en ventana preelectoral (90 días antes de elecciones)",
        "label_en": "Signed in pre-electoral window (90 days before election)",
    },
    "ley_garantias_period": {
        "label_es": "Contratación directa durante período de restricción (Ley de Garantías)",
        "label_en": "Direct award during restriction period (Ley de Garantías)",
    },
    "fiscal_year_end_rush": {
        "label_es": "Firmado en período de cierre fiscal (dic 20–31)",
        "label_en": "Signed during fiscal year-end rush (Dec 20–31)",
    },
    "days_since_last_contract_entity": {
        "label_es": "Intervalo muy corto desde el último contrato de la entidad",
        "label_en": "Very short interval since entity's last contract",
    },
    "provider_degree": {
        "label_es": "Proveedor trabaja con pocas entidades (aislamiento en red)",
        "label_en": "Provider works with few entities (network isolation)",
    },
    "entity_provider_herfindahl": {
        "label_es": "Alta concentración de mercado por proveedor en la entidad",
        "label_en": "High provider market concentration at entity",
    },
}


# ---------------------------------------------------------------------------
# SHAP explanation
# ---------------------------------------------------------------------------

def explain(
    df: pd.DataFrame,
    model: Any,
    top_n: int = 5,
) -> list[list[dict[str, Any]]]:
    """
    Compute SHAP explanations for each row in the DataFrame.

    Uses TreeExplainer for Isolation Forest models. Returns the top_n
    features by absolute SHAP value for each contract.

    Args:
        df:    DataFrame with 25 FEATURE_COLUMNS.
        model: Trained IsolationForest instance.
        top_n: Number of top features to return per contract (default 5).

    Returns:
        List of lists — one inner list per row, each containing top_n dicts
        with keys: feature_key, label_es, label_en, value, direction.
    """
    X = df[FEATURE_COLUMNS].values

    logger.info("Computing SHAP values for %d contracts...", len(X))

    import shap  # noqa: PLC0415  (lazy import — shap is heavy)

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)

    # shap_values shape: (n_samples, n_features)
    all_explanations: list[list[dict[str, Any]]] = []

    for i in range(len(X)):
        row_shap = shap_values[i]
        # Sort by absolute value descending
        top_indices = np.argsort(np.abs(row_shap))[::-1][:top_n]

        row_explanations = []
        for idx in top_indices:
            feature_key = FEATURE_COLUMNS[idx]
            shap_val = float(row_shap[idx])
            labels = FEATURE_LABELS.get(feature_key, {
                "label_es": feature_key,
                "label_en": feature_key,
            })

            row_explanations.append({
                "feature_key": feature_key,
                "label_es": labels["label_es"],
                "label_en": labels["label_en"],
                "value": round(shap_val, 6),
                "direction": "increases_risk" if shap_val < 0 else "decreases_risk",
                # Note: For IsolationForest, negative SHAP = more anomalous
            })

        all_explanations.append(row_explanations)

    logger.info("SHAP explanations computed for %d contracts", len(all_explanations))
    return all_explanations


def format_explanation(
    explanations: list[dict[str, Any]],
    lang: str = "es",
    risk_score: float = 0.0,
) -> str:
    """
    Format SHAP explanations into a human-readable text string.

    Args:
        explanations: List of explanation dicts (from explain()).
        lang:         Language code: "es" or "en".
        risk_score:   The contract's risk score (0–1).

    Returns:
        Formatted explanation string.
    """
    n = len(explanations)
    label_key = f"label_{lang}"
    score_pct = int(risk_score * 100)

    # Filter to only risk-increasing factors
    risk_factors = [e for e in explanations if e["direction"] == "increases_risk"]

    if lang == "es":
        if not risk_factors:
            return f"Valor de riesgo: {score_pct}/100. No se identificaron indicadores atípicos significativos."
        factors_text = ". ".join(e[label_key] for e in risk_factors[:3])
        return (
            f"Este contrato presenta {len(risk_factors)} indicadores atípicos. "
            f"{factors_text}. Valor de riesgo: {score_pct}/100."
        )
    else:
        if not risk_factors:
            return f"Risk score: {score_pct}/100. No significant atypical indicators identified."
        factors_text = ". ".join(e[label_key] for e in risk_factors[:3])
        return (
            f"This contract shows {len(risk_factors)} atypical indicators. "
            f"{factors_text}. Risk score: {score_pct}/100."
        )
