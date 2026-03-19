# ETL Rules — VeedurIA

Rules for all data ingestion, transformation, and storage in this project.
Apply to every script in `src/ingestion/` and `src/processing/`.

---

## 1. Incremental Pulls Only — Never Full Dataset

```python
# ✅ Always use :updated_at filter
params = {
    "$where": f":updated_at > '{last_run_timestamp}'",
    "$limit": 50000,
    "$offset": 0
}

# ❌ Never do this
params = {"$limit": 1000000}
```

- Store the last successful run timestamp in `/data/processed/last_run.json`:
```json
{
  "secop_contratos": "2025-11-01T14:30:00.000",
  "secop_procesos": "2025-11-01T14:30:00.000"
}
```
- Update this file **only** after the Parquet write succeeds (not before, not during).
- If the run fails mid-way, the timestamp stays at the last successful state — next
  run will re-fetch the missed window. This is safe and preferred over data loss.

## 2. App Token — Mandatory Header

```python
headers = {
    "X-App-Token": config.get("SOCRATA_APP_TOKEN")
}
# ❌ Never in URL:
# url = "https://...?$$app_token=abc123"
```

- Register a free Socrata App Token at `https://data.socrata.com/profile/edit/developer_settings`
- Without the token, requests are rate-limited to ~10/hour per IP. With token: 1000/hour.
- Store as `SOCRATA_APP_TOKEN` in `.env` / `st.secrets`.

## 3. Pagination Pattern

```python
offset = 0
all_rows = []

while True:
    params["$offset"] = offset
    response = requests.get(url, headers=headers, params=params)
    rows = response.json()
    all_rows.extend(rows)

    if len(rows) < 50000:
        break  # Last page reached
    offset += 50000
```

- If `len(rows) == 50000`, there may be more pages. Always loop.
- If `len(rows) < 50000`, this was the last page. Stop.
- Log the total rows fetched per run for monitoring.

## 4. Geographic Normalization

All `departamento` and `municipio` fields from SECOP **must** be validated against the
canonical list from API Colombia before saving to Parquet:

```python
from src.ingestion.api_colombia_client import get_canonical_cities

canonical = get_canonical_cities()  # Returns dict: {raw_name: canonical_name}

def normalize_location(raw_name: str) -> tuple[str, str]:
    if raw_name in canonical:
        return canonical[raw_name], "ok"
    # Fuzzy fallback: try Levenshtein distance <= 2
    match = fuzzy_lookup(raw_name, canonical.keys(), max_distance=2)
    if match:
        return canonical[match], "fuzzy"
    return raw_name, "normalization_failed"
```

- If no match found: keep the original value, add flag `normalization_status = "normalization_failed"`.
- **Never drop rows** due to normalization failure — log and flag, then keep.
- Log all `normalization_failed` occurrences for manual review.

## 5. NIT Cleaning Pipeline

Apply this exact pipeline to all NIT/cédula fields:

```python
import re

def clean_nit(raw_nit: str) -> str:
    # 1. Strip all non-numeric characters (removes dashes, dots, check digits)
    digits_only = re.sub(r'\D', '', str(raw_nit))
    # 2. Remove verification digit (last digit after dash in Colombian NITs)
    #    After stripping non-numeric, we have base NIT without check digit already
    #    if the original had format "123456789-5" → "1234567895" → take first 9
    base_nit = digits_only[:9] if len(digits_only) > 9 else digits_only
    # 3. Left-pad to 9 digits
    return base_nit.zfill(9)
    # 4. Store as STRING — leading zeros are significant
```

- **Never** store NITs as integers — leading zeros will be lost.
- The output is always a 9-character zero-padded string.

## 6. Entity Resolution for Cross-Referencing

When matching contractors between SECOP and Cuentas Claras:

