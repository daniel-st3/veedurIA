# CLAUDE.md — VeedurIA Project Instructions

> This file is read automatically by Claude Code at session start.
> All rules below are binding for every code change in this repository.

---

## SECTION 1 — Project Identity

**VeedurIA** is Colombia's first AI-powered civic transparency platform for live public
procurement and electoral accountability. It is a 3-phase Streamlit multi-page application.

- **Phase 1 — ContratoLimpio** ← *Active development target*
  ML risk semaphore (red/yellow/green) on live contracts from SECOP II via Socrata SODA API.
  Uses Isolation Forest + SHAP explanations.

- **Phase 2 — SigueElDinero**
  Cross-references campaign donors (Cuentas Claras) with SECOP II contractors.
  Graph network visualization using Plotly.

- **Phase 3 — PromesóMetro**
  NLP tracking of electoral promises vs. legislative actions.
  BETO NER + BERTopic + semantic similarity.

**Stack:** Python 3.11+, Streamlit, scikit-learn, SHAP, NetworkX, Folium, Transformers.
**Infrastructure:** $0/month — Streamlit Community Cloud + GitHub Actions + datos.gov.co open APIs.
**Languages:** Bilingual ES/EN throughout (UI, alerts, disclaimers).

---

## SECTION 2 — Critical Rules (non-negotiable)

### Language / Framing
- **NEVER** use the words `corrupción confirmada`, `fraude`, `ilegal` in any UI text,
  code comments, variable names, or log messages.
- **ALWAYS** use: `anomalía detectada`, `patrón atípico`, `bandera de riesgo`,
  `alerta preventiva`, `indicador de riesgo`.

### Git Discipline
- **NEVER** commit to git until tests pass for the modified module.
  Run `pytest tests/` before any commit touching `src/` or `pages/`.

### Data Ingestion
- **NEVER** download the full SECOP dataset.
  Always use incremental pulls via `:updated_at` SoQL field.
  Pattern: `SELECT * WHERE :updated_at > '[LAST_RUN_TIMESTAMP]' LIMIT 50000`

### Secrets
- **NEVER** hardcode API keys, tokens, or credentials anywhere in source code.
  Use `st.secrets["KEY"]` in Streamlit Cloud production.
  Use `.env` + `python-dotenv` for local development.
  Reference `.env.example` for the full list of required secrets.

### ML Explainability
- **Every** ML prediction MUST include a SHAP explanation.
  No score may be displayed in the UI without its corresponding SHAP top factors.

### UI Alert Cards
Every alert/contract card rendered in the UI **MUST** include all of:
1. Risk score (float 0.0–1.0) + semaphore color
2. Top 5 SHAP feature contributions
3. Direct link to the SECOP process URL
4. Ethical disclaimer text (in the active language — see `data-ethics.md`)

### Scraper Etiquette
- Rate-limit the Cuentas Claras scraper: **max 1 request per 5 seconds**.
- Only run the scraper between **2:00 AM – 5:00 AM Colombia time (UTC-5)**.
- Never bypass this restriction in any automation or manual run.

---

## SECTION 3 — Architecture

```
app.py                          ← Streamlit entry point (home/landing page)
pages/
  1_ContratoLimpio.py           ← Phase 1 UI
  2_SigueElDinero.py            ← Phase 2 UI
  3_PromesometroNLP.py          ← Phase 3 UI
src/                            ← All business logic (never import page→page)
  ingestion/                    ← Data fetching from external APIs/scrapers
  processing/                   ← Feature engineering, entity resolution, graphs
  models/                       ← ML training, SHAP, validation
  ui/                           ← Reusable Streamlit components
  utils/                        ← Config, logging, rate limiting
data/
  raw/                          ← Gitignored; temporary downloads only
  processed/                    ← Gitignored; Parquet files live in Supabase Storage
  reference/                    ← Static JSON reference files (committed, < 1MB each)
i18n/
  es.json                       ← Spanish UI strings
  en.json                       ← English UI strings
tests/                          ← pytest test suite
.github/workflows/              ← GitHub Actions (ingestion cron, model refresh)
```

**Import rule:** Pages import only from `src/`. Never cross-import between `pages/`.

**Data storage rule:**
- Processed Parquet files live in **Supabase Storage**, bucket `veeduria-processed`.
- GitHub repo stores only: code, `_metadata.json` files, model validation results,
  and static reference data < 1MB.
- GitHub Actions ingestion workflow uploads Parquet outputs to Supabase Storage
  after each run — it does NOT commit data files to git.
- Read Parquet in the app via supabase-py signed URLs or the Supabase Storage public URL.
- `data/processed/` on disk is a local working directory only (gitignored).

**Secrets rule:**
- Production: `st.secrets["KEY_NAME"]`
- Local: `os.getenv("KEY_NAME")` via `python-dotenv` loading `.env`
- Always go through `src/utils/config.py` — never call secrets directly in pages.

**i18n rule:**
```python
st.session_state.setdefault("lang", "es")
t = load_translations(st.session_state["lang"])  # from src/ui/i18n.py
```

---

## SECTION 4 — Key Data Sources (exact endpoints)

