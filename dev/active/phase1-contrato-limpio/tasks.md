# Phase 1 — ContratoLimpio: Ordered Task Checklist

> Each task = 1–4 hours of focused work. Check off as you go.
> Bold = blocking for next task. Italic = can be parallelized.

---

## Week 1: Foundation (Mar 10–16)

### Day 1–2: Package structure + logging + rate limiter
- [ ] **Create `src/__init__.py`** (empty)
- [ ] **Create `src/ingestion/__init__.py`** (empty)
- [ ] **Create `src/processing/__init__.py`** (empty)
- [ ] **Create `src/models/__init__.py`** (empty)
- [ ] **Create `src/ui/__init__.py`** (empty)
- [ ] **Create `src/utils/__init__.py`** (empty)
- [ ] **Create `tests/__init__.py`** (empty)
- [ ] **Implement `src/utils/logger.py`** — `get_logger()`, JSON formatter, `log_etl_event()`
- [ ] **Implement `src/utils/rate_limiter.py`** — `TokenBucketRateLimiter`, `get_secop_limiter()`, `get_scraper_limiter()`
- [ ] Verify `python -c "from src.utils.logger import get_logger; get_logger('t').info('ok')"` → JSON line

### Day 3–4: Socrata client
- [ ] **Implement `build_client()`** in `secop_client.py` — `sodapy.Socrata(domain, token, timeout=30)`
- [ ] **Implement `fetch_incremental()`** — pagination loop per etl-rules.md §1+3
- [ ] Implement `fetch_date_slice()` — for backfill (uses `fecha_firma` range, not `:updated_at`)
- [ ] Write test 1: `test_build_client_returns_socrata_instance`
- [ ] Write test 2: `test_fetch_incremental_single_page`
- [ ] Write test 3: `test_fetch_incremental_pagination`
- [ ] Write test 4: `test_fetch_incremental_empty_response`
- [ ] Write test 5: `test_soql_where_clause_contains_updated_at`
- [ ] Write test 6: `test_app_token_in_header_not_url`
- [ ] `pytest tests/test_secop_client.py` → 6 passes ✅

### Day 5: API Colombia + electoral calendar
- [ ] Implement `src/ingestion/api_colombia_client.py` — `get_canonical_departments()`, `get_canonical_cities()`, `fuzzy_lookup()`
- [ ] **Populate `data/reference/electoral_calendar.json`** — 4 events with schema from `context.md`
- [ ] Verify `python -c "from src.ingestion.api_colombia_client import get_canonical_cities; print(len(get_canonical_cities()))"` → ~1,100 cities

---

## Week 2: ETL Pipeline (Mar 17–23)

### Day 1–2: `last_run.json` + atomic save
- [ ] **Implement `load_last_run(path)`** — missing file returns default schema (timestamp = "1900-01-01T00:00:00.000")
- [ ] **Implement `save_last_run(state, path)`** — write to `.tmp`, `os.fsync`, `os.replace`
- [ ] **Create `data/processed/last_run.json`** — initial file with schema from `context.md`
- [ ] Create `data/processed/.gitkeep`
- [ ] Create `data/processed/models/.gitkeep`
- [ ] Write test 7: `test_load_last_run_missing_file_returns_defaults`
- [ ] Write test 8: `test_save_last_run_atomic`
- [ ] Write test 9: `test_save_last_run_no_corruption_on_exception`

### Day 3: Location normalization + NIT cleaning
- [ ] Move `clean_nit()` to `src/processing/entity_resolution.py`
- [ ] Implement `normalize_name()` — uppercase + `unicodedata.normalize('NFKD', ...)` + collapse whitespace
- [ ] Verify `clean_nit("890805765-1")` → `"890805765"` and `clean_nit("0890805765")` → `"890805765"` (leading zero stripped correctly? No — `zfill(9)` preserves 9 chars)

### Day 4–5: `main()` + backfill + Supabase upload
- [ ] **Implement `main()`** in `secop_client.py` — full incremental path
- [ ] **Implement backfill mode** — monthly loop over 2023-01 through current month
- [ ] Implement `upload_parquet_to_supabase()` (move from ETL rules example into `secop_client.py`)
- [ ] Write test 10: `test_upload_parquet_to_supabase_calls_upsert`
- [ ] `pytest tests/test_secop_client.py` → 10 passes ✅
- [ ] **Populate `data/reference/ungrd_cases.json`** — 3 reference cases with schema from `context.md`
- [ ] **Add `numpy==2.1.3`** to `requirements-phase1.txt`