```python
# Step 1: Exact NIT match (highest confidence)
if secop_nit == cuentas_claras_nit:
    match_confidence = "exact_nit"

# Step 2: Fuzzy company name match (fallback)
elif levenshtein_distance(secop_name, cc_name) <= 2:
    match_confidence = "fuzzy_name"

# Step 3: No match
else:
    match_confidence = "no_match"
```

- Always store the `match_confidence` field: `"exact_nit"` | `"fuzzy_name"` | `"no_match"`.
- Use `python-Levenshtein` for performance (not `difflib` — too slow at scale).
- Normalize both names to uppercase, strip accents, and collapse whitespace before comparison.

## 7. Parquet Writing Rules

```python
import pyarrow as pa
import pyarrow.parquet as pq

# For datasets > 500k rows, partition by year_month (write to local first, then upload)
pq.write_to_dataset(
    table,
    root_path="data/processed/secop_contratos/",
    partition_cols=["year_month"],
    compression="snappy"
)

# For smaller datasets, single file
table.to_parquet(
    "data/processed/small_dataset.parquet",
    engine="pyarrow",
    compression="snappy"
)
```

- Always use `pyarrow` engine (not `fastparquet`).
- Always use `snappy` compression.
- Partition by `year_month` (format: `"2025-01"`) when dataset exceeds 500k rows.
- Write to local `data/processed/` first, then upload to Supabase Storage (see Section 10).
- Delete the local Parquet file after successful upload to keep the repo clean.

## 8. Raw Data is Gitignored

- `data/raw/` is gitignored. Use it for temporary downloads only.
- After processing and uploading to Supabase, delete both the raw file and the local Parquet.
- **Never** commit raw JSON/CSV downloads — they may contain unreviewed fields
  or exceed GitHub file size limits.

## 9. Cuentas Claras Scraper Constraints

- **Rate limit:** Maximum 1 HTTP request per 5 seconds. Use `src/utils/rate_limiter.py`.
- **Time window:** Only run between 2:00 AM – 5:00 AM Colombia time (UTC-5 = 07:00-10:00 UTC).
- **Respect robots.txt:** Check before adding any new URL pattern.
- **Selenium:** Use headless Chrome. Set a realistic user-agent string.
- **Never** run the scraper from GitHub Actions on a schedule — only manual trigger
  or from a local machine during the allowed time window to avoid IP blocks.

## 10. Supabase Storage Upload (mandatory after every Parquet write)

After writing any Parquet file locally, upload it to Supabase Storage and store the
public URL in `last_run.json`. The local file is then deleted.

```python
from supabase import create_client
from src.utils.config import get_config

def upload_parquet_to_supabase(local_path: str, storage_key: str) -> str:
    """Upload a local Parquet file to Supabase Storage. Returns the public URL."""
    cfg = get_config()
    client = create_client(cfg["SUPABASE_URL"], cfg["SUPABASE_KEY"])
    bucket = cfg["SUPABASE_STORAGE_BUCKET"]   # "veeduria-processed"

    with open(local_path, "rb") as f:
        client.storage.from_(bucket).upload(
            path=storage_key,
            file=f,
            file_options={"content-type": "application/octet-stream", "upsert": "true"}
        )

    public_url = client.storage.from_(bucket).get_public_url(storage_key)
    return public_url
```

**last_run.json format** (updated after each successful upload):
```json
{
  "secop_contratos": {
    "last_updated_at": "2025-11-01T14:30:00.000",
    "parquet_url": "https://<project>.supabase.co/storage/v1/object/public/veeduria-processed/secop_contratos/2025-11.parquet"
  },
  "secop_procesos": {
    "last_updated_at": "2025-11-01T14:30:00.000",
    "parquet_url": "https://..."
  }
}
```

- `last_run.json` IS committed to git (it's tiny and is the state pointer for incremental pulls).
- Parquet files are NEVER committed to git.
- Storage key convention: `{dataset}/{year_month}.parquet` (e.g., `secop_contratos/2025-11.parquet`).
- Required env var: `SUPABASE_STORAGE_BUCKET=veeduria-processed` (see `.env.example`).
