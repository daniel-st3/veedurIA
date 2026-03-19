# Phase 1 — ContratoLimpio Runbook

> **Last updated:** 2026-03-11
> **Goal:** Run the full ETL → Model → Dashboard pipeline locally, then deploy to Streamlit Cloud.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Python 3.11+ | Tested with 3.11 and 3.12 |
| `.env` file at project root | Must contain all 7 keys from `.env.example` |
| Git repo cloned | Working directory: `veeduria/` |

### .env file template

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
# Then edit .env with your real values
```

Required keys (see `.env.example` for descriptions):

```env
SOCRATA_APP_TOKEN=
SOCRATA_CLIENT_ID=
SOCRATA_CLIENT_SECRET=
SOCRATA_APP_SECRET=
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_STORAGE_BUCKET=veeduria-processed
```

Verify config before proceeding:

```bash
python dev/check_config_env.py
```

---

## Step 1 — Install Dependencies

```bash
pip install -r requirements-phase1.txt
```

Verify the install succeeded:

```bash
python -c "import sodapy, pandas, sklearn, joblib, plotly, folium, streamlit; print('All deps OK')"
```

---

## Step 2 — Run SECOP Backfill (Historical Data)

Fetches contracts from 2023-01-01 through today, one month at a time.
This can take **10–30 minutes** depending on SECOP API response times.

```bash
python -m src.ingestion.secop_client --mode=backfill
```

**What it does:**
- Fetches data from SECOP II (Socrata API) in monthly slices
- Normalizes NITs, names, dates, and numeric values
- Writes Parquet files to `data/processed/secop_contratos_YYYYMMDD_HHMMSS.parquet`
- Uploads each Parquet to Supabase Storage bucket `veeduria-processed`
- Updates `data/processed/last_run.json` atomically

**Verify it worked:**

```bash
ls -lh data/processed/*.parquet
cat data/processed/last_run.json
```

You should see one or more `.parquet` files and `last_run.json` with a non-null `last_updated_at`.

---

## Step 3 — Run SECOP Incremental Update

Fetches only contracts modified since the last run.

```bash
python -m src.ingestion.secop_client --mode=incremental
```

**Verify:**

```bash
cat data/processed/last_run.json
# last_run_ts should be updated to ~now
```

---

## Step 4 — Train the Isolation Forest Model

Reads all `data/processed/secop_contratos_*.parquet` files, builds the 25
features, and trains the Isolation Forest (contamination=0.05, 200 trees).

```bash
python -m src.models.isolation_forest --action=train
```

**Output:**
- `data/processed/models/isolation_forest_<timestamp>.joblib`
- `data/processed/models/isolation_forest_<timestamp>_metadata.json`

**Verify:**

```bash
ls -lh data/processed/models/
```

---

## Step 5 — Validate the Model

Tests the trained model against 3 reference corruption cases (UNGRD
carrotanques, Manizales direct awards, Cancillería passports). Exits
with code 1 (fails CI) if fewer than 2 of 3 cases score ≥ 0.70.

```bash
python -m src.models.model_validator
```

**Output:**
- `data/processed/models/validation_results.json`

**Verify:**

```bash
cat data/processed/models/validation_results.json | python -m json.tool
# Check: "overall_pass": true
```

---

## Step 6 — Score Contracts

Loads the latest trained model and scores all contracts with risk labels
(risk_rojo / risk_amarillo / risk_verde).

```bash
python -m src.models.isolation_forest --action=score
```

**Output:**
- `data/processed/scored_contracts.parquet`

---

## Step 7 — Run Full Test Suite

```bash
# Standard run
pytest tests/ -v

# With coverage report
pytest --cov=src tests/
```

**Expected:** 38+ passed, 2 skipped (SHAP tests skip if `shap` is not
installed — will pass in CI with full deps).

**Coverage target:** ≥ 70% of `src/`.

---

## Step 8 — Launch Local Streamlit App

```bash
streamlit run app.py
```

Opens at `http://localhost:8501`. Check:

- [ ] Landing page loads with 3-phase roadmap cards
- [ ] Language toggle (ES ↔ EN) works
- [ ] Navigate to **ContratoLimpio** page
- [ ] KPIs section shows contract counts and red flag count
- [ ] Choropleth map renders Colombia departments with YlOrRd colors
- [ ] Contracts table loads with sortable columns
- [ ] Clicking a table row shows the detail panel with risk card
- [ ] Ethical disclaimer is visible at the bottom
- [ ] Sidebar filters (department, entity, modality, risk) work

---

## Quick All-In-One

If you want to run the entire pipeline in one go (sequential):

```bash
pip install -r requirements-phase1.txt \
  && python -m src.ingestion.secop_client --mode=backfill \
  && python -m src.ingestion.secop_client --mode=incremental \
  && python -m src.models.isolation_forest --action=train \
  && python -m src.models.model_validator \
  && python -m src.models.isolation_forest --action=score \
  && pytest tests/ -v \
  && streamlit run app.py
```

---

## Deployment to Streamlit Community Cloud

### Secrets to Configure

In Streamlit Cloud → App Settings → Secrets, add (TOML format):

```toml
SOCRATA_APP_TOKEN = "..."
SOCRATA_CLIENT_ID = "..."
SOCRATA_CLIENT_SECRET = "..."
SOCRATA_APP_SECRET = "..."
SUPABASE_URL = "..."
SUPABASE_KEY = "..."
SUPABASE_STORAGE_BUCKET = "veeduria-processed"
```

These match the variables in `.env.example`.

### Deploy Checklist

- [ ] **Main file:** Set to `app.py`
- [ ] **Python version:** 3.11
- [ ] **Requirements file:** Point to `requirements-phase1.txt`
- [ ] **Secrets configured:** `SOCRATA_APP_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY`
- [ ] **GitHub repo connected:** Ensure the repo is linked to Streamlit Cloud
- [ ] **Initial data load:** Before the first deploy, ensure
  `data/processed/scored_contracts.parquet` exists (run steps 2–6 locally
  or trigger the GitHub Actions `SECOP Incremental Ingestion` workflow once)
- [ ] **Trigger ingestion workflow:** Go to GitHub → Actions → "SECOP
  Incremental Ingestion" → Run workflow (select `backfill` for first run)
- [ ] **Trigger model training workflow:** Go to GitHub → Actions → "Weekly
  Model Retraining" → Run workflow
- [ ] **Verify live app:** Open the Streamlit Cloud URL and confirm:
  - Landing page renders
  - ContratoLimpio page loads with data
  - Risk semaphores (🔴🟡🟢) are visible
  - Map renders Colombia departments
  - Ethical disclaimer is present

### GitHub Actions Secrets

For the CI/CD workflows to run, add these as repository secrets in
GitHub → Settings → Secrets and variables → Actions:

| Secret name | Description |
|---|---|
| `SOCRATA_APP_TOKEN` | Socrata API app token for SECOP II |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon key |
| `PAT_CONTENTS_WRITE` | GitHub PAT with `contents:write` scope (for committing `last_run.json`) |

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `ModuleNotFoundError: sodapy` | Run `pip install -r requirements-phase1.txt` |
| `SOCRATA_APP_TOKEN not set` | Create `.env` file or set environment variable |
| Backfill hangs or 504 errors | SECOP API may be slow — the retry logic will handle transient failures. Wait and retry. |
| `No Parquet files found` | Run the backfill (step 2) before training the model |
| `FileNotFoundError: No model artifacts` | Run model training (step 4) before scoring (step 6) |
| Map doesn't show colors | Ensure `scored_contracts.parquet` has `departamento` and `risk_score` columns |
| Staleness warning in sidebar | Data is >4 hours old — run incremental ingestion (step 3) |

---

## Secrets Summary

> **⚠️ Never commit `.env` or any secret values to git.**
> The `.gitignore` already excludes `.env`, `.env.local`, and `.streamlit/secrets.toml`.

### a) Local `.env` (all 7 keys)

| Key | Required for |
|---|---|
| `SOCRATA_APP_TOKEN` | SECOP II API access (rate limit boost) |
| `SOCRATA_CLIENT_ID` | OAuth2 client ID (future high-volume flows) |
| `SOCRATA_CLIENT_SECRET` | OAuth2 client secret |
| `SOCRATA_APP_SECRET` | App secret token |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon public key |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name (default: `veeduria-processed`) |

### b) Streamlit Cloud secrets (same 7 keys, TOML format)

| Key | Notes |
|---|---|
| `SOCRATA_APP_TOKEN` | Same value as local |
| `SOCRATA_CLIENT_ID` | Same value as local |
| `SOCRATA_CLIENT_SECRET` | Same value as local |
| `SOCRATA_APP_SECRET` | Same value as local |
| `SUPABASE_URL` | Same value as local |
| `SUPABASE_KEY` | Same value as local |
| `SUPABASE_STORAGE_BUCKET` | `veeduria-processed` |

### c) GitHub Actions secrets (4 keys)

| Key | Notes |
|---|---|
| `SOCRATA_APP_TOKEN` | Used by ingestion workflow |
| `SUPABASE_URL` | Used by ingestion workflow |
| `SUPABASE_KEY` | Used by ingestion workflow |
| `PAT_CONTENTS_WRITE` | GitHub PAT with `contents:write` — used to commit `last_run.json` |