### Day 5: CI workflow wiring
- [ ] Replace `echo` stub in `secop_ingestion.yml` with real command
- [ ] Add `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_STORAGE_BUCKET` to workflow env (from GitHub Secrets)
- [ ] Add `git commit data/processed/last_run.json` step (needs `GH_PAT` secret)
- [ ] Test: manual `workflow_dispatch` → green ✅

---

## Week 3: Feature Engineering (Mar 24–30)

### Day 1–2: Group A + B features (price + process)
- [ ] **Implement `compute_entity_aggregates(df)`** — entity-level stats needed for group-relative features
- [ ] Feature 1: `log_valor_contrato`
- [ ] Feature 2: `value_vs_additions_ratio`
- [ ] Feature 3: `advance_payment_ratio`
- [ ] Feature 4: `log_value_per_day`
- [ ] Feature 5: `price_ratio_vs_entity_median`
- [ ] Feature 6: `price_ratio_vs_unspsc_median`
- [ ] Feature 7: `value_concentration_gini`
- [ ] Feature 8: `single_bidder`
- [ ] Feature 9: `is_direct_award`
- [ ] Feature 10: `duration_days`
- [ ] Feature 11: `days_pub_to_award`
- [ ] Feature 12: `normalized_ofertantes`
- [ ] Feature 13: `object_description_brevity`

### Day 3–4: Group C + D + E features
- [ ] Feature 14: `provider_contract_count_entity`
- [ ] Feature 15: `provider_value_share_entity`
- [ ] Feature 16: `provider_entity_diversity`
- [ ] Feature 17: `provider_age_months`
- [ ] Feature 18: `provider_modality_mix` (Shannon entropy)
- [ ] Feature 19: `repeat_provider_flag`
- [ ] Feature 20: `electoral_window` (reads from `electoral_calendar.json`)
- [ ] Feature 21: `ley_garantias_period`
- [ ] Feature 22: `fiscal_year_end_rush`
- [ ] Feature 23: `days_since_last_contract_entity`
- [ ] Feature 24: `provider_degree`
- [ ] Feature 25: `entity_provider_herfindahl`
- [ ] Implement `load_features_from_parquet(url)` — downloads from Supabase, calls `build_features()`

### Day 5: Tests
- [ ] Write all 9 tests in `test_feature_engineering.py`
- [ ] `pytest tests/test_feature_engineering.py` → 9 passes ✅
- [ ] Run `build_features()` on 10K-row real SECOP sample → time < 5s, zero nulls

---

## Week 4: Model + SHAP + Validation (Mar 31–Apr 6)

### Day 1–2: Isolation Forest training
- [ ] **Implement `train(X)`** — fit RobustScaler on X, fit IsolationForest, return both
- [ ] **Implement `score(model, scaler, X)`** — normalize IsolationForest decision_function to [0, 1]
- [ ] **Implement `save_artifacts()`** — save `.joblib` files + `_metadata.json`
- [ ] **Implement `load_latest_artifacts()`** — reads latest metadata JSON, loads corresponding joblib from Supabase if not local
- [ ] Implement `main()` CLI — `--action=train` calls train → validate → save (conditionally)
- [ ] Test: `python -m src.models.isolation_forest --action=train` → artifacts in `data/processed/models/`

### Day 3: SHAP explainer
- [ ] **Implement `explain(model, X, feature_names)`** — `shap.TreeExplainer(model)`, top-5 per row
- [ ] **Implement `format_explanation(shap_row, lang, t)`** — returns list of `{feature_key, label, value, direction}` dicts
- [ ] Verify `shap.TreeExplainer(isolation_forest_instance)` works for shap==0.46.0

### Day 4: Model validator
- [ ] **Implement `validate(model, scaler, fe_fn)`** — loads `ungrd_cases.json`, filters real data OR uses synthetic fallback
- [ ] **Implement `run_validation_and_write()`** — writes results into `_metadata.json`
- [ ] `python -m src.models.model_validator` → ≥ 2/3 cases flagged ✅

