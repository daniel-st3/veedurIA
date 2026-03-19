# Phase 1 — ContratoLimpio: 6-Week Sprint Plan

> **Deadline:** Live before May 31, 2026 (Colombian presidential elections)
> **Sprint window:** March 10 – April 20, 2026 (6 weeks + 5-week buffer)

---

## Week 1 (Mar 10–16): Foundation

**Goal:** Make the repo importable, add structured logging and rate limiting, implement the Socrata client.

### Deliverables

| File | What to implement |
|---|---|
| `src/__init__.py` + all subdirs | Empty files — required for `from src.x import y` to work |
| `tests/__init__.py` | Empty — required for pytest discovery |
| `src/utils/logger.py` | `get_logger(name: str) → logging.Logger` with JSON-line formatter; `log_etl_event()` structured helper |
| `src/utils/rate_limiter.py` | `TokenBucketRateLimiter(rate, capacity)` + `acquire()`; `get_secop_limiter()` (0.5 req/s, burst=5); `get_scraper_limiter()` (0.2 req/s, burst=1) |
| `src/ingestion/secop_client.py` | Implement `build_client()` → `sodapy.Socrata(domain, token, timeout=30)` and `fetch_incremental()` with pagination loop |
| `src/ingestion/api_colombia_client.py` | `get_canonical_departments()`, `get_canonical_cities()`, `fuzzy_lookup()` with `@st.cache_data(ttl=86400)` |
| `data/reference/electoral_calendar.json` | Populate 4 events (Nov 8 2025, Jan 31 2026, Mar 8 2026, May 31 2026) |

### Tests: `tests/test_secop_client.py`
1. `test_build_client_returns_socrata_instance`
2. `test_fetch_incremental_single_page`
3. `test_fetch_incremental_pagination` (50000 rows → 200 rows)
4. `test_fetch_incremental_empty_response`
5. `test_soql_where_clause_contains_updated_at`
6. `test_app_token_in_header_not_url`

### Definition of Done
- `pytest tests/test_secop_client.py` → 6 passes, 0 failures
- `python -m src.ingestion.secop_client --mode=incremental` runs (logs "not yet implemented" cleanly)
- `python -c "from src.utils.logger import get_logger; get_logger('t').info('ok')"` → JSON line printed
- All `__init__.py` files exist

---

## Week 2 (Mar 17–23): ETL Pipeline

**Goal:** Historical backfill for 2023–2025, atomic `last_run.json`, Supabase upload, CI workflow wired.

### Deliverables

| File | What to implement |
|---|---|
| `src/ingestion/secop_client.py` | `main()` full implementation; `load_last_run()`; `save_last_run()` (atomic via `.tmp` + `os.replace`); backfill mode (monthly date-slice loop) |
| `src/processing/entity_resolution.py` | Move `clean_nit()` here; add `normalize_name()` (uppercase + strip accents via `unicodedata.normalize`) |
| `data/processed/last_run.json` | Initial file with schema (committed to git) |
| `data/processed/.gitkeep` | So git tracks empty dir |
| `data/processed/models/.gitkeep` | So git tracks empty dir |
| `data/reference/ungrd_cases.json` | Populate 3 reference cases with SECOP filter criteria |
| `.github/workflows/secop_ingestion.yml` | Replace echo stub; add Supabase secrets; add `git commit last_run.json` step |
| `requirements-phase1.txt` | Add `numpy==2.1.3` explicitly |

### `last_run.json` Schema
```json
{
  "_schema_version": "1.0",
  "_last_modified": "ISO8601-UTC-with-Z",
  "secop_contratos": {
    "last_updated_at": "ISO8601-UTC-without-Z",
    "last_run_status": "success|partial_failure|never_run",
    "last_run_ts": "ISO8601-UTC-with-Z or null",
    "rows_fetched": 0,
    "rows_written": 0,
    "parquet_url": "https://... or null",
    "parquet_key": "secop_contratos/YYYY-MM.parquet or null",
    "error": "null or short error string"
  }
}
```

**Atomic save pattern:** `write to path.tmp` → `os.fsync` → `os.replace(path.tmp, path)`

### Tests (add to `tests/test_secop_client.py`)
7. `test_load_last_run_missing_file_returns_defaults`
8. `test_save_last_run_atomic` (tmp file gone after save)
9. `test_save_last_run_no_corruption_on_exception`
10. `test_upload_parquet_to_supabase_calls_upsert`

### Definition of Done
- `python -m src.ingestion.secop_client --mode=backfill` → Parquet in Supabase, `last_run.json` updated
- GitHub Actions `secop_ingestion.yml` → green on manual dispatch
- `pytest tests/test_secop_client.py` → 10 passes

---

## Week 3 (Mar 24–30): Feature Engineering

**Goal:** All 25 features implemented and tested.

### Deliverables

| File | What to implement |
|---|---|
| `src/processing/feature_engineering.py` | `build_features(df) → pd.DataFrame` (25 features); `compute_entity_aggregates(df)`; `load_features_from_parquet(url)` |

### The 25 Features (see `context.md` for full detail)

**Group A — Price/Value (7):** `log_valor_contrato`, `value_vs_additions_ratio`, `advance_payment_ratio`, `log_value_per_day`, `price_ratio_vs_entity_median`, `price_ratio_vs_unspsc_median`, `value_concentration_gini`

**Group B — Process Structure (6):** `single_bidder`, `is_direct_award`, `duration_days`, `days_pub_to_award`, `normalized_ofertantes`, `object_description_brevity`

**Group C — Provider Behavior (6):** `provider_contract_count_entity`, `provider_value_share_entity`, `provider_entity_diversity`, `provider_age_months`, `provider_modality_mix`, `repeat_provider_flag`

