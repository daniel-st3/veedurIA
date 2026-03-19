# Phase 1 — ContratoLimpio: Context & Architecture

---

## Key Files Touched in Phase 1

```
WEEK 1
src/__init__.py                        (new — empty)
src/ingestion/__init__.py              (new — empty)
src/processing/__init__.py             (new — empty)
src/models/__init__.py                 (new — empty)
src/ui/__init__.py                     (new — empty)
src/utils/__init__.py                  (new — empty)
tests/__init__.py                      (new — empty)
src/utils/logger.py                    (implement from stub)
src/utils/rate_limiter.py              (implement from stub)
src/ingestion/secop_client.py          (implement build_client + fetch_incremental)
src/ingestion/api_colombia_client.py   (implement from stub)
data/reference/electoral_calendar.json (populate)

WEEK 2
src/ingestion/secop_client.py          (implement main + load/save last_run)
src/processing/entity_resolution.py   (implement clean_nit + normalize_name)
data/processed/last_run.json           (new — initial schema)
data/processed/.gitkeep               (new)
data/processed/models/.gitkeep        (new)
data/reference/ungrd_cases.json       (populate)
.github/workflows/secop_ingestion.yml (replace echo stub)
requirements-phase1.txt               (add numpy==2.1.3)

WEEK 3
src/processing/feature_engineering.py (implement all 25 features)

WEEK 4
src/models/isolation_forest.py        (implement train + score + artifacts)
src/models/shap_explainer.py          (implement explain + format_explanation)
src/models/model_validator.py         (implement validate + run_validation_and_write)
.github/workflows/model_refresh.yml   (replace echo stubs + validation gate)

WEEK 5
src/ui/i18n.py                        (implement load_translations)
src/ui/components.py                  (implement render_risk_card + render_semaphore + render_ethical_disclaimer)
src/ui/maps.py                        (implement build_choropleth)
i18n/es.json                          (populate all keys)
i18n/en.json                          (populate all keys)
data/reference/colombia_departments.geojson  (new — download simplified GeoJSON)
pages/1_ContratoLimpio.py             (implement full page)
app.py                                (implement home page)

WEEK 6
tests/conftest.py                     (new — shared fixtures)
All test files                        (fill in coverage gaps)
```

---

## Module Dependencies

```
pages/1_ContratoLimpio.py
    ↓ imports
src/ui/components.py        → i18n keys
src/ui/maps.py              → Folium + GeoJSON
src/ui/i18n.py              → i18n/es.json, i18n/en.json
src/models/isolation_forest.py → src/processing/feature_engineering.py
src/models/shap_explainer.py   → src/models/isolation_forest.py
src/utils/config.py         → (secrets, no deps)
    ↓ used by
src/ingestion/secop_client.py
src/models/isolation_forest.py
src/models/model_validator.py
```

**Import rule:** `pages/` never imports from other `pages/`. Always through `src/`.
**Testing rule:** All `src/` modules must be importable standalone (no implicit Streamlit context needed).

---

## Primary SECOP Dataset: jbjy-vk9h

**Name:** SECOP II Contratos Electrónicos
**Domain:** `www.datos.gov.co`
**Resource ID:** `jbjy-vk9h`

### Key Fields Used in Phase 1

| Field | Type | Used For |
|---|---|---|
| `id_contrato` | string | Primary key, deduplication |
| `referencia_del_contrato` | string | Display, SECOP URL |
| `entidad` | string | Entity name (display) |
| `nit_entidad` | string | Entity identifier (clean via `clean_nit()`) |
| `departamento` | string | Geographic normalization, map |
| `municipio` | string | Geographic normalization |
| `proveedor_adjudicado` | string | Provider name (display) |
| `nit_proveedor` | string | Provider identifier (clean via `clean_nit()`) |
| `objeto_del_contrato` | string | Feature 13 (description brevity) |
| `valor_contrato` | string→float | Features 1–7 |
| `valor_contrato_con_adiciones` | string→float | Feature 2 |
| `valor_de_pago_adelantado` | string→float | Feature 3 |
| `modalidad_de_contratacion` | string | Features 9, 12; entity-modality grouping |
| `tipo_de_contrato` | string | Context |
| `codigo_unspsc` | string | Feature 6 (UNSPSC benchmark) |
| `fecha_firma` | string→date | Features 4, 10, 20–23 |
| `fecha_de_inicio_del_contrato` | string→date | Feature 10 |
| `fecha_de_fin_del_contrato` | string→date | Features 4, 10 |
| `fecha_publicacion_proceso` | string→date | Feature 11 |
| `numero_de_ofertantes` | string→int | Features 8, 12 |
| `estado_contrato` | string | Context filter |
| `:updated_at` | system | Incremental pull filter (NEVER stored in Parquet) |