### Day 5: Tests + CI wiring
- [ ] Write all 9 tests in `test_model.py`
- [ ] `pytest tests/test_model.py` → 9 passes ✅
- [ ] Replace echo stubs in `model_refresh.yml`
- [ ] Add validation gate step (fail Actions if `pass=False`)
- [ ] Test: manual `workflow_dispatch` on `model_refresh.yml` → green ✅

---

## Week 5: Streamlit UI (Apr 7–13)

### Day 1: i18n + components
- [ ] **Implement `src/ui/i18n.py`** — `load_translations(lang)` with `@st.cache_data(ttl=0)`
- [ ] **Populate `i18n/es.json`** — all keys from `context.md` key schema
- [ ] **Populate `i18n/en.json`** — all keys from `context.md` key schema
- [ ] Write translation tests (3 tests, add to `test_feature_engineering.py`)
- [ ] **Implement `render_semaphore(risk_score, t)`**
- [ ] **Implement `render_ethical_disclaimer(t)`**
- [ ] **Implement `render_risk_card(contract, lang, t)`** — full card with all required fields

### Day 2: Map + home page
- [ ] Download Colombia departments GeoJSON (simplified < 500KB) → `data/reference/colombia_departments.geojson`
- [ ] Add `!data/reference/colombia_departments.geojson` to `.gitignore` keep rules
- [ ] **Implement `src/ui/maps.py`** — `build_choropleth()` with `@st.fragment`
- [ ] **Implement `app.py`** — home/landing page (3 phase cards, language toggle)
- [ ] Verify `streamlit run app.py` loads without errors ✅

### Day 3–4: ContratoLimpio page
- [ ] **Section 1 KPIs** — total contracts, red flags, value at risk, top entity
- [ ] **Section 2 Map** — choropleth by avg risk per departamento
- [ ] **Section 3 Table** — sortable by risk_score, row selection for detail panel
- [ ] **Section 4 Detail Panel** — full risk card + SHAP bar chart + SECOP link + disclaimer + Metodología expander
- [ ] Sidebar filters (all in `st.form`) + staleness badge
- [ ] Language toggle → all text switches ✅
- [ ] No raw tracebacks visible in any error scenario ✅

### Day 5: Polish + mobile
- [ ] KPI section → 2×2 grid on narrow screens
- [ ] Map → conditional display
- [ ] Table → column reduction on narrow screens
- [ ] Verify all alert cards include: risk score, SHAP top 5, SECOP URL, ethical disclaimer ✅

---

## Week 6: Deployment + Buffer (Apr 14–20)

### Day 1: Deploy
- [ ] Connect repo to Streamlit Community Cloud
- [ ] Set `requirements-phase1.txt` as packages file
- [ ] Configure all secrets in Streamlit dashboard (SOCRATA_APP_TOKEN, SUPABASE_*, GITHUB_TOKEN)
- [ ] Verify cold start < 8 seconds

### Day 2–3: Integration testing
- [ ] End-to-end: search UNGRD (NIT 839000737) → red-semaphore contracts visible
- [ ] Verify staleness indicator updates within 20 min of ingestion run
- [ ] Verify language toggle works in deployed version
- [ ] Verify SECOP links open correct pages

### Day 4: Coverage + conftest
- [ ] Create `tests/conftest.py` — shared fixtures (synthetic DataFrames, mock Socrata client, mock Supabase client)
- [ ] Run `pytest --cov=src tests/` → ≥ 70% line coverage
- [ ] Fix any failing tests

### Day 5: Buffer / stabilization
- [ ] Monitor GitHub Actions for 48h (both workflows running on schedule)
- [ ] Fix any deployment issues
- [ ] Document any known limitations in Metodología tab
- [ ] **Phase 1 complete ✅ — 5+ weeks buffer before May 31 deadline**

---

## Post-Phase-1 Handoff to Phase 2

Before starting Phase 2 (SigueElDinero), confirm:
- [ ] All Phase 1 tests pass (`pytest tests/` → 0 failures)
- [ ] Coverage ≥ 70%
- [ ] Model validated (≥ 2/3 UNGRD cases)
- [ ] Live URL accessible
- [ ] Both GitHub Actions workflows stable for 1 week
- [ ] `last_run.json` up to date in repo