**Group D — Temporal/Electoral (4):** `electoral_window`, `ley_garantias_period`, `fiscal_year_end_rush`, `days_since_last_contract_entity`

**Group E — Network Proxies (2):** `provider_degree`, `entity_provider_herfindahl`

### Tests: `tests/test_feature_engineering.py`
1. `test_build_features_returns_25_columns`
2. `test_no_nulls_in_feature_matrix`
3. `test_contract_value_log_is_positive`
4. `test_electoral_window_flag_binary`
5. `test_duration_days_non_negative`
6. `test_advance_payment_ratio_bounded` (0–1)
7. `test_single_bidder_flag_binary`
8. `test_required_raw_columns_missing_raises`
9. `test_entity_aggregates_shape`

### Definition of Done
- `pytest tests/test_feature_engineering.py` → 9 passes
- `build_features()` on 10K rows in < 5 seconds
- Zero nulls in feature matrix

---

## Week 4 (Mar 31–Apr 6): Model Training, SHAP, Validation

**Goal:** Isolation Forest trained, SHAP working, validation passes ≥ 2/3.

### Deliverables

| File | What to implement |
|---|---|
| `src/models/isolation_forest.py` | `train(X)`, `score(model, scaler, X)`, `save_artifacts()`, `load_latest_artifacts()`, CLI `main()` |
| `src/models/shap_explainer.py` | `explain(model, X, feature_names) → DataFrame`; `format_explanation(shap_row, lang, t) → list[dict]` |
| `src/models/model_validator.py` | `validate(model, scaler, fe_fn) → dict`; `run_validation_and_write()` |
| `.github/workflows/model_refresh.yml` | Real commands; Supabase secrets; validation gate (fail job if pass=False) |

### Model spec
```python
IsolationForest(contamination=0.05, n_estimators=100, random_state=42)
# Scaler: RobustScaler (fit on training data, transform on inference)
# Artifacts: data/processed/models/model_YYYYMMDD.joblib + _metadata.json
# Fallback: if <2/3 validation cases pass, lower contamination to 0.03 and retrain
```

### Tests: `tests/test_model.py`
1. `test_train_returns_fitted_model_and_scaler`
2. `test_risk_score_range` (all in [0.0, 1.0])
3. `test_risk_score_contamination_rate` (~5% ≥ 0.70 on synthetic data ±2%)
4. `test_shap_output_has_5_features_per_row`
5. `test_shap_absolute_values_descending`
6. `test_validation_returns_pass_field`
7. `test_metadata_json_written_after_save`
8. `test_metadata_json_contains_required_keys`
9. `test_validation_fail_blocks_deployment`

### Definition of Done
- `python -m src.models.isolation_forest --action=train` → artifacts in `data/processed/models/`
- `python -m src.models.model_validator` → ≥ 2/3 cases flagged (risk_score ≥ 0.70)
- `pytest tests/test_model.py` → 9 passes
- `model_refresh.yml` → green on manual dispatch

---

## Week 5 (Apr 7–13): Streamlit UI

**Goal:** Full ContratoLimpio page live locally.

### Deliverables

| File | What to implement |
|---|---|
| `src/ui/i18n.py` | `load_translations(lang)` with `@st.cache_data(ttl=0)` |
| `i18n/es.json` + `i18n/en.json` | All keys (see context.md for full key schema) |
| `src/ui/components.py` | `render_risk_card()`, `render_semaphore()`, `render_ethical_disclaimer()` |
| `src/ui/maps.py` | `build_choropleth(df_dept, geojson_path)` wrapped in `@st.fragment` |
| `data/reference/colombia_departments.geojson` | Simplified Colombia departments GeoJSON (< 500KB) |
| `pages/1_ContratoLimpio.py` | Full 4-section page (KPIs, map, table, detail panel) |
| `app.py` | Home/landing with 3 phase cards + language toggle |

### Tests (add to `tests/test_feature_engineering.py`)
- `test_load_translations_es_returns_dict`
- `test_load_translations_missing_lang_raises`
- `test_all_es_keys_present_in_en`

### Definition of Done
- `streamlit run app.py` → home page loads without errors
- ContratoLimpio renders all 4 sections with real data
- Language toggle switches all text ES ↔ EN
- Risk cards render: semaphore color, SHAP top 5, SECOP link, disclaimer

---

## Week 6 (Apr 14–20): Deployment + Buffer

**Goal:** Live on Streamlit Community Cloud. Buffer before May 31 deadline.

### Deliverables
- Deploy to Streamlit Community Cloud (requirements-phase1.txt, all secrets)
- Staleness indicator in sidebar (hours since last run, warning if > 4h)
- `tests/conftest.py` — shared fixtures (synthetic DataFrames, mock Socrata client)
- End-to-end test: UNGRD (NIT 839000737) → red-semaphore contracts visible
- `pytest --cov=src tests/` ≥ 70% line coverage

### Definition of Done
- Live URL on `*.streamlit.app` accessible
- At least one red-semaphore contract visible in production
- Both GitHub Actions workflows green
- `last_run.json` updates in repo within 20 min of each ingestion run
- `pytest tests/` → 0 failures

---

## Risk Register

| Risk | Week | Mitigation |
|---|---|---|
| sodapy timeout on paginated offsets | 1 | `timeout=30`, retry 3× with 2s/4s/8s backoff |
| `valor_contrato` null in ~15% of rows | 3 | Impute with entity-modality median; global fallback |
| Model fails validation (< 2/3 cases) | 4 | Lower `contamination` to 0.03, retrain |
| Streamlit Cloud memory limit (800MB) | 5-6 | `st.cache_resource()` for model; load only 30 columns from Parquet |
| GitHub Actions PAT expiry | 2+ | Fine-grained PAT, 1-year expiry, calendar reminder |