### Incremental Pull SoQL Pattern
```
GET /resource/jbjy-vk9h.json
Headers: X-App-Token: {SOCRATA_APP_TOKEN}
Params:
  $where=:updated_at > '2025-11-01T14:30:00.000'
  $limit=50000
  $offset=0   (increment by 50000 until response < 50000)
```

### Backfill SoQL Pattern (historical, by month)
```
$where=fecha_firma >= '2023-01-01T00:00:00.000' AND fecha_firma < '2023-02-01T00:00:00.000'
$limit=50000
$order=fecha_firma ASC
```

---

## Supabase Storage Layout

```
Bucket: veeduria-processed
│
├── secop_contratos/
│   ├── 2023-01.parquet    (backfill)
│   ├── 2023-02.parquet
│   ├── ...
│   └── 2026-03.parquet    (current month, overwritten each run)
│
└── models/
    ├── model_20260315.joblib       (gitignored, in Supabase only)
    ├── scaler_20260315.joblib      (gitignored, in Supabase only)
    └── model_20260315_metadata.json  (ALSO committed to git)
```

**Download pattern in app:**
```python
# Load latest month's Parquet from Supabase
url = last_run["secop_contratos"]["parquet_url"]
df = pd.read_parquet(url)  # pyarrow supports HTTP URLs directly
```

---

## `data/reference/ungrd_cases.json` — Required Schema

```json
{
  "_comment": "Known reference cases for Isolation Forest validation",
  "cases": [
    {
      "id": "ungrd_carrotanques",
      "label_es": "UNGRD carrotanques La Guajira",
      "label_en": "UNGRD water tanker trucks La Guajira",
      "nit_entidad": "839000737",
      "object_keywords": ["CARROTANQUE", "CARRO TANQUE", "AGUA POTABLE", "SUMINISTRO AGUA"],
      "fecha_firma_range": ["2020-01-01", "2022-12-31"],
      "expected_features": {
        "advance_payment_ratio": 0.50,
        "price_ratio_vs_entity_median": 1.54,
        "single_bidder": 1
      },
      "expected_risk_score_min": 0.70,
      "source": "Contraloría General de la República, Hallazgo 2021"
    },
    {
      "id": "manizales_directos",
      "label_es": "Manizales 132 contratos directos pre-Ley de Garantías",
      "label_en": "Manizales 132 direct contracts pre-Ley de Garantías",
      "nit_entidad": "890805765",
      "modalidad": "CONTRATACION DIRECTA",
      "fecha_firma_range": ["2021-11-01", "2022-01-31"],
      "expected_features": {
        "is_direct_award": 1,
        "ley_garantias_period": 1,
        "repeat_provider_flag": 1
      },
      "expected_risk_score_min": 0.70,
      "source": "Contraloría Municipal de Manizales, Auditoría 2022"
    },
    {
      "id": "pasaportes_colombia",
      "label_es": "Pasaportes Colombia contratación irregular",
      "label_en": "Colombia Passport Office irregular contracting",
      "nit_entidad_options": ["800141955", "839000388"],
      "object_keywords": ["PASAPORTE", "LIBRETA PASAPORTE", "EXPEDICION PASAPORTES"],
      "fecha_firma_range": ["2022-01-01", "2023-12-31"],
      "expected_features": {
        "value_concentration_gini": 0.9,
        "provider_value_share_entity": 0.85,
        "single_bidder": 1
      },
      "expected_risk_score_min": 0.70,
      "source": "Procuraduría General, Investigación 2023"
    }
  ]
}
```

---

## `data/reference/electoral_calendar.json` — Required Schema

