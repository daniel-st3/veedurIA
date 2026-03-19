# VeedurIA — Plataforma de Transparencia Cívica con IA

> Colombia's first AI-powered live public procurement and electoral accountability platform.

## Overview

VeedurIA is a 3-phase Streamlit multi-page application that exposes anomaly patterns in
Colombia's public procurement and electoral financing using open government data, ML
anomaly detection, and cross-referencing techniques.

**Phase 1 — ContratoLimpio** · **Phase 2 — SigueElDinero** · **Phase 3 — PromesóMetro**

## Quick Start

```bash
cp .env.example .env
# Fill in SOCRATA_APP_TOKEN and SUPABASE_* vars in .env
pip install -r requirements-phase1.txt   # Phase 1 only (fast)
# pip install -r requirements.txt        # Full install including Phase 3 NLP (slow, local only)
streamlit run app.py
```

## Deployment (Streamlit Community Cloud)

Point Streamlit Community Cloud to **`requirements-phase1.txt`**, not `requirements.txt`.

In app settings: **Advanced settings → Python packages file → `requirements-phase1.txt`**

| File | Purpose |
|---|---|
| `requirements-phase1.txt` | Phase 1 deps — use for Streamlit Cloud deployment |
| `requirements-phase3.txt` | Heavy NLP deps (transformers, bertopic, spacy) — Phase 3 local only |
| `requirements.txt` | Full list (all 3 phases) — local development only |

## Data Storage

Processed Parquet files live in **Supabase Storage** (bucket: `veeduria-processed`), not
in the git repo. GitHub tracks only: code, metadata JSONs, model validation results, and
reference data < 1MB.

## Documentation

See [CLAUDE.md](CLAUDE.md) for full architecture, data sources, ML standards, and dev commands.