| Dataset | URL |
|---|---|
| SECOP II Contratos Electrónicos | `https://www.datos.gov.co/resource/jbjy-vk9h.json` |
| SECOP II Procesos Contratación | `https://www.datos.gov.co/resource/p6dx-8zbt.json` |
| SECOP II Adiciones | `https://www.datos.gov.co/resource/cb9c-h8sn.json` |
| SECOP II Proveedores | `https://www.datos.gov.co/resource/qmzu-gj57.json` |
| TVEC Tienda Virtual Estado | `https://www.datos.gov.co/resource/rgxm-mmea.json` |
| SIRI Procuraduría antecedentes | `https://www.datos.gov.co/resource/iaeu-rcn6.json` |
| API Colombia — Departments | `https://api-colombia.com/api/v1/Department` |
| API Colombia — Cities | `https://api-colombia.com/api/v1/City` |
| Cuentas Claras (scraping only) | `https://app.cnecuentasclaras.gov.co/` |
| Registraduría históricos | `https://observatorio.registraduria.gov.co/views/electoral/historicos-resultados.php` |

**Authentication:** All datos.gov.co calls must include the `X-App-Token` header.
Never embed the token in the URL query string.

---

## SECTION 5 — SECOP Incremental Pull Pattern

Always use this SoQL pattern — never fetch all rows:

```
GET https://www.datos.gov.co/resource/jbjy-vk9h.json
Headers:
  X-App-Token: {SOCRATA_APP_TOKEN}
Query params:
  $where=:updated_at > '{LAST_RUN_TIMESTAMP}'
  $limit=50000
  $offset=0   ← increment by 50000 until response length < 50000
```

- Store `LAST_RUN_TIMESTAMP` in `/data/processed/last_run.json` after each successful run.
- If response length == 50000, loop with `$offset += 50000` to paginate.
- Timestamp format: ISO 8601 UTC (`2025-01-15T08:00:00.000`).

---

## SECTION 6 — ML Standards

**Model:** `IsolationForest(contamination=0.05, n_estimators=100, random_state=42)`

**Training data:** SECOP contracts 2023–2025 (baseline corpus).

**Feature scaling:** Use `RobustScaler` (preferred over StandardScaler for procurement
data — highly skewed contract value distributions).

**SHAP:** Always use `shap.TreeExplainer`. Never use `KernelExplainer` (too slow for
production latency requirements).

**Risk score mapping:**

| Score | Semaphore | Label |
|---|---|---|
| ≥ 0.70 | 🔴 Rojo | Alerta preventiva alta |
| 0.40 – 0.69 | 🟡 Amarillo | Patrón atípico moderado |
| < 0.40 | 🟢 Verde | Sin banderas de riesgo |

**Model artifacts:** Save as `.joblib` in `/data/processed/models/`.
Every `.joblib` file MUST have a companion `_metadata.json` with:
```json
{
  "training_date": "YYYY-MM-DD",
  "n_samples": 0,
  "feature_list": [],
  "validation_scores": {},
  "contamination_param": 0.05
}
```

**Validation (mandatory before any deployment):**
Model must flag at least 2 of these 3 known reference cases:
1. UNGRD carrotanques La Guajira (54% sobreprecio documentado)
2. Manizales — 132 contratos directos pre-Ley de Garantías
3. Pasaportes Colombia — contratación irregular

If validation fails (< 2 of 3 flagged), the model must **NOT** be deployed.
Run validation with: `python -m src.models.model_validator`

---

## SECTION 7 — Key 2026 Electoral Dates

These dates define "ventanas electorales" (electoral windows) used as features and
as contextual filters in anomaly analysis:

| Date | Event |
|---|---|
| **Nov 8, 2025** | Restricción de convenios interadministrativos (Ley de Garantías) |
| **Jan 31, 2026** | Restricción de contratación directa (Ley de Garantías) |
| **Mar 8, 2026** | Elecciones legislativas Colombia |
| **May 31, 2026** | Elecciones presidenciales Colombia |

Contracts signed within 90 days before an electoral date receive an automatic
`electoral_window` flag as an additional risk feature input.

---

## SECTION 8 — Dev Commands

```bash
# Run app locally
streamlit run app.py

# Run full test suite (required before any commit)
pytest tests/

# Manual incremental ingestion from SECOP
python -m src.ingestion.secop_client --mode=incremental

# Retrain Isolation Forest model
python -m src.models.isolation_forest --action=train

# Validate model against known reference cases
python -m src.models.model_validator
```

---

## SECTION 9 — Active Development Phase

```
Currently building:  PHASE 1 — ContratoLimpio
Active module:       pages/1_ContratoLimpio.py
Current sprint:      ETL pipeline + Feature Engineering
Next milestone:      Isolation Forest model trained on 2024–2025 SECOP data
```

Do not touch Phase 2 or Phase 3 modules until Phase 1 milestone is complete
and validated.

---

## SECTION 10 — Referent Projects

These projects are references for inspiration and benchmarking — do not copy code:

| Project | Country | Key Stats | Our Benchmark |
|---|---|---|---|
| **VIGIA** (Paraguay) | Paraguay | Semaphore ML on OCDS data | 91% precision (our target) |
| **Alice** (CGU Brasil) | Brazil | ML-guided audits | 30% reduction in losses |
| **QuiénEsQuién.wiki** | Mexico | 4M contracts × 227K companies graph | Scale target for Phase 2 |
