# ML Standards — VeedurIA

All machine learning code in this project must follow these standards.
These apply to model training, inference, validation, and artifact management.

---

## 1. Phase 1 Model Specification

```python
from sklearn.ensemble import IsolationForest

model = IsolationForest(
    contamination=0.05,   # 5% of contracts expected to be anomalous
    n_estimators=100,
    random_state=42       # Always set for reproducibility
)
```

- Do not tune `contamination` without updating `_metadata.json` and re-running validation.
- Do not change `random_state` — reproducibility is a hard requirement.

## 2. Feature Scaling

- **Preferred:** `RobustScaler` — handles outliers in contract value distributions better
  than StandardScaler. SECOP data has extreme skew (e.g., mega-contracts pull mean far right).
- **Acceptable:** `StandardScaler` only if data has been pre-clipped at the 99th percentile.
- **Never:** Skip scaling entirely. Raw pesos values will dominate tree splits incorrectly.
- Fit scaler on training data only. Apply (transform, not fit_transform) on inference data.
- Save fitted scaler as `.joblib` alongside the model.

## 3. SHAP Explainability

- **Always use:** `shap.TreeExplainer(model)`
- **Never use:** `shap.KernelExplainer` — too slow for production (seconds per sample vs.
  milliseconds per sample).
- Output: top 5 feature contributions per contract prediction (by absolute SHAP value).
- SHAP values must be computed and attached before any score is surfaced in the UI.
- Store SHAP output in the results DataFrame as columns: `shap_feat_1`, `shap_val_1`, ...,
  `shap_feat_5`, `shap_val_5`.

## 4. Model Artifact Storage

- Save location: `/data/processed/models/`
- Format: `.joblib` (use `joblib.dump(model, path, compress=3)`)
- Every model file `model_YYYYMMDD.joblib` **must** have a companion
  `model_YYYYMMDD_metadata.json`:

```json
{
  "training_date": "YYYY-MM-DD",
  "n_samples": 0,
  "feature_list": ["feature_1", "feature_2", "..."],
  "validation_scores": {
    "ungrd_carrotanques": true,
    "manizales_directos": true,
    "pasaportes_colombia": false
  },
  "contamination_param": 0.05,
  "scaler": "RobustScaler",
  "sklearn_version": "1.x.x"
}
```

- `.joblib` files > 50MB are gitignored (see `.gitignore`).
- `_metadata.json` files are always committed — they are the audit trail.

## 5. Mandatory Validation Before Deployment

Model must flag **at least 2 of 3** known reference anomaly cases or it **fails validation**
and must NOT be deployed. Run: `python -m src.models.model_validator`

**Reference cases (defined in `/data/reference/ungrd_cases.json`):**

| ID | Case | Key Signal |
|---|---|---|
| `ungrd_carrotanques` | UNGRD carrotanques La Guajira | 54% sobreprecio vs. market reference |
| `manizales_directos` | Manizales 132 contratos directos | Spike of direct-award contracts pre-Ley de Garantías |
| `pasaportes_colombia` | Pasaportes Colombia | Irregular contracting pattern, single supplier dominance |

- If 0 of 3 are flagged: model is broken — do not deploy, investigate feature pipeline.
- If 1 of 3 is flagged: model is weak — do not deploy, tune contamination or features.
- If 2 of 3 are flagged: model passes — may deploy with documented limitation.
- If 3 of 3 are flagged: model is strong — deploy and document.

## 6. Risk Score Computation

Isolation Forest outputs anomaly scores in [-1, 0] range (sklearn convention).
Map to [0.0, 1.0] risk score for the UI:

```python
# sklearn decision_function output: more negative = more anomalous
raw_score = model.decision_function(X)          # range approx [-0.5, 0.5]
risk_score = 1 - (raw_score - raw_score.min()) / (raw_score.max() - raw_score.min())
```

Semaphore thresholds:
- `risk_score >= 0.70` → 🔴 Rojo (alerta preventiva alta)
- `0.40 <= risk_score < 0.70` → 🟡 Amarillo (patrón atípico moderado)
- `risk_score < 0.40` → 🟢 Verde (sin banderas de riesgo)

## 7. Inference Performance

- Model loading: use `st.cache_resource()` — load once per Streamlit session.
- Batch inference: always score in batches (never row-by-row in a loop).
- Target inference latency: < 2 seconds for batches up to 10,000 contracts.

## 8. Retraining Schedule

- Automated: GitHub Actions `model_refresh.yml` runs weekly (Sundays 3AM UTC).
- Manual trigger: `python -m src.models.isolation_forest --action=train`
- After any automated retrain, validation runs automatically before the new
  model is promoted (old `.joblib` is kept as fallback).