```json
{
  "_comment": "2025-2026 Colombian electoral calendar for anomaly window features",
  "events": [
    {
      "id": "ley_garantias_convenios",
      "date": "2025-11-08",
      "label_es": "Restricción convenios interadministrativos (Ley de Garantías)",
      "label_en": "Interadministrative agreement restriction (Ley de Garantías)",
      "window_days": 90,
      "restricted_modalities": ["CONVENIO INTERADMINISTRATIVO"]
    },
    {
      "id": "ley_garantias_directa",
      "date": "2026-01-31",
      "label_es": "Restricción contratación directa (Ley de Garantías)",
      "label_en": "Direct award restriction (Ley de Garantías)",
      "window_days": 90,
      "restricted_modalities": ["CONTRATACION DIRECTA"]
    },
    {
      "id": "elecciones_legislativas",
      "date": "2026-03-08",
      "label_es": "Elecciones legislativas Colombia 2026",
      "label_en": "Colombia 2026 Legislative Elections",
      "window_days": 90,
      "restricted_modalities": []
    },
    {
      "id": "elecciones_presidenciales",
      "date": "2026-05-31",
      "label_es": "Elecciones presidenciales Colombia 2026",
      "label_en": "Colombia 2026 Presidential Elections",
      "window_days": 90,
      "restricted_modalities": []
    }
  ]
}
```

---

## i18n Key Schema (Minimum for Phase 1)

Both `i18n/es.json` and `i18n/en.json` must have identical key sets.

```
UI chrome
  page_title
  tagline
  methodology_tab

Sidebar
  filter_lang
  filter_dept
  filter_entidad
  filter_modalidad
  filter_dates
  filter_valor
  filter_semaforo
  apply_filters
  last_updated
  staleness_warning      (has {hours} placeholder)
  staleness_info         (has {hours} placeholder)

KPI section
  kpi_total_contracts
  kpi_red_flags
  kpi_value_at_risk
  kpi_top_entity

Map section
  map_title
  map_tooltip_dept
  map_tooltip_avg_risk
  map_tooltip_count

Table section
  table_title
  col_semaforo
  col_entidad
  col_proveedor
  col_valor
  col_modalidad
  col_fecha_firma
  col_depto
  col_risk_score

Detail panel
  detail_title
  secop_link_label
  shap_chart_title
  methodology_title

Risk labels
  risk_rojo
  risk_amarillo
  risk_verde
  risk_score_label       (has {score} placeholder)

SHAP factor labels (one per feature)
  feat_log_valor_contrato
  feat_value_vs_additions_ratio
  feat_advance_payment_ratio
  feat_log_value_per_day
  feat_price_ratio_vs_entity_median
  feat_price_ratio_vs_unspsc_median
  feat_value_concentration_gini
  feat_single_bidder
  feat_is_direct_award
  feat_duration_days
  feat_days_pub_to_award
  feat_normalized_ofertantes
  feat_object_description_brevity
  feat_provider_contract_count_entity
  feat_provider_value_share_entity
  feat_provider_entity_diversity
  feat_provider_age_months
  feat_provider_modality_mix
  feat_repeat_provider_flag
  feat_electoral_window
  feat_ley_garantias_period
  feat_fiscal_year_end_rush
  feat_days_since_last_contract_entity
  feat_provider_degree
  feat_entity_provider_herfindahl

Explanation templates
  explanation_template    (has {n}, {factor1}, {factor2}, {factor3}, {score} placeholders)
  direction_increases_risk
  direction_decreases_risk

Ethical disclaimer
  ethical_disclaimer      (full disclaimer text)

Error messages
  error_loading_data
  error_model_unavailable
  error_no_results

Methodology content
  methodology_model_name
  methodology_training_data
  methodology_contamination
  methodology_validation_results
  methodology_false_positive_note
  methodology_data_source_link
```

---

## Decisions Already Made

| Decision | Choice | Rationale |
|---|---|---|
| ML model | IsolationForest(contamination=0.05) | Unsupervised, no labeled data available |
| Scaler | RobustScaler | SECOP contract values are heavily right-skewed |
| SHAP | TreeExplainer (not KernelExplainer) | 100ms vs 10s per sample |
| Risk threshold | ≥0.70 red, 0.40–0.69 yellow, <0.40 green | Calibrated to ~5% red flag rate |
| Storage | Supabase Storage (Parquet) | Streamlit Cloud can't persist files between sessions |
| Incremental pull | `:updated_at` SoQL field | Catches all modifications, not just inserts |
| Backfill partitioning | `fecha_firma` monthly slices | Semantically correct for historical data |
| Geographic normalization | API Colombia + Levenshtein distance ≤2 | Handles SECOP's inconsistent spelling |
| Entity name normalization | Uppercase + NFKD accent strip | Colombian entities use inconsistent accent usage |

## Open Decision (awaiting user input)

**Rolling window for group-relative features:**
- Option A: 12 months uniform
- Option B: 3 years (full training window)
- **Option C (recommended):** 12 months for provider features, 24 months for entity features
